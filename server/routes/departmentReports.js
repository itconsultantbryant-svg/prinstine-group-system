const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, requireRole } = require('../utils/auth');
const { logAction } = require('../utils/audit');
const { sendNotificationToUser, sendNotificationToRole } = require('../utils/notifications');
const { archiveDocumentFromActivity } = require('./archivedDocuments');
const path = require('path');
const fs = require('fs');

// Get all reports (Admin can see all, DepartmentHead can see their own)
router.get('/', authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT dr.*, d.name as department_name, 
             u1.name as submitted_by_name, u1.email as submitted_by_email,
             u2.name as reviewed_by_name, u3.name as dept_head_reviewed_by_name
      FROM department_reports dr
      JOIN departments d ON dr.department_id = d.id
      JOIN users u1 ON dr.submitted_by = u1.id
      LEFT JOIN users u2 ON dr.reviewed_by = u2.id
      LEFT JOIN users u3 ON dr.dept_head_reviewed_by = u3.id
      WHERE 1=1
    `;
    const params = [];

    // DepartmentHead can only see their own department's reports
    // Special: Client Engagement and Audit heads can see each other's reports
    // Staff can see reports they submitted
    if (req.user.role === 'DepartmentHead') {
      const userEmail = (req.user.email || '').toLowerCase();
      const isClientEngagementOrAuditHead = userEmail.includes('cmoore') || userEmail.includes('wbuku');
      
      if (isClientEngagementOrAuditHead) {
        // Both can see reports from Client Engagement or Audit departments
        const depts = await db.all(
          `SELECT id, name FROM departments 
           WHERE (manager_id = ? OR LOWER(TRIM(head_email)) = ?)
           OR (LOWER(name) LIKE '%client engagement%' OR LOWER(name) LIKE '%audit%')`,
          [req.user.id, req.user.email.toLowerCase().trim()]
        );
        if (depts && depts.length > 0) {
          const deptIds = depts.map(d => d.id);
          query += ` AND dr.department_id IN (${deptIds.map(() => '?').join(',')})`;
          params.push(...deptIds);
        } else {
          return res.json({ reports: [] });
        }
      } else {
        const dept = await db.get('SELECT id, name FROM departments WHERE manager_id = ? OR LOWER(TRIM(head_email)) = ?', [req.user.id, req.user.email.toLowerCase().trim()]);
        if (dept) {
          query += ' AND dr.department_id = ?';
          params.push(dept.id);
        } else {
          return res.json({ reports: [] });
        }
      }
    } else if (req.user.role === 'Staff') {
      // Staff can only see their own submitted reports
      query += ' AND dr.submitted_by = ?';
      params.push(req.user.id);
    }

    query += ' ORDER BY dr.created_at DESC';

    const reports = await db.all(query, params);
    
    // Parse attachments JSON for each report
    const reportsWithAttachments = reports.map(report => ({
      ...report,
      attachments: report.attachments ? JSON.parse(report.attachments) : []
    }));
    
    res.json({ reports: reportsWithAttachments });
  } catch (error) {
    console.error('Get reports error:', error);
    // If table doesn't exist, return empty array instead of 500 error
    if (error.message && error.message.includes('no such table')) {
      console.warn('department_reports table does not exist yet');
      return res.json({ reports: [] });
    }
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// Get single report
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const report = await db.get(
      `SELECT dr.*, d.name as department_name, d.head_name,
              u1.name as submitted_by_name, u1.email as submitted_by_email,
              u2.name as reviewed_by_name,
              u3.name as dept_head_reviewed_by_name
       FROM department_reports dr
       JOIN departments d ON dr.department_id = d.id
       JOIN users u1 ON dr.submitted_by = u1.id
       LEFT JOIN users u2 ON dr.reviewed_by = u2.id
       LEFT JOIN users u3 ON dr.dept_head_reviewed_by = u3.id
       WHERE dr.id = ?`,
      [req.params.id]
    );

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Check permissions
    if (req.user.role === 'DepartmentHead') {
      const dept = await db.get('SELECT id FROM departments WHERE manager_id = ? OR LOWER(TRIM(head_email)) = ?', [req.user.id, req.user.email.toLowerCase().trim()]);
      if (!dept || dept.id !== report.department_id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    } else if (req.user.role === 'Staff') {
      // Staff can only view reports they submitted
      if (report.submitted_by !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // Parse attachments JSON
    const reportWithAttachments = {
      ...report,
      attachments: report.attachments ? JSON.parse(report.attachments) : []
    };
    
    res.json({ report: reportWithAttachments });
  } catch (error) {
    console.error('Get report error:', error);
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

// Helper function to check if user is Finance staff
async function isFinanceStaff(user) {
  if (user.role === 'Admin' || user.role === 'DepartmentHead') return false; // Handled separately
  if (user.role === 'Staff') {
    const staff = await db.get('SELECT department FROM staff WHERE user_id = ?', [user.id]);
    return staff && staff.department && staff.department.toLowerCase().includes('finance');
  }
  return false;
}

// Helper function to get department for staff member (Finance, Marketing, Academy)
async function getStaffDepartment(user) {
  if (user.role === 'Admin' || user.role === 'DepartmentHead') return null;
  if (user.role === 'Staff') {
    const staff = await db.get('SELECT department FROM staff WHERE user_id = ?', [user.id]);
    if (staff && staff.department) {
      const staffDeptName = staff.department.toLowerCase().trim();
      // Check if staff belongs to Finance, Marketing, or Academy department
      if (staffDeptName.includes('finance') || staffDeptName.includes('marketing') || staffDeptName.includes('academy')) {
        // Get all departments and find the best match
        const allDepartments = await db.all('SELECT id, name FROM departments');
        const matchingDept = allDepartments.find(d => {
          const deptName = d.name ? d.name.toLowerCase().trim() : '';
          // Match if department name contains the staff department keyword or vice versa
          return (staffDeptName.includes('finance') && deptName.includes('finance')) ||
                 (staffDeptName.includes('marketing') && deptName.includes('marketing')) ||
                 (staffDeptName.includes('academy') && deptName.includes('academy'));
        });
        return matchingDept || null;
      }
    }
  }
  return null;
}

// Submit report (DepartmentHead or Staff with Finance/Marketing/Academy department)
router.post('/', authenticateToken, [
  body('title').trim().notEmpty().withMessage('Report title is required'),
  body('content').trim().notEmpty().withMessage('Report content is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check if user can submit reports
    let department = null;
    const userEmail = (req.user.email || '').toLowerCase();
    const isClientEngagementOrAuditHead = userEmail.includes('cmoore') || userEmail.includes('wbuku');
    
    if (req.user.role === 'DepartmentHead') {
      // Special handling: Client Engagement and Audit heads can submit for each other's departments
      if (isClientEngagementOrAuditHead) {
        // Allow both to submit for Client Engagement or Audit departments
        department = await db.get(
          `SELECT id, name FROM departments 
           WHERE (manager_id = ? OR LOWER(TRIM(head_email)) = ?)
           OR (LOWER(name) LIKE '%client engagement%' OR LOWER(name) LIKE '%audit%')`,
          [req.user.id, req.user.email.toLowerCase().trim()]
        );
      } else {
        department = await db.get('SELECT id, name FROM departments WHERE manager_id = ? OR LOWER(TRIM(head_email)) = ?', [req.user.id, req.user.email.toLowerCase().trim()]);
      }
    } else {
      // Staff with Finance, Marketing, or Academy department can submit reports
      department = await getStaffDepartment(req.user);
    }

    if (!department) {
      return res.status(403).json({ error: 'You do not have permission to submit reports for any department' });
    }

    const { title, content, attachments } = req.body;

    // If submitted by Staff (Assistant Finance Officer), status starts as 'Pending' for Department Head review
    // If submitted by DepartmentHead, status is 'Pending' for Admin review
    const status = (req.user.role === 'DepartmentHead') ? 'Pending' : 'Pending_DeptHead';

    // Handle attachments - stringify if it's an array/object, otherwise use as-is or null
    let attachmentsValue = null;
    if (attachments) {
      if (typeof attachments === 'string') {
        attachmentsValue = attachments;
      } else if (Array.isArray(attachments) || typeof attachments === 'object') {
        attachmentsValue = JSON.stringify(attachments);
      }
    }

    const result = await db.run(
      `INSERT INTO department_reports (department_id, submitted_by, title, content, attachments, status, dept_head_status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [department.id, req.user.id, title, content, attachmentsValue, status, status === 'Pending_DeptHead' ? 'Pending' : null]
    );

    if (!result || !result.lastID) {
      throw new Error('Failed to insert report - no ID returned');
    }

    await logAction(req.user.id, 'submit_report', 'department_reports', result.lastID, { title }, req);

    const report = await db.get(
      `SELECT dr.*, d.name as department_name
       FROM department_reports dr
       JOIN departments d ON dr.department_id = d.id
       WHERE dr.id = ?`,
      [result.lastID]
    );

    if (!report) {
      throw new Error('Failed to retrieve created report');
    }

    // Archive all attachment documents
    if (attachments) {
      try {
        let attachmentArray = [];
        if (typeof attachments === 'string') {
          try {
            attachmentArray = JSON.parse(attachments);
          } catch (e) {
            // If not JSON, treat as single URL string
            attachmentArray = [attachments];
          }
        } else if (Array.isArray(attachments)) {
          attachmentArray = attachments;
        } else if (typeof attachments === 'object') {
          attachmentArray = Object.values(attachments).flat();
        }

        for (const attachment of attachmentArray) {
          if (attachment && (attachment.url || attachment)) {
            const fileUrl = attachment.url || attachment;
            // Extract filename from URL
            const urlParts = fileUrl.split('/');
            const filename = urlParts[urlParts.length - 1];
            
            // Determine file path (could be in uploads/reports or uploads/)
            let filePath = null;
            if (fileUrl.includes('/uploads/reports/')) {
              filePath = `/uploads/reports/${filename}`;
            } else if (fileUrl.includes('/uploads/')) {
              filePath = `/uploads/${filename}`;
            }

            if (filePath) {
              const fullPath = path.join(__dirname, '../..', filePath);
              if (fs.existsSync(fullPath)) {
                await archiveDocumentFromActivity(
                  req.user.id,
                  filePath,
                  attachment.originalName || filename,
                  'department_report',
                  report.id,
                  `Department report attachment: ${report.title}`,
                  req.user.id
                );
              }
            }
          }
        }
      } catch (archiveError) {
        console.error('Error archiving department report attachments:', archiveError);
        // Don't fail the request if archiving fails
      }
    }

    // Send real-time notifications
    try {
      // Notify Department Head if submitted by Staff
      if (req.user.role === 'Staff' && department.manager_id) {
        await sendNotificationToUser(department.manager_id, {
          title: 'New Report Submitted',
          message: `A new report "${title}" has been submitted by ${req.user.name || req.user.email} for ${department.name}`,
          link: `/department-reports`,
          type: 'info',
          senderId: req.user.id
        });
      }
      // Notify Admin if submitted by Department Head
      else if (req.user.role === 'DepartmentHead') {
        await sendNotificationToRole('Admin', {
          title: 'New Department Report',
          message: `A new report "${title}" has been submitted by ${req.user.name || req.user.email} for ${department.name}`,
          link: `/department-reports`,
          type: 'info',
          senderId: req.user.id
        });
      }

      // Notify submitter
      await sendNotificationToUser(req.user.id, {
        title: 'Report Submitted',
        message: `Your report "${title}" has been submitted successfully`,
        link: `/department-reports`,
        type: 'success',
        senderId: req.user.id
      });
    } catch (notifError) {
      console.error('Error sending notifications:', notifError);
    }

    res.status(201).json({
      message: 'Report submitted successfully',
      report
    });
  } catch (error) {
    console.error('Submit report error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sql: error.sql
    });
    
    // Handle specific database errors
    let errorMessage = 'Failed to submit report';
    if (error.message && error.message.includes('FOREIGN KEY constraint')) {
      errorMessage = 'Foreign key constraint failed. Please ensure department and user exist.';
    } else if (error.message && error.message.includes('NOT NULL constraint')) {
      errorMessage = 'Required fields are missing.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    res.status(500).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update report (DepartmentHead or Staff who submitted it, only if status is Pending or Pending_DeptHead)
router.put('/:id', authenticateToken, [
  body('title').trim().notEmpty().withMessage('Report title is required'),
  body('content').trim().notEmpty().withMessage('Report content is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, content, attachments } = req.body;
    const reportId = req.params.id;

    const report = await db.get('SELECT * FROM department_reports WHERE id = ?', [reportId]);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Check if user submitted this report (DepartmentHead or Staff)
    if (report.submitted_by !== req.user.id) {
      return res.status(403).json({ error: 'You can only edit your own reports' });
    }

    // Verify user can edit reports (DepartmentHead or Staff from Finance/Marketing/Academy)
    if (req.user.role === 'Staff') {
      const staffDept = await getStaffDepartment(req.user);
      if (!staffDept) {
        return res.status(403).json({ error: 'Only Finance, Marketing, and Academy staff can edit department reports' });
      }
    } else if (req.user.role !== 'DepartmentHead') {
      return res.status(403).json({ error: 'You do not have permission to edit reports' });
    }

    // Only allow editing if status is Pending or Pending_DeptHead
    if (!['Pending', 'Pending_DeptHead'].includes(report.status)) {
      return res.status(403).json({ error: 'You can only edit reports with Pending status' });
    }

    await db.run(
      `UPDATE department_reports 
       SET title = ?, content = ?, attachments = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [title, content, attachments ? JSON.stringify(attachments) : report.attachments, reportId]
    );

    await logAction(req.user.id, 'update_report', 'department_reports', reportId, { title }, req);

    const updatedReport = await db.get(
      `SELECT dr.*, d.name as department_name
       FROM department_reports dr
       JOIN departments d ON dr.department_id = d.id
       WHERE dr.id = ?`,
      [reportId]
    );

    res.json({
      message: 'Report updated successfully',
      report: updatedReport
    });
  } catch (error) {
    console.error('Update report error:', error);
    res.status(500).json({ error: 'Failed to update report: ' + error.message });
  }
});

// Department Head approval/rejection (for reports submitted by Staff)
router.put('/:id/dept-head-review', authenticateToken, requireRole('DepartmentHead'), [
  body('status').isIn(['DepartmentHead_Approved', 'DepartmentHead_Rejected']).withMessage('Status must be DepartmentHead_Approved or DepartmentHead_Rejected'),
  body('dept_head_notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status, dept_head_notes } = req.body;
    const reportId = req.params.id;

    const report = await db.get('SELECT dr.*, d.name as department_name FROM department_reports dr JOIN departments d ON dr.department_id = d.id WHERE dr.id = ?', [reportId]);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Check if user is the department head for this department
    const dept = await db.get('SELECT id, name FROM departments WHERE (manager_id = ? OR LOWER(TRIM(head_email)) = ?) AND id = ?', [req.user.id, req.user.email.toLowerCase().trim(), report.department_id]);
    if (!dept) {
      return res.status(403).json({ error: 'You can only review reports from your department' });
    }

    // Check if report needs department head review
    if (report.status !== 'Pending_DeptHead' && report.dept_head_status !== 'Pending') {
      return res.status(400).json({ error: 'This report does not require department head review' });
    }

    const newStatus = status === 'DepartmentHead_Approved' ? 'Pending' : 'DepartmentHead_Rejected';
    
    await db.run(
      `UPDATE department_reports 
       SET status = ?, dept_head_status = ?, dept_head_notes = ?, dept_head_reviewed_by = ?, dept_head_reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [newStatus, status, dept_head_notes || null, req.user.id, reportId]
    );

    await logAction(req.user.id, 'dept_head_review_report', 'department_reports', reportId, { status }, req);

    // Send real-time notifications
    try {
      const submitter = await db.get('SELECT id, name, email FROM users WHERE id = ?', [report.submitted_by]);
      const isApproved = status === 'DepartmentHead_Approved';
      
      // Notify submitter
      if (submitter) {
        await sendNotificationToUser(submitter.id, {
          title: `Report ${isApproved ? 'Approved' : 'Rejected'}`,
          message: `Your report "${report.title}" has been ${isApproved ? 'approved' : 'rejected'} by the Department Head`,
          link: `/department-reports`,
          type: isApproved ? 'success' : 'warning',
          senderId: req.user.id
        });
      }

      // If approved, notify Admin
      if (isApproved) {
        await sendNotificationToRole('Admin', {
          title: 'Report Ready for Review',
          message: `Report "${report.title}" from ${report.department_name} has been approved by Department Head and is ready for your review`,
          link: `/department-reports`,
          type: 'info',
          senderId: req.user.id
        });
      }
    } catch (notifError) {
      console.error('Error sending notifications:', notifError);
    }

    res.json({ message: `Report ${status === 'DepartmentHead_Approved' ? 'approved' : 'rejected'} by department head successfully` });
  } catch (error) {
    console.error('Department head review error:', error);
    res.status(500).json({ error: 'Failed to review report: ' + error.message });
  }
});

// Approve/Reject report (Admin - final approval)
router.put('/:id/review', authenticateToken, requireRole('Admin'), [
  body('status').isIn(['Approved', 'Rejected', 'Final_Approved']).withMessage('Status must be Approved, Rejected, or Final_Approved'),
  body('admin_notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status, admin_notes } = req.body;
    const reportId = req.params.id;

    const report = await db.get('SELECT dr.*, d.name as department_name FROM department_reports dr JOIN departments d ON dr.department_id = d.id WHERE dr.id = ?', [reportId]);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // For reports submitted by Staff, require Department Head approval first
    const submitter = await db.get('SELECT role FROM users WHERE id = ?', [report.submitted_by]);
    if (submitter && submitter.role === 'Staff') {
      if (report.dept_head_status !== 'DepartmentHead_Approved' && report.status !== 'Pending') {
        return res.status(400).json({ error: 'Department Head must approve this report before Admin can review it' });
      }
    }

    const finalStatus = status === 'Final_Approved' ? 'Final_Approved' : status;

    await db.run(
      `UPDATE department_reports 
       SET status = ?, admin_notes = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [finalStatus, admin_notes || null, req.user.id, reportId]
    );

    await logAction(req.user.id, 'admin_review_report', 'department_reports', reportId, { status: finalStatus }, req);

    // Send real-time notifications
    try {
      const submitter = await db.get('SELECT id, name, email FROM users WHERE id = ?', [report.submitted_by]);
      const isApproved = finalStatus === 'Final_Approved' || finalStatus === 'Approved';
      
      // Notify submitter
      if (submitter) {
        await sendNotificationToUser(submitter.id, {
          title: `Report ${isApproved ? 'Approved' : 'Rejected'}`,
          message: `Your report "${report.title}" has been ${isApproved ? 'approved' : 'rejected'} by Admin`,
          link: `/department-reports`,
          type: isApproved ? 'success' : 'warning',
          senderId: req.user.id
        });
      }

      // If submitted by Staff, also notify Department Head
      if (submitter && submitter.role === 'Staff' && report.dept_head_reviewed_by) {
        await sendNotificationToUser(report.dept_head_reviewed_by, {
          title: `Report ${isApproved ? 'Approved' : 'Rejected'}`,
          message: `The report "${report.title}" you reviewed has been ${isApproved ? 'approved' : 'rejected'} by Admin`,
          link: `/department-reports`,
          type: isApproved ? 'success' : 'info',
          senderId: req.user.id
        });
      }
    } catch (notifError) {
      console.error('Error sending notifications:', notifError);
    }

    res.json({ message: `Report ${finalStatus === 'Final_Approved' ? 'finally approved' : finalStatus.toLowerCase()} by Admin successfully` });
  } catch (error) {
    console.error('Admin review error:', error);
    res.status(500).json({ error: 'Failed to review report: ' + error.message });
  }
});

// Delete report (Admin or DepartmentHead who submitted it)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const reportId = req.params.id;

    const report = await db.get('SELECT * FROM department_reports WHERE id = ?', [reportId]);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Check permissions
    if (req.user.role !== 'Admin' && report.submitted_by !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await db.run('DELETE FROM department_reports WHERE id = ?', [reportId]);

    await logAction(req.user.id, 'delete_report', 'department_reports', reportId, {}, req);

    res.json({ message: 'Report deleted successfully' });
  } catch (error) {
    console.error('Delete report error:', error);
    res.status(500).json({ error: 'Failed to delete report' });
  }
});

module.exports = router;


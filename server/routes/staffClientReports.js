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

// Get all staff client reports
// Staff can see their own, Marketing Manager can see Marketing dept staff reports, Admin can see all
router.get('/', authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT scr.*, 
             u.name as staff_name, u.email as staff_email,
             d.name as department_name
      FROM staff_client_reports scr
      LEFT JOIN users u ON scr.staff_id = u.id
      LEFT JOIN departments d ON scr.department_id = d.id
      WHERE 1=1
    `;
    const params = [];

    // Role-based filtering
    if (req.user.role === 'Staff') {
      query += ' AND scr.staff_id = ?';
      params.push(req.user.id);
    } else if (req.user.role === 'DepartmentHead') {
      // Check if user is Marketing Department Head
      const dept = await db.get(
        'SELECT id, name FROM departments WHERE manager_id = ? OR LOWER(TRIM(head_email)) = ?',
        [req.user.id, req.user.email.toLowerCase().trim()]
      );
      if (dept && dept.name.toLowerCase().includes('marketing')) {
        // Marketing Manager can see ALL staff reports EXCEPT:
        // - Finance reports (department name contains 'finance')
        // - Petty cash reports (these are in petty_cash_ledgers table, not staff_client_reports)
        // - Asset registry reports (these are in assets table, not staff_client_reports)
        // - Audit reports (department name contains 'audit')
        // - IT reports (department name contains 'ict' or 'it')
        // Also show reports that need approval (Submitted or Draft status)
        query += ` AND (scr.department_name IS NULL OR 
                        (LOWER(scr.department_name) NOT LIKE '%finance%' AND
                         LOWER(scr.department_name) NOT LIKE '%audit%' AND
                         LOWER(scr.department_name) NOT LIKE '%ict%' AND
                         LOWER(scr.department_name) NOT LIKE '%it%'))`;
        // Show reports that need approval or are from Marketing/Academy departments
        query += ` AND (scr.status IN ('Submitted', 'Draft') OR 
                        scr.department_id = ? OR
                        LOWER(scr.department_name) LIKE '%marketing%' OR
                        LOWER(scr.department_name) LIKE '%academy%')`;
        params.push(dept.id);
      } else {
        // Other department heads can only see their own if they're also staff
        query += ' AND scr.staff_id = ?';
        params.push(req.user.id);
      }
    }
    // Admin can see all (no additional filter)

    query += ' ORDER BY scr.created_at DESC';

    const reports = await db.all(query, params);
    res.json({ reports });
  } catch (error) {
    console.error('Get staff client reports error:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// Get single report
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const report = await db.get(
      `SELECT scr.*, 
              u.name as staff_name, u.email as staff_email,
              d.name as department_name
       FROM staff_client_reports scr
       LEFT JOIN users u ON scr.staff_id = u.id
       LEFT JOIN departments d ON scr.department_id = d.id
       WHERE scr.id = ?`,
      [req.params.id]
    );

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Check permissions
    if (req.user.role === 'Staff' && report.staff_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    } else if (req.user.role === 'DepartmentHead') {
      const dept = await db.get(
        'SELECT id, name FROM departments WHERE manager_id = ? OR LOWER(TRIM(head_email)) = ?',
        [req.user.id, req.user.email.toLowerCase().trim()]
      );
      if (dept && dept.name.toLowerCase().includes('marketing')) {
        // Marketing Manager can view Marketing department reports
        if (report.department_id !== dept.id) {
          return res.status(403).json({ error: 'Access denied' });
        }
      } else if (report.staff_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }
    // Admin can view all

    res.json({ report });
  } catch (error) {
    console.error('Get staff client report error:', error);
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

// Submit report (Staff only)
router.post('/', authenticateToken, requireRole('Staff'), [
  body('report_title').trim().notEmpty().withMessage('Report title is required'),
  body('report_content').notEmpty().withMessage('Report content is required'),
  body('client_name').trim().notEmpty().withMessage('Client name is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { report_title, report_content, client_name, client_id, attachments } = req.body;

    // Get staff information
    const staff = await db.get('SELECT * FROM staff WHERE user_id = ?', [req.user.id]);
    if (!staff) {
      return res.status(400).json({ error: 'Staff record not found' });
    }

    // Get department information - try multiple matching strategies
    let department_id = null;
    let department_name = null;
    if (staff.department) {
      // First try exact match
      let dept = await db.get('SELECT id, name FROM departments WHERE name = ?', [staff.department]);
      
      // If no exact match, try case-insensitive match
      if (!dept) {
        dept = await db.get('SELECT id, name FROM departments WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))', [staff.department]);
      }
      
      // If still no match, try partial match (contains)
      if (!dept) {
        const allDepts = await db.all('SELECT id, name FROM departments');
        const staffDeptLower = staff.department.toLowerCase().trim();
        dept = allDepts.find(d => {
          const deptNameLower = (d.name || '').toLowerCase().trim();
          return deptNameLower.includes(staffDeptLower) || staffDeptLower.includes(deptNameLower);
        });
      }
      
      if (dept) {
        department_id = dept.id;
        department_name = dept.name;
      } else {
        // Fallback: use staff department name even if not found in departments table
        department_name = staff.department;
      }
    }

    // Ensure staff_name is always populated (required field)
    const staffName = req.user.name || staff.name || staff.full_name || req.user.email || 'Unknown Staff';
    const staffEmail = req.user.email || staff.email || '';

    if (!staffEmail) {
      return res.status(400).json({ error: 'Staff email is required' });
    }

    const result = await db.run(
      `INSERT INTO staff_client_reports 
       (staff_id, staff_name, staff_email, department_id, department_name, 
        client_id, client_name, report_title, report_content, attachments, status, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Submitted', CURRENT_TIMESTAMP)`,
      [
        req.user.id,
        staffName,
        staffEmail,
        department_id,
        department_name,
        client_id || null,
        client_name,
        report_title,
        report_content,
        attachments ? JSON.stringify(attachments) : null
      ]
    );

    await logAction(req.user.id, 'submit_staff_client_report', 'staff_client_reports', result.lastID, { report_title }, req);

    const report = await db.get(
      `SELECT scr.*, 
              u.name as staff_name, u.email as staff_email,
              d.name as department_name
       FROM staff_client_reports scr
       LEFT JOIN users u ON scr.staff_id = u.id
       LEFT JOIN departments d ON scr.department_id = d.id
       WHERE scr.id = ?`,
      [result.lastID]
    );

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
                  'staff_client_report',
                  report.id,
                  `Staff client report attachment: ${report_title}`,
                  req.user.id
                );
              }
            }
          }
        }
      } catch (archiveError) {
        console.error('Error archiving staff client report attachments:', archiveError);
        // Don't fail the request if archiving fails
      }
    }

    // Send real-time notifications
    try {
      // Notify submitter
      await sendNotificationToUser(req.user.id, {
        title: 'Report Submitted',
        message: `Your client report "${report_title}" has been submitted successfully`,
        link: `/staff-client-reports`,
        type: 'success',
        senderId: req.user.id
      });

      // Check if report is from excluded departments
      const isExcluded = department_name && (
        department_name.toLowerCase().includes('finance') ||
        department_name.toLowerCase().includes('audit') ||
        department_name.toLowerCase().includes('ict') ||
        department_name.toLowerCase().includes('it')
      );
      
      if (!isExcluded) {
        // Get Marketing Department Head
        const marketingDept = await db.get(
          "SELECT manager_id, head_email FROM departments WHERE LOWER(name) LIKE '%marketing%'"
        );
        
        if (marketingDept) {
          let marketingHeadId = marketingDept.manager_id;
          
          // If no manager_id, try to find by email
          if (!marketingHeadId && marketingDept.head_email) {
            const marketingHead = await db.get(
              'SELECT id FROM users WHERE LOWER(TRIM(email)) = ?',
              [marketingDept.head_email.toLowerCase().trim()]
            );
            if (marketingHead) {
              marketingHeadId = marketingHead.id;
            }
          }
          
          if (marketingHeadId) {
            await sendNotificationToUser(
              marketingHeadId,
              {
                title: 'New Staff Report Requires Approval',
                message: `Staff member ${staffName} has submitted a client report "${report_title}" that requires your approval.`,
                link: `/staff-client-reports/${result.lastID}`,
                type: 'info',
                senderId: req.user.id
              }
            );
          } else {
            // Fallback: send to all Marketing Department Heads by role
            await sendNotificationToRole(
              'DepartmentHead',
              'New Staff Report Requires Approval',
              `Staff member ${staffName} has submitted a client report "${report_title}" that requires Marketing Department Head approval.`,
              'info',
              `/staff-client-reports/${result.lastID}`,
              req.user.id
            );
          }
        }
      }
    } catch (notifError) {
      console.error('Error sending notifications:', notifError);
      // Don't fail the request if notification fails
    }

    res.status(201).json({
      message: 'Report submitted successfully',
      report
    });
  } catch (error) {
    console.error('Submit staff client report error:', error);
    res.status(500).json({ error: 'Failed to submit report: ' + error.message });
  }
});

// Update report (Staff who submitted it, only if status is Draft or Submitted)
router.put('/:id', authenticateToken, requireRole('Staff'), [
  body('report_title').trim().notEmpty().withMessage('Report title is required'),
  body('report_content').notEmpty().withMessage('Report content is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { report_title, report_content, attachments } = req.body;
    const reportId = req.params.id;

    const report = await db.get('SELECT * FROM staff_client_reports WHERE id = ?', [reportId]);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Check if user submitted this report
    if (report.staff_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only edit your own reports' });
    }

    // Only allow editing if status is Draft or Submitted (not yet reviewed)
    if (!['Draft', 'Submitted'].includes(report.status)) {
      return res.status(403).json({ error: 'You can only edit reports that are Draft or Submitted' });
    }

    await db.run(
      `UPDATE staff_client_reports 
       SET report_title = ?, report_content = ?, attachments = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        report_title,
        report_content,
        attachments ? JSON.stringify(attachments) : report.attachments,
        reportId
      ]
    );

    await logAction(req.user.id, 'update_staff_client_report', 'staff_client_reports', reportId, { report_title }, req);

    const updatedReport = await db.get(
      `SELECT scr.*, 
              u.name as staff_name, u.email as staff_email,
              d.name as department_name
       FROM staff_client_reports scr
       LEFT JOIN users u ON scr.staff_id = u.id
       LEFT JOIN departments d ON scr.department_id = d.id
       WHERE scr.id = ?`,
      [reportId]
    );

    res.json({
      message: 'Report updated successfully',
      report: updatedReport
    });
  } catch (error) {
    console.error('Update staff client report error:', error);
    res.status(500).json({ error: 'Failed to update report: ' + error.message });
  }
});

// Marketing Manager approval/rejection
router.put('/:id/marketing-review', authenticateToken, requireRole('DepartmentHead'), [
  body('status').isIn(['Marketing_Manager_Approved', 'Marketing_Manager_Rejected']).withMessage('Status must be Marketing_Manager_Approved or Marketing_Manager_Rejected'),
  body('notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status, notes } = req.body;
    const reportId = req.params.id;

    const report = await db.get('SELECT * FROM staff_client_reports WHERE id = ?', [reportId]);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Check if user is Marketing Manager
    const dept = await db.get(
      'SELECT id, name FROM departments WHERE manager_id = ? OR LOWER(TRIM(head_email)) = ?',
      [req.user.id, req.user.email.toLowerCase().trim()]
    );
    if (!dept || !dept.name.toLowerCase().includes('marketing')) {
      return res.status(403).json({ error: 'Only Marketing Manager can review these reports' });
    }

    // Check if report is from excluded departments (Finance, Audit, ICT/IT)
    // Marketing Manager can approve ALL staff reports EXCEPT these
    if (report.department_id) {
      const reportDept = await db.get('SELECT id, name FROM departments WHERE id = ?', [report.department_id]);
      if (reportDept) {
        const deptName = reportDept.name.toLowerCase();
        if (deptName.includes('finance') || deptName.includes('audit') || 
            deptName.includes('ict') || deptName.includes('it')) {
          return res.status(403).json({ error: 'Marketing Manager cannot review reports from Finance, Audit, or IT departments' });
        }
      }
    }

    // Check if report is in correct status for marketing review
    if (!['Submitted', 'Draft'].includes(report.status)) {
      return res.status(400).json({ error: 'Report is not in a state that can be reviewed by Marketing Manager' });
    }

    await db.run(
      `UPDATE staff_client_reports 
       SET status = ?, marketing_manager_id = ?, marketing_manager_name = ?, 
           marketing_manager_notes = ?, marketing_manager_reviewed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [status, req.user.id, req.user.name, notes || null, reportId]
    );

    await logAction(req.user.id, 'marketing_review_staff_client_report', 'staff_client_reports', reportId, { status }, req);

    res.json({ message: `Report ${status === 'Marketing_Manager_Approved' ? 'approved' : 'rejected'} by Marketing Manager` });
  } catch (error) {
    console.error('Marketing review error:', error);
    res.status(500).json({ error: 'Failed to review report' });
  }
});

// Admin approval/rejection (final approval)
router.put('/:id/admin-review', authenticateToken, requireRole('Admin'), [
  body('status').isIn(['Admin_Approved', 'Admin_Rejected', 'Final_Approved']).withMessage('Status must be Admin_Approved, Admin_Rejected, or Final_Approved'),
  body('notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status, notes } = req.body;
    const reportId = req.params.id;

    const report = await db.get('SELECT * FROM staff_client_reports WHERE id = ?', [reportId]);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // For all staff reports (except Finance, Audit, IT), admin can only approve if Marketing Manager has approved
    // Check if report is from excluded departments
    let isExcludedDept = false;
    if (report.department_id) {
      const dept = await db.get('SELECT name FROM departments WHERE id = ?', [report.department_id]);
      if (dept) {
        const deptName = dept.name.toLowerCase();
        isExcludedDept = deptName.includes('finance') || deptName.includes('audit') || 
                         deptName.includes('ict') || deptName.includes('it');
      }
    }
    
    // If not from excluded department, Marketing Manager must approve first
    if (!isExcludedDept && !['Marketing_Manager_Approved'].includes(report.status)) {
      return res.status(400).json({ error: 'Marketing Manager must approve this report before admin can review it' });
    }

    await db.run(
      `UPDATE staff_client_reports 
       SET status = ?, admin_id = ?, admin_name = ?, 
           admin_notes = ?, admin_reviewed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [status, req.user.id, req.user.name, notes || null, reportId]
    );

    await logAction(req.user.id, 'admin_review_staff_client_report', 'staff_client_reports', reportId, { status }, req);

    res.json({ message: `Report ${status === 'Final_Approved' ? 'finally approved' : status === 'Admin_Approved' ? 'approved' : 'rejected'} by Admin` });
  } catch (error) {
    console.error('Admin review error:', error);
    res.status(500).json({ error: 'Failed to review report' });
  }
});

// Delete report (Staff who submitted it, or Admin)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const reportId = req.params.id;

    const report = await db.get('SELECT * FROM staff_client_reports WHERE id = ?', [reportId]);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Check permissions
    if (req.user.role !== 'Admin' && report.staff_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await db.run('DELETE FROM staff_client_reports WHERE id = ?', [reportId]);

    await logAction(req.user.id, 'delete_staff_client_report', 'staff_client_reports', reportId, {}, req);

    res.json({ message: 'Report deleted successfully' });
  } catch (error) {
    console.error('Delete staff client report error:', error);
    res.status(500).json({ error: 'Failed to delete report' });
  }
});

module.exports = router;


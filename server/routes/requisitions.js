const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken, requireRole } = require('../utils/auth');
const { sendNotificationToUser, sendNotificationToRole } = require('../utils/notifications');
const { archiveDocumentFromActivity } = require('./archivedDocuments');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/requisitions');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'req-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage, 
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Get all requisitions (users see their own, admin sees all)
router.get('/', authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT 
        r.*,
        u.name as user_name,
        u.email as user_email,
        d.name as department_name,
        dept_head.name as dept_head_reviewer_name,
        admin.name as admin_reviewer_name,
        target.name as target_user_name
      FROM requisitions r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN departments d ON r.department_id = d.id
      LEFT JOIN users dept_head ON r.dept_head_reviewed_by = dept_head.id
      LEFT JOIN users admin ON r.admin_reviewed_by = admin.id
      LEFT JOIN users target ON r.target_user_id = target.id
      WHERE 1=1
    `;
    
    const params = [];
    
    // Filter based on user role
    if (req.user.role === 'Admin') {
      // Admin sees all requisitions
    } else if (req.user.role === 'DepartmentHead') {
      // Department Head sees requisitions from their department
      // This includes: pending approval, approved by them, and rejected by them
      // First, get the department(s) this user manages
      const dept = await db.get(
        'SELECT id, name FROM departments WHERE manager_id = ? OR LOWER(TRIM(head_email)) = ?',
        [req.user.id, req.user.email.toLowerCase().trim()]
      );
      
      if (dept) {
        // Show requisitions from this department that are:
        // 1. Pending department head approval
        // 2. Approved by this department head (Pending_Admin, Admin_Approved, Admin_Rejected)
        // 3. Rejected by this department head
        query += ` AND (r.department_id = ? OR LOWER(TRIM(r.department_name)) = ?) 
                    AND (r.status = ? 
                         OR (r.status IN (?, ?, ?) AND r.dept_head_reviewed_by = ?)
                         OR (r.status = ? AND r.dept_head_reviewed_by = ?))`;
        params.push(
          dept.id, 
          dept.name.toLowerCase().trim(), 
          'Pending_DeptHead',
          'Pending_Admin', 'Admin_Approved', 'Admin_Rejected',
          req.user.id,
          'DeptHead_Rejected',
          req.user.id
        );
      } else {
        // If no department found, show nothing (or could show their own)
        query += ' AND 1=0'; // Return no results
      }
    } else {
      // Regular users only see their own requisitions
      query += ' AND r.user_id = ?';
      params.push(req.user.id);
    }
    
    query += ' ORDER BY r.requisition_date DESC, r.created_at DESC';
    
    const requisitions = await db.all(query, params);
    res.json({ requisitions });
  } catch (error) {
    console.error('Get requisitions error:', error);
    res.status(500).json({ error: 'Failed to fetch requisitions: ' + error.message });
  }
});

// Get single requisition
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT 
        r.*,
        u.name as user_name,
        u.email as user_email,
        d.name as department_name,
        dept_head.name as dept_head_reviewer_name,
        admin.name as admin_reviewer_name,
        target.name as target_user_name
      FROM requisitions r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN departments d ON r.department_id = d.id
      LEFT JOIN users dept_head ON r.dept_head_reviewed_by = dept_head.id
      LEFT JOIN users admin ON r.admin_reviewed_by = admin.id
      LEFT JOIN users target ON r.target_user_id = target.id
      WHERE r.id = ?
    `;
    
    const params = [req.params.id];
    
    // Filter based on user role
    if (req.user.role === 'Admin') {
      // Admin can see all requisitions
    } else if (req.user.role === 'DepartmentHead') {
      // Department Head can see requisitions from their department
      const dept = await db.get(
        'SELECT id, name FROM departments WHERE manager_id = ? OR LOWER(TRIM(head_email)) = ?',
        [req.user.id, req.user.email.toLowerCase().trim()]
      );
      
      if (dept) {
        // Allow if it's from their department
        query += ' AND (r.department_id = ? OR LOWER(TRIM(r.department_name)) = ?)';
        params.push(dept.id, dept.name.toLowerCase().trim());
      } else {
        // If no department found, only show their own
        query += ' AND r.user_id = ?';
        params.push(req.user.id);
      }
    } else {
      // Regular users can only see their own requisitions
      query += ' AND r.user_id = ?';
      params.push(req.user.id);
    }
    
    const requisition = await db.get(query, params);
    
    if (!requisition) {
      return res.status(404).json({ error: 'Requisition not found' });
    }
    
    res.json({ requisition });
  } catch (error) {
    console.error('Get requisition error:', error);
    res.status(500).json({ error: 'Failed to fetch requisition: ' + error.message });
  }
});

// Create requisition
router.post('/', authenticateToken, upload.single('document'), async (req, res) => {
  try {
    const {
      requisition_date,
      request_type,
      materials,
      cost,
      quantity,
      purpose,
      period_from,
      period_to,
      leave_purpose,
      target_user_id,
      target_role
    } = req.body;

    // Validation
    if (!requisition_date || !request_type) {
      return res.status(400).json({ error: 'Date and request type are required' });
    }

    // Validate request type
    const validRequestTypes = ['office_supplies', 'work_support', 'sick_leave', 'temporary_leave', 'vacation', 'annual_leave'];
    if (!validRequestTypes.includes(request_type)) {
      return res.status(400).json({ error: 'Invalid request type' });
    }

    // Get user info
    const user = await db.get('SELECT name FROM users WHERE id = ?', [req.user.id]);
    const userName = user?.name || req.user.name || req.user.email;

    // Get department info
    let departmentId = null;
    let departmentName = null;
    if (req.user.role === 'Staff') {
      const staff = await db.get('SELECT department FROM staff WHERE user_id = ?', [req.user.id]);
      if (staff && staff.department) {
        // Try to find department by name
        const dept = await db.get('SELECT id, name FROM departments WHERE LOWER(TRIM(name)) = ?', [staff.department.toLowerCase().trim()]);
        if (dept) {
          departmentId = dept.id;
          departmentName = dept.name;
        } else {
          // If department not found in departments table, just use the name
          departmentName = staff.department;
        }
      }
    } else if (req.user.role === 'DepartmentHead') {
      const dept = await db.get(
        'SELECT id, name FROM departments WHERE manager_id = ? OR LOWER(TRIM(head_email)) = ?',
        [req.user.id, req.user.email.toLowerCase().trim()]
      );
      if (dept) {
        departmentId = dept.id;
        departmentName = dept.name;
      }
    }

    // Determine initial status
    // ALL requisitions go to Department Head first, then Admin
    const initialStatus = 'Pending_DeptHead';

    const document_path = req.file ? `/uploads/requisitions/${req.file.filename}` : null;
    const document_name = req.file ? req.file.originalname : null;

    // Clean up target_user_id and target_role (convert empty strings to null)
    const cleanTargetUserId = target_user_id && target_user_id.trim() !== '' ? parseInt(target_user_id) : null;
    const cleanTargetRole = target_role && target_role.trim() !== '' ? target_role : null;

    // Parse cost and quantity safely
    const parsedCost = cost && cost.toString().trim() !== '' ? parseFloat(cost) : null;
    const parsedQuantity = quantity && quantity.toString().trim() !== '' ? parseInt(quantity) : null;

    try {
      const result = await db.run(`
        INSERT INTO requisitions (
          user_id, user_name, department_id, department_name,
          requisition_date, request_type,
          materials, cost, quantity,
          purpose,
          period_from, period_to, leave_purpose,
          document_path, document_name,
          target_user_id, target_role,
          status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        req.user.id, userName, departmentId, departmentName,
        requisition_date, request_type,
        materials && materials.trim() !== '' ? materials : null,
        parsedCost,
        parsedQuantity,
        purpose && purpose.trim() !== '' ? purpose : null,
        period_from && period_from.trim() !== '' ? period_from : null,
        period_to && period_to.trim() !== '' ? period_to : null,
        leave_purpose && leave_purpose.trim() !== '' ? leave_purpose : null,
        document_path, document_name,
        cleanTargetUserId,
        cleanTargetRole,
        initialStatus
      ]);

      if (!result || !result.lastID) {
        throw new Error('Failed to insert requisition: No lastID returned');
      }

      const newRequisition = await db.get('SELECT * FROM requisitions WHERE id = ?', [result.lastID]);
      
      if (!newRequisition) {
        throw new Error('Failed to retrieve created requisition');
      }

      // Archive the document if uploaded
      if (document_path) {
        try {
          await archiveDocumentFromActivity(
            req.user.id,
            document_path,
            document_name,
            'requisition',
            newRequisition.id,
            `Requisition document: ${request_type.replace('_', ' ')} - ${userName}`,
            req.user.id
          );
        } catch (archiveError) {
          console.error('Error archiving requisition document:', archiveError);
          // Don't fail the request if archiving fails
        }
      }

    // Send real-time notifications
    try {
      // Notify creator
      await sendNotificationToUser(req.user.id, {
        title: 'Requisition Submitted',
        message: `Your ${request_type.replace('_', ' ')} requisition has been submitted successfully`,
        link: `/requisitions/${result.lastID}`,
        type: 'success',
        senderId: req.user.id
      });

      // Notify Department Head (for all requisitions)
      if (departmentId || departmentName) {
        let dept = null;
        if (departmentId) {
          dept = await db.get('SELECT manager_id, head_email, name FROM departments WHERE id = ?', [departmentId]);
        } else if (departmentName) {
          dept = await db.get('SELECT manager_id, head_email, name FROM departments WHERE LOWER(TRIM(name)) = ?', [departmentName.toLowerCase().trim()]);
        }
        
        let deptHeadId = dept?.manager_id;
        
        if (!deptHeadId && dept?.head_email) {
          const deptHead = await db.get(
            'SELECT id FROM users WHERE LOWER(TRIM(email)) = ?',
            [dept.head_email.toLowerCase().trim()]
          );
          if (deptHead) deptHeadId = deptHead.id;
        }
        
        if (deptHeadId) {
          await sendNotificationToUser(deptHeadId, {
            title: 'New Requisition for Approval',
            message: `${userName} from ${dept?.name || departmentName || 'your department'} has submitted a ${request_type.replace('_', ' ')} requisition that requires your approval`,
            link: `/requisitions/${result.lastID}`,
            type: 'info',
            senderId: req.user.id
          });
        } else {
          // If no department head found, notify Admin as fallback
          await sendNotificationToRole('Admin', {
            title: 'New Requisition (No Dept Head)',
            message: `${userName} has submitted a ${request_type.replace('_', ' ')} requisition but no department head was found`,
            link: `/requisitions/${result.lastID}`,
            type: 'warning',
            senderId: req.user.id
          });
        }
      } else {
        // If no department info, notify Admin directly
        await sendNotificationToRole('Admin', {
          title: 'New Requisition',
          message: `${userName} has submitted a ${request_type.replace('_', ' ')} requisition`,
          link: `/requisitions/${result.lastID}`,
          type: 'info',
          senderId: req.user.id
        });
      }
    } catch (notifError) {
      console.error('Error sending notifications:', notifError);
    }

      res.status(201).json({ 
        message: 'Requisition submitted successfully',
        requisition: newRequisition 
      });
    } catch (dbError) {
      console.error('Database error creating requisition:', dbError);
      // If file was uploaded but DB insert failed, clean up the file
      if (req.file) {
        const fs = require('fs');
        const path = require('path');
        const filePath = path.join(__dirname, '../../uploads/requisitions', req.file.filename);
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (unlinkError) {
          console.error('Error deleting uploaded file:', unlinkError);
        }
      }
      throw dbError;
    }
  } catch (error) {
    console.error('Create requisition error:', error);
    res.status(500).json({ 
      error: 'Failed to create requisition: ' + (error.message || 'Unknown error'),
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Update requisition (only creator, and only if not yet approved)
router.put('/:id', authenticateToken, upload.single('document'), async (req, res) => {
  try {
    const requisition = await db.get('SELECT * FROM requisitions WHERE id = ?', [req.params.id]);
    if (!requisition) {
      return res.status(404).json({ error: 'Requisition not found' });
    }

    // Only creator can update
    if (requisition.user_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only update your own requisitions' });
    }

    // Cannot update if already approved or rejected
    if (['Admin_Approved', 'Admin_Rejected', 'DeptHead_Approved'].includes(requisition.status)) {
      return res.status(400).json({ error: 'Cannot update requisition that has been approved or rejected' });
    }

    const {
      requisition_date,
      request_type,
      materials,
      cost,
      quantity,
      purpose,
      period_from,
      period_to,
      leave_purpose,
      target_user_id,
      target_role
    } = req.body;

    // Validation
    if (!requisition_date || !request_type) {
      return res.status(400).json({ error: 'Date and request type are required' });
    }

    // Validate request type
    const validRequestTypes = ['office_supplies', 'work_support', 'sick_leave', 'temporary_leave', 'vacation', 'annual_leave'];
    if (!validRequestTypes.includes(request_type)) {
      return res.status(400).json({ error: 'Invalid request type' });
    }

    // Get user info
    const user = await db.get('SELECT name FROM users WHERE id = ?', [req.user.id]);
    const userName = user?.name || req.user.name || req.user.email;

    // Get department info (same logic as create)
    let departmentId = null;
    let departmentName = null;
    if (req.user.role === 'Staff') {
      const staff = await db.get('SELECT department FROM staff WHERE user_id = ?', [req.user.id]);
      if (staff && staff.department) {
        const dept = await db.get('SELECT id, name FROM departments WHERE LOWER(TRIM(name)) = ?', [staff.department.toLowerCase().trim()]);
        if (dept) {
          departmentId = dept.id;
          departmentName = dept.name;
        } else {
          departmentName = staff.department;
        }
      }
    } else if (req.user.role === 'DepartmentHead') {
      const dept = await db.get(
        'SELECT id, name FROM departments WHERE manager_id = ? OR LOWER(TRIM(head_email)) = ?',
        [req.user.id, req.user.email.toLowerCase().trim()]
      );
      if (dept) {
        departmentId = dept.id;
        departmentName = dept.name;
      }
    }

    // Determine status (reset to initial status if updating - all go to Dept Head first)
    const newStatus = 'Pending_DeptHead';

    // Handle document upload
    let document_path = requisition.document_path;
    let document_name = requisition.document_name;
    
    if (req.file) {
      // Delete old document if exists
      if (requisition.document_path) {
        const oldFilePath = path.join(__dirname, '../..', requisition.document_path);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }
      document_path = `/uploads/requisitions/${req.file.filename}`;
      document_name = req.file.originalname;
    }

    // Clean up target_user_id and target_role
    const cleanTargetUserId = target_user_id && target_user_id.trim() !== '' ? parseInt(target_user_id) : null;
    const cleanTargetRole = target_role && target_role.trim() !== '' ? target_role : null;

    // Parse cost and quantity safely
    const parsedCost = cost && cost.toString().trim() !== '' ? parseFloat(cost) : null;
    const parsedQuantity = quantity && quantity.toString().trim() !== '' ? parseInt(quantity) : null;

    await db.run(`
      UPDATE requisitions SET
        user_name = ?,
        department_id = ?,
        department_name = ?,
        requisition_date = ?,
        request_type = ?,
        materials = ?,
        cost = ?,
        quantity = ?,
        purpose = ?,
        period_from = ?,
        period_to = ?,
        leave_purpose = ?,
        document_path = ?,
        document_name = ?,
        target_user_id = ?,
        target_role = ?,
        status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      userName, departmentId, departmentName,
      requisition_date, request_type,
      materials && materials.trim() !== '' ? materials : null,
      parsedCost,
      parsedQuantity,
      purpose && purpose.trim() !== '' ? purpose : null,
      period_from && period_from.trim() !== '' ? period_from : null,
      period_to && period_to.trim() !== '' ? period_to : null,
      leave_purpose && leave_purpose.trim() !== '' ? leave_purpose : null,
      document_path, document_name,
      cleanTargetUserId,
      cleanTargetRole,
      newStatus,
      req.params.id
    ]);

    const updated = await db.get('SELECT * FROM requisitions WHERE id = ?', [req.params.id]);

    // Archive the new document if uploaded during update
    if (req.file && document_path) {
      try {
        await archiveDocumentFromActivity(
          req.user.id,
          document_path,
          document_name,
          'requisition',
          updated.id,
          `Requisition document (updated): ${updated.request_type.replace('_', ' ')} - ${userName}`,
          req.user.id
        );
      } catch (archiveError) {
        console.error('Error archiving updated requisition document:', archiveError);
        // Don't fail the request if archiving fails
      }
    }

    res.json({ 
      message: 'Requisition updated successfully',
      requisition: updated 
    });
  } catch (error) {
    console.error('Update requisition error:', error);
    res.status(500).json({ error: 'Failed to update requisition: ' + error.message });
  }
});

// Department Head approval/rejection (for leave requests)
router.put('/:id/dept-head-review', authenticateToken, requireRole('DepartmentHead'), async (req, res) => {
  try {
    const { status, dept_head_notes } = req.body;

    if (!['DeptHead_Approved', 'DeptHead_Rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const requisition = await db.get('SELECT * FROM requisitions WHERE id = ?', [req.params.id]);
    if (!requisition) {
      return res.status(404).json({ error: 'Requisition not found' });
    }

    // Check if user is the department head for this requisition
    // Match by department_id or department_name
    let dept = null;
    if (requisition.department_id) {
      dept = await db.get(
        'SELECT id FROM departments WHERE (manager_id = ? OR LOWER(TRIM(head_email)) = ?) AND id = ?',
        [req.user.id, req.user.email.toLowerCase().trim(), requisition.department_id]
      );
    }
    
    // If not found by ID, try matching by department name
    if (!dept && requisition.department_name) {
      dept = await db.get(
        'SELECT id FROM departments WHERE (manager_id = ? OR LOWER(TRIM(head_email)) = ?) AND LOWER(TRIM(name)) = ?',
        [req.user.id, req.user.email.toLowerCase().trim(), requisition.department_name.toLowerCase().trim()]
      );
    }

    if (!dept) {
      return res.status(403).json({ error: 'You can only review requisitions from your department' });
    }

    if (requisition.status !== 'Pending_DeptHead') {
      return res.status(400).json({ error: 'Requisition is not pending department head review' });
    }

    const nextStatus = status === 'DeptHead_Approved' ? 'Pending_Admin' : 'DeptHead_Rejected';

    await db.run(`
      UPDATE requisitions SET
        status = ?,
        dept_head_reviewed_by = ?,
        dept_head_reviewed_at = CURRENT_TIMESTAMP,
        dept_head_notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [nextStatus, req.user.id, dept_head_notes || null, req.params.id]);

    const updated = await db.get('SELECT * FROM requisitions WHERE id = ?', [req.params.id]);

    // Send real-time notifications
    try {
      const creator = await db.get('SELECT id, name FROM users WHERE id = ?', [requisition.user_id]);
      const isApproved = status === 'DeptHead_Approved';
      
      // Notify creator
      if (creator) {
        await sendNotificationToUser(creator.id, {
          title: `Requisition ${isApproved ? 'Approved' : 'Rejected'}`,
          message: `Your ${requisition.request_type.replace('_', ' ')} requisition has been ${isApproved ? 'approved' : 'rejected'} by Department Head`,
          link: `/requisitions/${req.params.id}`,
          type: isApproved ? 'success' : 'warning',
          senderId: req.user.id
        });
      }

      // If approved, notify Admin
      if (isApproved) {
        await sendNotificationToRole('Admin', {
          title: 'Requisition Ready for Review',
          message: `A ${requisition.request_type.replace('_', ' ')} requisition has been approved by Department Head and requires your review`,
          link: `/requisitions/${req.params.id}`,
          type: 'info',
          senderId: req.user.id
        });
      }
    } catch (notifError) {
      console.error('Error sending notifications:', notifError);
    }

    res.json({ 
      message: `Requisition ${status === 'DeptHead_Approved' ? 'approved' : 'rejected'} by Department Head`,
      requisition: updated 
    });
  } catch (error) {
    console.error('Department head review error:', error);
    res.status(500).json({ error: 'Failed to review requisition: ' + error.message });
  }
});

// Admin approval/rejection (final approval)
router.put('/:id/admin-review', authenticateToken, requireRole('Admin'), async (req, res) => {
  try {
    const { status, admin_notes } = req.body;

    if (!['Admin_Approved', 'Admin_Rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const requisition = await db.get('SELECT * FROM requisitions WHERE id = ?', [req.params.id]);
    if (!requisition) {
      return res.status(404).json({ error: 'Requisition not found' });
    }

    // Require Department Head approval first for ALL requisitions
    if (requisition.status !== 'Pending_Admin') {
      return res.status(400).json({ error: 'Department Head must approve this requisition before Admin can review it' });
    }

    await db.run(`
      UPDATE requisitions SET
        status = ?,
        admin_reviewed_by = ?,
        admin_reviewed_at = CURRENT_TIMESTAMP,
        admin_notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [status, req.user.id, admin_notes || null, req.params.id]);

    const updated = await db.get('SELECT * FROM requisitions WHERE id = ?', [req.params.id]);

    // Send real-time notifications
    try {
      const creator = await db.get('SELECT id, name FROM users WHERE id = ?', [requisition.user_id]);
      const isApproved = status === 'Admin_Approved';
      
      // Notify creator
      if (creator) {
        await sendNotificationToUser(creator.id, {
          title: `Requisition ${isApproved ? 'Approved' : 'Rejected'}`,
          message: `Your ${requisition.request_type.replace('_', ' ')} requisition has been ${isApproved ? 'approved' : 'rejected'} by Admin`,
          link: `/requisitions/${req.params.id}`,
          type: isApproved ? 'success' : 'warning',
          senderId: req.user.id
        });
      }

      // If Department Head reviewed it, notify them too
      if (requisition.dept_head_reviewed_by) {
        await sendNotificationToUser(requisition.dept_head_reviewed_by, {
          title: `Requisition ${isApproved ? 'Approved' : 'Rejected'}`,
          message: `The ${requisition.request_type.replace('_', ' ')} requisition you reviewed has been ${isApproved ? 'approved' : 'rejected'} by Admin`,
          link: `/requisitions/${req.params.id}`,
          type: isApproved ? 'success' : 'info',
          senderId: req.user.id
        });
      }
    } catch (notifError) {
      console.error('Error sending notifications:', notifError);
    }

    res.json({ 
      message: `Requisition ${status === 'Admin_Approved' ? 'approved' : 'rejected'} by Admin`,
      requisition: updated 
    });
  } catch (error) {
    console.error('Admin review error:', error);
    res.status(500).json({ error: 'Failed to review requisition: ' + error.message });
  }
});

// Delete requisition (only creator or admin)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const requisition = await db.get('SELECT * FROM requisitions WHERE id = ?', [req.params.id]);
    if (!requisition) {
      return res.status(404).json({ error: 'Requisition not found' });
    }

    // Only creator or admin can delete
    if (requisition.user_id !== req.user.id && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'You can only delete your own requisitions' });
    }

    // Delete document if exists
    if (requisition.document_path) {
      const filePath = path.join(__dirname, '../..', requisition.document_path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await db.run('DELETE FROM requisitions WHERE id = ?', [req.params.id]);
    
    res.json({ message: 'Requisition deleted successfully' });
  } catch (error) {
    console.error('Delete requisition error:', error);
    res.status(500).json({ error: 'Failed to delete requisition: ' + error.message });
  }
});

module.exports = router;


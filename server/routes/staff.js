const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, requireRole, requirePermission } = require('../utils/auth');
const { logAction } = require('../utils/audit');
const { hashPassword } = require('../utils/auth');
const crypto = require('crypto');

// Generate unique staff ID
function generateStaffId() {
  return 'STF-' + Date.now().toString().slice(-8) + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();
}

// Get all staff (Admin can see all, Staff can see their own)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { department, employment_type, search } = req.query;
    let query = `
      SELECT s.*, u.name, u.email, u.phone, u.profile_image, u.is_active
      FROM staff s
      JOIN users u ON s.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (department) {
      query += ' AND s.department = ?';
      params.push(department);
    }
    if (employment_type) {
      query += ' AND s.employment_type = ?';
      params.push(employment_type);
    }
    if (search) {
      query += ' AND (u.name LIKE ? OR u.email LIKE ? OR s.staff_id LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // DepartmentHead can only see staff from their department
    if (req.user.role === 'DepartmentHead') {
      // Get department for this department head
      const dept = await db.get(
        'SELECT id, name FROM departments WHERE manager_id = ? OR LOWER(head_email) = ?',
        [req.user.id, req.user.email.toLowerCase()]
      );
      if (dept) {
        query += ' AND s.department = ?';
        params.push(dept.name);
      } else {
        // No department found, return empty
        return res.json({ staff: [] });
      }
    } else if (req.user.role === 'Staff') {
      // Staff can only see their own staff record
      query += ' AND s.user_id = ?';
      params.push(req.user.id);
    } else if (req.user.role !== 'Admin') {
      // Other roles cannot access
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    query += ' ORDER BY s.created_at DESC';

    const staff = await db.all(query, params);
    res.json({ staff });
  } catch (error) {
    console.error('Get staff error:', error);
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
});

// Get single staff member
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const staffId = req.params.id;

    const staff = await db.get(
      `SELECT s.*, u.name, u.email, u.phone, u.profile_image, u.is_active, u.created_at as user_created_at
       FROM staff s
       JOIN users u ON s.user_id = u.id
       WHERE s.id = ? OR s.staff_id = ?`,
      [staffId, staffId]
    );

    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    // Check permissions - Admin can see all, Staff can see themselves
    if (req.user.role !== 'Admin' && staff.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    res.json({ staff });
  } catch (error) {
    console.error('Get staff error:', error);
    res.status(500).json({ error: 'Failed to fetch staff member' });
  }
});

// Create staff member (Admin only)
router.post('/', authenticateToken, requireRole('Admin'), [
  body('email').isEmail().normalizeEmail(),
  body('name').trim().notEmpty(),
  body('employment_type').isIn(['Full-time', 'Part-time', 'Internship']),
  body('position').trim().notEmpty(),
  body('department').trim().notEmpty(),
  body('base_salary')
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => {
      if (value === '' || value === null || value === undefined) {
        return true; // Allow empty values
      }
      const num = parseFloat(value);
      return !isNaN(num) && num >= 0;
    })
    .withMessage('Base salary must be a valid number >= 0')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('Validation errors:', errors.array());
      return res.status(400).json({ 
        error: 'Validation failed',
        errors: errors.array() 
      });
    }

    const {
      email, name, username, phone, employment_type, position, department,
      employment_date, base_salary, bonus_structure, emergency_contact_name,
      emergency_contact_phone, address, password, profile_image,
      // New comprehensive fields
      date_of_birth, place_of_birth, nationality, gender, marital_status,
      national_id, tax_id, bank_name, bank_account_number, bank_branch,
      next_of_kin_name, next_of_kin_relationship, next_of_kin_phone, next_of_kin_address,
      qualifications, previous_employment, references, notes
    } = req.body;

    // Convert base_salary to number if it's a string, or null if empty
    const baseSalaryValue = base_salary === '' || base_salary === null || base_salary === undefined 
      ? null 
      : parseFloat(base_salary);

    // Check if user exists
    const existingUser = await db.get('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Password is required when creating staff (admin creates it)
    if (!password) {
      return res.status(400).json({ error: 'Password is required. Admin must create a password for staff login.' });
    }
    const passwordHash = await hashPassword(password);

    // Create user
    const userResult = await db.run(
      `INSERT INTO users (email, username, password_hash, role, name, phone, profile_image, is_active, email_verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1)`,
      [email, username || email.split('@')[0], passwordHash, 'Staff', name, phone || null, profile_image || null]
    );

    // Generate staff ID
    const staffId = generateStaffId();

    // Parse JSON fields if they're strings
    let qualificationsData = qualifications;
    let previousEmploymentData = previous_employment;
    let referencesData = references;
    
    if (typeof qualifications === 'string' && qualifications.trim()) {
      try {
        qualificationsData = qualifications.trim().startsWith('[') 
          ? qualifications 
          : JSON.stringify(qualifications.split(',').map(q => q.trim()));
      } catch (e) {
        qualificationsData = JSON.stringify([qualifications]);
      }
    } else if (!qualificationsData) {
      qualificationsData = null;
    }
    
    if (typeof previous_employment === 'string' && previous_employment.trim()) {
      try {
        previousEmploymentData = previous_employment.trim().startsWith('[')
          ? previous_employment
          : JSON.stringify(previous_employment.split(',').map(e => e.trim()));
      } catch (e) {
        previousEmploymentData = JSON.stringify([previous_employment]);
      }
    } else if (!previousEmploymentData) {
      previousEmploymentData = null;
    }
    
    if (typeof references === 'string' && references.trim()) {
      try {
        referencesData = references.trim().startsWith('[')
          ? references
          : JSON.stringify(references.split(',').map(r => r.trim()));
      } catch (e) {
        referencesData = JSON.stringify([references]);
      }
    } else if (!referencesData) {
      referencesData = null;
    }

    // Create staff record with all new fields
    // Note: 'references' is a reserved keyword in SQL, so we need to escape it with square brackets for SQLite
    let staffResult;
    try {
      staffResult = await db.run(
        `INSERT INTO staff (user_id, staff_id, employment_type, position, department, employment_date,
          base_salary, bonus_structure, emergency_contact_name, emergency_contact_phone, address,
          date_of_birth, place_of_birth, nationality, gender, marital_status, national_id, tax_id,
          bank_name, bank_account_number, bank_branch, next_of_kin_name, next_of_kin_relationship,
          next_of_kin_phone, next_of_kin_address, qualifications, previous_employment, [references], notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userResult.lastID, staffId, employment_type, position, department,
          employment_date || new Date().toISOString().split('T')[0],
          baseSalaryValue, bonus_structure || null, emergency_contact_name || null,
          emergency_contact_phone || null, address || null,
          date_of_birth || null, place_of_birth || null, nationality || null,
          gender || null, marital_status || null, national_id || null, tax_id || null,
          bank_name || null, bank_account_number || null, bank_branch || null,
          next_of_kin_name || null, next_of_kin_relationship || null,
          next_of_kin_phone || null, next_of_kin_address || null,
          qualificationsData, previousEmploymentData, referencesData, notes || null
        ]
      );

      // Force checkpoint to ensure data is persisted immediately
      if (db.db) {
        await new Promise((resolve) => {
          db.db.run('PRAGMA wal_checkpoint(TRUNCATE)', (err) => {
            if (err && !err.message.includes('database is locked')) {
              console.warn('Checkpoint warning after staff creation:', err.message);
            }
            resolve();
          });
        });
      }

      await logAction(req.user.id, 'create_staff', 'staff', staffResult.lastID, { staffId, email }, req);

      res.status(201).json({
        message: 'Staff member created successfully',
        staff: { id: staffResult.lastID, staff_id: staffId, user_id: userResult.lastID }
      });
    } catch (staffError) {
      // If staff record creation fails, we should rollback the user creation
      console.error('Failed to create staff record after user creation:', staffError);
      console.error('Staff creation error details:', {
        message: staffError.message,
        code: staffError.code,
        errno: staffError.errno,
        sql: staffError.sql
      });
      // Try to delete the user that was created
      try {
        await db.run('DELETE FROM users WHERE id = ?', [userResult.lastID]);
        console.log('Rolled back user creation due to staff record creation failure');
      } catch (deleteError) {
        console.error('Failed to rollback user creation:', deleteError);
      }
      throw staffError; // Re-throw to be caught by outer catch
    }
  } catch (error) {
    console.error('Create staff error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      stack: error.stack?.split('\n').slice(0, 5).join('\n')
    });
    res.status(500).json({ 
      error: 'Failed to create staff member: ' + error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack?.split('\n').slice(0, 3).join('\n') : undefined
    });
  }
});

// Update staff member
router.put('/:id', authenticateToken, requireRole('Admin'), async (req, res) => {
  try {
    const staffId = req.params.id;
    const updates = req.body;

    // Get staff record
    const staff = await db.get('SELECT user_id FROM staff WHERE id = ?', [staffId]);
    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    // Update user info if provided
    if (updates.name || updates.phone || updates.profile_image !== undefined) {
      const userUpdates = [];
      const userParams = [];
      if (updates.name) {
        userUpdates.push('name = ?');
        userParams.push(updates.name);
      }
      if (updates.phone) {
        userUpdates.push('phone = ?');
        userParams.push(updates.phone);
      }
      if (updates.profile_image !== undefined) {
        userUpdates.push('profile_image = ?');
        userParams.push(updates.profile_image);
      }
      if (userUpdates.length > 0) {
        userParams.push(staff.user_id);
        await db.run(`UPDATE users SET ${userUpdates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, userParams);
      }
    }

    // Update staff info
    const staffUpdates = [];
    const staffParams = [];
    const allowedFields = [
      'employment_type', 'position', 'department', 'employment_date',
      'base_salary', 'bonus_structure', 'emergency_contact_name', 'emergency_contact_phone', 'address',
      'date_of_birth', 'place_of_birth', 'nationality', 'gender', 'marital_status',
      'national_id', 'tax_id', 'bank_name', 'bank_account_number', 'bank_branch',
      'next_of_kin_name', 'next_of_kin_relationship', 'next_of_kin_phone', 'next_of_kin_address',
      'qualifications', 'previous_employment', 'references', 'notes'
    ];

    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        // Handle JSON fields
        let value = updates[field];
        if ((field === 'qualifications' || field === 'previous_employment' || field === 'references') && typeof value === 'string' && value.trim()) {
          try {
            value = value.trim().startsWith('[') 
              ? value 
              : JSON.stringify(value.split(',').map(item => item.trim()));
          } catch (e) {
            value = JSON.stringify([value]);
          }
        }
        // Escape 'references' as it's a reserved keyword in SQL (use square brackets for SQLite)
        const fieldName = field === 'references' ? '[references]' : field;
        staffUpdates.push(`${fieldName} = ?`);
        staffParams.push(value || null);
      }
    });

    if (staffUpdates.length > 0) {
      staffParams.push(staffId);
      await db.run(`UPDATE staff SET ${staffUpdates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, staffParams);
    }

    await logAction(req.user.id, 'update_staff', 'staff', staffId, updates, req);

    res.json({ message: 'Staff member updated successfully' });
  } catch (error) {
    console.error('Update staff error:', error);
    res.status(500).json({ error: 'Failed to update staff member' });
  }
});

// Delete staff member (Admin only)
router.delete('/:id', authenticateToken, requireRole('Admin'), async (req, res) => {
  try {
    const staffId = req.params.id;

    const staff = await db.get('SELECT user_id FROM staff WHERE id = ?', [staffId]);
    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    // Delete staff (cascade will delete user)
    await db.run('DELETE FROM staff WHERE id = ?', [staffId]);

    await logAction(req.user.id, 'delete_staff', 'staff', staffId, {}, req);

    res.json({ message: 'Staff member deleted successfully' });
  } catch (error) {
    console.error('Delete staff error:', error);
    res.status(500).json({ error: 'Failed to delete staff member' });
  }
});

// Get performance reviews for a staff member
router.get('/:id/reviews', authenticateToken, async (req, res) => {
  try {
    const staffId = req.params.id;

    const reviews = await db.all(
      `SELECT pr.*, u.name as reviewer_name
       FROM performance_reviews pr
       LEFT JOIN users u ON pr.reviewer_id = u.id
       WHERE pr.staff_id = ?
       ORDER BY pr.review_date DESC`,
      [staffId]
    );

    res.json({ reviews });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// Add performance review
router.post('/:id/reviews', authenticateToken, requireRole('Admin'), [
  body('rating').isInt({ min: 1, max: 5 }),
  body('comments').trim().notEmpty()
], async (req, res) => {
  try {
    const { rating, comments, goals } = req.body;
    const staffId = req.params.id;

    const result = await db.run(
      `INSERT INTO performance_reviews (staff_id, reviewer_id, rating, comments, goals)
       VALUES (?, ?, ?, ?, ?)`,
      [staffId, req.user.id, rating, comments, goals ? JSON.stringify(goals) : null]
    );

    await logAction(req.user.id, 'create_review', 'staff', staffId, { rating }, req);

    res.status(201).json({ message: 'Performance review added', reviewId: result.lastID });
  } catch (error) {
    console.error('Add review error:', error);
    res.status(500).json({ error: 'Failed to add review' });
  }
});

// Get leave requests for staff
router.get('/:id/leaves', authenticateToken, async (req, res) => {
  try {
    const staffId = req.params.id;

    const leaves = await db.all(
      `SELECT lr.*, u.name as approver_name
       FROM leave_requests lr
       LEFT JOIN users u ON lr.approved_by = u.id
       WHERE lr.staff_id = ?
       ORDER BY lr.created_at DESC`,
      [staffId]
    );

    res.json({ leaves });
  } catch (error) {
    console.error('Get leaves error:', error);
    res.status(500).json({ error: 'Failed to fetch leave requests' });
  }
});

// Create leave request
router.post('/:id/leaves', authenticateToken, [
  body('leave_type').isIn(['Sick', 'Vacation', 'Personal', 'Emergency']),
  body('start_date').isISO8601(),
  body('end_date').isISO8601(),
  body('reason').trim().notEmpty()
], async (req, res) => {
  try {
    const { leave_type, start_date, end_date, reason } = req.body;
    const staffId = req.params.id;

    // Calculate days
    const start = new Date(start_date);
    const end = new Date(end_date);
    const daysRequested = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    const result = await db.run(
      `INSERT INTO leave_requests (staff_id, leave_type, start_date, end_date, days_requested, reason)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [staffId, leave_type, start_date, end_date, daysRequested, reason]
    );

    await logAction(req.user.id, 'create_leave_request', 'staff', staffId, { leave_type, daysRequested }, req);

    res.status(201).json({ message: 'Leave request submitted', leaveId: result.lastID });
  } catch (error) {
    console.error('Create leave error:', error);
    res.status(500).json({ error: 'Failed to submit leave request' });
  }
});

// Approve/reject leave request (Admin only)
router.put('/leaves/:leaveId', authenticateToken, requireRole('Admin'), [
  body('status').isIn(['Approved', 'Rejected'])
], async (req, res) => {
  try {
    const { status, comments } = req.body;
    const leaveId = req.params.leaveId;

    await db.run(
      `UPDATE leave_requests 
       SET status = ?, approved_by = ?, approval_date = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [status, req.user.id, leaveId]
    );

    await logAction(req.user.id, 'update_leave', 'staff', leaveId, { status }, req);

    res.json({ message: `Leave request ${status.toLowerCase()}` });
  } catch (error) {
    console.error('Update leave error:', error);
    res.status(500).json({ error: 'Failed to update leave request' });
  }
});

module.exports = router;


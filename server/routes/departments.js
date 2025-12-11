const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, requireRole, hashPassword } = require('../utils/auth');
const { logAction } = require('../utils/audit');

// Get all departments
router.get('/', authenticateToken, async (req, res) => {
  try {
    const departments = await db.all(
      `SELECT d.*, u.id as manager_id 
       FROM departments d 
       LEFT JOIN users u ON d.head_email = u.email 
       ORDER BY d.name ASC`
    );
    res.json({ departments });
  } catch (error) {
    console.error('Get departments error:', error);
    // Handle missing table gracefully
    if (error.message && error.message.includes('no such table')) {
      console.warn('departments table does not exist yet');
      return res.json({ departments: [] });
    }
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

// Get single department
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const department = await db.get(
      'SELECT * FROM departments WHERE id = ?',
      [req.params.id]
    );

    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }

    res.json({ department });
  } catch (error) {
    console.error('Get department error:', error);
    // Handle missing table gracefully
    if (error.message && error.message.includes('no such table')) {
      console.warn('departments table does not exist yet');
      return res.status(404).json({ error: 'Department not found' });
    }
    res.status(500).json({ error: 'Failed to fetch department' });
  }
});

// Create department (Admin only)
router.post('/', authenticateToken, requireRole('Admin'), [
  body('name').trim().notEmpty().withMessage('Department name is required'),
  body('description').optional().trim(),
  body('head_name').trim().notEmpty().withMessage('Department head name is required'),
  body('head_email').isEmail().normalizeEmail().withMessage('Valid department head email is required'),
  body('head_phone').optional().trim(),
  body('head_password').trim().isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, head_name, head_email, head_phone, head_password } = req.body;

    // Normalize email to lowercase for consistency
    const normalizedEmail = head_email.toLowerCase().trim();

    // Check if department already exists
    const existing = await db.get('SELECT id FROM departments WHERE name = ?', [name]);
    if (existing) {
      return res.status(400).json({ error: 'Department with this name already exists' });
    }

    // Check if user with this email already exists (case-insensitive)
    const existingUser = await db.get('SELECT id FROM users WHERE LOWER(TRIM(email)) = ?', [normalizedEmail]);
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Create user account for department head
    const passwordToUse = head_password || 'DeptHead@123';
    console.log('Hashing password for department head...');
    const passwordHash = await hashPassword(passwordToUse);
    
    if (!passwordHash) {
      throw new Error('Failed to hash password');
    }
    
    console.log('Password hash created:', passwordHash.substring(0, 20) + '...');
    
    const username = normalizedEmail.split('@')[0];
    
    console.log('Creating department head user:', {
      email: normalizedEmail,
      username: username,
      name: head_name,
      role: 'DepartmentHead',
      passwordHashLength: passwordHash.length
    });
    
    const userResult = await db.run(
      `INSERT INTO users (email, username, password_hash, role, name, phone, is_active, email_verified)
       VALUES (?, ?, ?, ?, ?, ?, 1, 1)`,
      [normalizedEmail, username, passwordHash, 'DepartmentHead', head_name, head_phone || null]
    );
    
    // Verify the user was created correctly
    const createdUser = await db.get(
      'SELECT id, email, password_hash, role, is_active FROM users WHERE id = ?',
      [userResult.lastID]
    );
    
    console.log('Department head user created:', {
      userId: userResult.lastID,
      email: normalizedEmail,
      passwordHashExists: !!createdUser.password_hash,
      passwordHashLength: createdUser.password_hash?.length,
      isActive: createdUser.is_active,
      role: createdUser.role
    });
    
    if (!createdUser.password_hash) {
      throw new Error('Password hash was not saved correctly');
    }

    // Create department
    const result = await db.run(
      `INSERT INTO departments (name, description, head_name, head_email, head_phone, manager_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, description || null, head_name, normalizedEmail, head_phone || null, userResult.lastID]
    );

    await logAction(req.user.id, 'create_department', 'departments', result.lastID, { name, head_name, head_email }, req);

    // Fetch the created department to return full details
    const createdDept = await db.get('SELECT * FROM departments WHERE id = ?', [result.lastID]);

    res.status(201).json({
      message: 'Department created successfully',
      department: createdDept,
      headUser: {
        id: userResult.lastID,
        email: normalizedEmail,
        username: username
      }
    });
  } catch (error) {
    console.error('Create department error:', error);
    res.status(500).json({ error: 'Failed to create department: ' + error.message });
  }
});

// Update department (Admin only)
router.put('/:id', authenticateToken, requireRole('Admin'), async (req, res) => {
  try {
    const { name, description, head_name, head_email, head_phone, head_password } = req.body;
    const departmentId = req.params.id;

    const department = await db.get('SELECT * FROM departments WHERE id = ?', [departmentId]);
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }

    // Check if name is being changed and if it conflicts
    if (name) {
      const existing = await db.get('SELECT id FROM departments WHERE name = ? AND id != ?', [name, departmentId]);
      if (existing) {
        return res.status(400).json({ error: 'Department with this name already exists' });
      }
    }

    // Check if email is being changed and if it conflicts (case-insensitive)
    if (head_email && head_email.toLowerCase().trim() !== department.head_email?.toLowerCase().trim()) {
      const normalizedHeadEmail = head_email.toLowerCase().trim();
      const existingUser = await db.get('SELECT id FROM users WHERE LOWER(TRIM(email)) = ? AND id != ?', [normalizedHeadEmail, department.manager_id]);
      if (existingUser) {
        return res.status(400).json({ error: 'User with this email already exists' });
      }
    }

    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (head_name !== undefined) {
      updates.push('head_name = ?');
      params.push(head_name);
    }
    if (head_email !== undefined) {
      const normalizedHeadEmail = head_email.toLowerCase().trim();
      updates.push('head_email = ?');
      params.push(normalizedHeadEmail);
    }
    if (head_phone !== undefined) {
      updates.push('head_phone = ?');
      params.push(head_phone);
    }

    // Update department head user account if needed
    if (department.manager_id && (head_name || head_email || head_phone || head_password)) {
      const userUpdates = [];
      const userParams = [];
      
      if (head_name) {
        userUpdates.push('name = ?');
        userParams.push(head_name);
      }
      if (head_email) {
        const normalizedHeadEmail = head_email.toLowerCase().trim();
        userUpdates.push('email = ?');
        userParams.push(normalizedHeadEmail);
        userUpdates.push('username = ?');
        userParams.push(normalizedHeadEmail.split('@')[0]);
      }
      if (head_phone) {
        userUpdates.push('phone = ?');
        userParams.push(head_phone);
      }
      if (head_password) {
        const passwordHash = await hashPassword(head_password);
        userUpdates.push('password_hash = ?');
        userParams.push(passwordHash);
      }
      
      if (userUpdates.length > 0) {
        userParams.push(department.manager_id);
        await db.run(`UPDATE users SET ${userUpdates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, userParams);
      }
    }

    if (updates.length > 0) {
      params.push(departmentId);
      await db.run(
        `UPDATE departments SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        params
      );
    }

    await logAction(req.user.id, 'update_department', 'departments', departmentId, req.body, req);

    res.json({ message: 'Department updated successfully' });
  } catch (error) {
    console.error('Update department error:', error);
    res.status(500).json({ error: 'Failed to update department' });
  }
});

// Delete department (Admin only)
router.delete('/:id', authenticateToken, requireRole('Admin'), async (req, res) => {
  try {
    const departmentId = req.params.id;

    const department = await db.get('SELECT id FROM departments WHERE id = ?', [departmentId]);
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }

    // Check if department has staff assigned
    const staffCount = await db.get('SELECT COUNT(*) as count FROM staff WHERE department = ?', [department.name]);
    if (staffCount.count > 0) {
      return res.status(400).json({ error: 'Cannot delete department with assigned staff members' });
    }

    await db.run('DELETE FROM departments WHERE id = ?', [departmentId]);

    await logAction(req.user.id, 'delete_department', 'departments', departmentId, {}, req);

    res.json({ message: 'Department deleted successfully' });
  } catch (error) {
    console.error('Delete department error:', error);
    res.status(500).json({ error: 'Failed to delete department' });
  }
});

module.exports = router;


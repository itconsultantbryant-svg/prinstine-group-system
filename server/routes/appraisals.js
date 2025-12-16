const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, requireRole } = require('../utils/auth');
const { logAction } = require('../utils/audit');

/**
 * Helper function to calculate and update user appraisal summary
 */
async function updateUserAppraisalSummary(userId) {
  try {
    // Get all appraisals for this user
    const appraisals = await db.all(
      'SELECT grade_level_appraise, grade_level_management FROM appraisals WHERE staff_id = ?',
      [userId]
    );

    if (appraisals.length === 0) {
      // Remove summary if no appraisals
      await db.run('DELETE FROM user_appraisal_summary WHERE user_id = ?', [userId]);
      return;
    }

    // Calculate averages
    const totalAppraisals = appraisals.length;
    const sumAppraise = appraisals.reduce((sum, a) => sum + (parseInt(a.grade_level_appraise) || 0), 0);
    const sumManagement = appraisals.reduce((sum, a) => sum + (parseInt(a.grade_level_management) || 0), 0);
    const avgAppraise = sumAppraise / totalAppraisals;
    const avgManagement = sumManagement / totalAppraisals;
    const overallGrade = (avgAppraise + avgManagement) / 2;

    // Update or insert summary
    const existing = await db.get('SELECT id FROM user_appraisal_summary WHERE user_id = ?', [userId]);
    if (existing) {
      await db.run(
        `UPDATE user_appraisal_summary 
         SET total_appraisals = ?, 
             average_grade_appraise = ?,
             average_grade_management = ?,
             overall_grade_level = ?,
             last_updated = CURRENT_TIMESTAMP
         WHERE user_id = ?`,
        [totalAppraisals, avgAppraise, avgManagement, overallGrade, userId]
      );
    } else {
      await db.run(
        `INSERT INTO user_appraisal_summary 
         (user_id, total_appraisals, average_grade_appraise, average_grade_management, overall_grade_level)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, totalAppraisals, avgAppraise, avgManagement, overallGrade]
      );
    }

    console.log(`[updateUserAppraisalSummary] Updated summary for user ${userId}:`, {
      total_appraisals: totalAppraisals,
      avg_appraise: avgAppraise.toFixed(2),
      avg_management: avgManagement.toFixed(2),
      overall_grade: overallGrade.toFixed(2)
    });
  } catch (error) {
    console.error('Error updating user appraisal summary:', error);
  }
}

/**
 * GET /api/appraisals
 * Get all appraisals
 * - Admin: sees all appraisals
 * - Others: see appraisals they created or received
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT a.*,
             staff.name as staff_full_name,
             staff.email as staff_email,
             appraised_by.name as appraised_by_full_name,
             appraised_by.email as appraised_by_email
      FROM appraisals a
      LEFT JOIN users staff ON a.staff_id = staff.id
      LEFT JOIN users appraised_by ON a.appraised_by_user_id = appraised_by.id
      WHERE 1=1
    `;
    const params = [];

    // Role-based filtering
    if (req.user.role === 'Admin') {
      // Admin sees all
    } else {
      // Others see appraisals they created or received
      query += ' AND (a.appraised_by_user_id = ? OR a.staff_id = ?)';
      params.push(req.user.id, req.user.id);
    }

    query += ' ORDER BY a.created_at DESC';

    const appraisals = await db.all(query, params);
    res.json({ appraisals });
  } catch (error) {
    console.error('Get appraisals error:', error);
    res.status(500).json({ error: 'Failed to fetch appraisals' });
  }
});

/**
 * GET /api/appraisals/summary
 * Get appraisal summary (grade levels for all users)
 * - Admin only
 */
router.get('/summary', authenticateToken, requireRole('Admin'), async (req, res) => {
  try {
    const summaries = await db.all(`
      SELECT uas.*,
             u.name as user_name,
             u.email as user_email,
             u.role as user_role
      FROM user_appraisal_summary uas
      JOIN users u ON uas.user_id = u.id
      ORDER BY uas.overall_grade_level DESC, u.name
    `);

    res.json({ summaries });
  } catch (error) {
    console.error('Get appraisal summary error:', error);
    res.status(500).json({ error: 'Failed to fetch appraisal summary' });
  }
});

/**
 * GET /api/appraisals/my-history
 * Get current user's appraisal history (both given and received)
 */
router.get('/my-history', authenticateToken, async (req, res) => {
  try {
    const appraisals = await db.all(`
      SELECT a.*,
             staff.name as staff_full_name,
             staff.email as staff_email,
             appraised_by.name as appraised_by_full_name,
             appraised_by.email as appraised_by_email,
             CASE 
               WHEN a.staff_id = ? THEN 'received'
               WHEN a.appraised_by_user_id = ? THEN 'given'
               ELSE 'other'
             END as appraisal_type
      FROM appraisals a
      LEFT JOIN users staff ON a.staff_id = staff.id
      LEFT JOIN users appraised_by ON a.appraised_by_user_id = appraised_by.id
      WHERE a.staff_id = ? OR a.appraised_by_user_id = ?
      ORDER BY a.created_at DESC
    `, [req.user.id, req.user.id, req.user.id, req.user.id]);

    res.json({ appraisals });
  } catch (error) {
    console.error('Get my appraisal history error:', error);
    res.status(500).json({ error: 'Failed to fetch appraisal history' });
  }
});

/**
 * GET /api/appraisals/staff
 * Get all staff for selection in appraisal form
 */
router.get('/staff', authenticateToken, async (req, res) => {
  try {
    const staff = await db.all(`
      SELECT u.id as user_id, u.name, u.email, u.role,
             s.id as staff_id, s.department,
             d.id as department_id, d.name as department_name
      FROM users u
      LEFT JOIN staff s ON u.id = s.user_id
      LEFT JOIN departments d ON s.department_id = d.id OR d.manager_id = u.id
      WHERE u.role IN ('Staff', 'DepartmentHead')
        AND u.is_active = 1
      ORDER BY u.name
    `);

    res.json({ staff });
  } catch (error) {
    console.error('Get staff for appraisal error:', error);
    res.status(500).json({ error: 'Failed to fetch staff list' });
  }
});

/**
 * GET /api/appraisals/departments/:departmentId/staff
 * Get department head and staff within a department
 */
router.get('/departments/:departmentId/staff', authenticateToken, async (req, res) => {
  try {
    const { departmentId } = req.params;

    // Get department head
    const department = await db.get(
      'SELECT d.*, u.name as head_name, u.email as head_email FROM departments d LEFT JOIN users u ON d.manager_id = u.id WHERE d.id = ?',
      [departmentId]
    );

    // Get staff in this department
    const staff = await db.all(`
      SELECT u.id as user_id, u.name, u.email,
             s.id as staff_id, s.staff_id as staff_number
      FROM staff s
      JOIN users u ON s.user_id = u.id
      WHERE s.department_id = ? AND u.is_active = 1
      ORDER BY u.name
    `, [departmentId]);

    const result = {
      department_head: department ? {
        user_id: department.manager_id,
        name: department.head_name,
        email: department.head_email,
        role: 'DepartmentHead'
      } : null,
      staff: staff.map(s => ({
        user_id: s.user_id,
        name: s.name,
        email: s.email,
        staff_id: s.staff_number,
        role: 'Staff'
      }))
    };

    res.json(result);
  } catch (error) {
    console.error('Get department staff error:', error);
    res.status(500).json({ error: 'Failed to fetch department staff' });
  }
});

/**
 * POST /api/appraisals
 * Create new appraisal
 * - All authenticated users can create appraisals
 */
router.post('/', authenticateToken, [
  body('staff_id').isInt().withMessage('Staff selection is required'),
  body('department_id').optional().isInt(),
  body('department_name').trim().notEmpty().withMessage('Department is required'),
  body('appraised_by_user_id').isInt().withMessage('Appraised by selection is required'),
  body('appraised_by_name').trim().notEmpty().withMessage('Appraised by name is required'),
  body('grade_level_appraise').isInt({ min: 1, max: 3 }).withMessage('Grade level (Appraise) must be 1, 2, or 3'),
  body('grade_level_management').isInt({ min: 1, max: 3 }).withMessage('Grade level (Management) must be 1, 2, or 3'),
  body('comment_appraise').optional().trim(),
  body('comment_management').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed',
        errors: errors.array() 
      });
    }

    const {
      staff_id,
      department_id,
      department_name,
      appraised_by_user_id,
      appraised_by_name,
      grade_level_appraise,
      grade_level_management,
      comment_appraise,
      comment_management
    } = req.body;

    // Validate required fields
    if (!staff_id || !appraised_by_user_id) {
      return res.status(400).json({ error: 'Staff ID and appraised by user ID are required' });
    }

    // Get staff details
    const staff = await db.get('SELECT id, name, email, is_active FROM users WHERE id = ?', [staff_id]);
    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }
    if (!staff.is_active) {
      return res.status(400).json({ error: 'Cannot create appraisal for inactive staff member' });
    }

    // Get appraised_by user details
    const appraisedBy = await db.get('SELECT id, name, email, role, is_active FROM users WHERE id = ?', [appraised_by_user_id]);
    if (!appraisedBy) {
      return res.status(404).json({ error: 'Appraised by user not found' });
    }
    if (!appraisedBy.is_active) {
      return res.status(400).json({ error: 'Cannot create appraisal with inactive user as appraiser' });
    }

    // Validate grade levels
    const gradeAppraise = parseInt(grade_level_appraise);
    const gradeManagement = parseInt(grade_level_management);
    if (isNaN(gradeAppraise) || gradeAppraise < 1 || gradeAppraise > 3) {
      return res.status(400).json({ error: 'Invalid grade level (Appraise). Must be 1, 2, or 3.' });
    }
    if (isNaN(gradeManagement) || gradeManagement < 1 || gradeManagement > 3) {
      return res.status(400).json({ error: 'Invalid grade level (Management). Must be 1, 2, or 3.' });
    }

    // Create appraisal
    const result = await db.run(
      `INSERT INTO appraisals 
       (staff_id, staff_name, department_id, department_name, 
        appraised_by_user_id, appraised_by_name, appraised_by_role,
        grade_level_appraise, grade_level_management,
        comment_appraise, comment_management)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        staff_id,
        staff.name,
        department_id || null,
        department_name,
        appraised_by_user_id,
        appraised_by_name,
        appraisedBy.role,
        parseInt(grade_level_appraise),
        parseInt(grade_level_management),
        comment_appraise || null,
        comment_management || null
      ]
    );

    const appraisalId = result.lastID || result.id;

    // Update user appraisal summary for the staff member
    await updateUserAppraisalSummary(staff_id);

    await logAction(req.user.id, 'create_appraisal', 'appraisals', appraisalId, {
      staff_id,
      appraised_by_user_id,
      grade_level_appraise,
      grade_level_management
    }, req);

    // Get created appraisal with full details
    const createdAppraisal = await db.get(`
      SELECT a.*,
             staff.name as staff_full_name,
             staff.email as staff_email,
             appraised_by.name as appraised_by_full_name,
             appraised_by.email as appraised_by_email
      FROM appraisals a
      LEFT JOIN users staff ON a.staff_id = staff.id
      LEFT JOIN users appraised_by ON a.appraised_by_user_id = appraised_by.id
      WHERE a.id = ?
    `, [appraisalId]);

    // Emit real-time events
    if (global.io) {
      // Notify the staff member who received the appraisal
      global.io.emit('appraisal_received', {
        id: appraisalId,
        staff_id,
        staff_name: staff.name,
        appraised_by_user_id,
        appraised_by_name: appraised_by_name,
        grade_level_appraise,
        grade_level_management,
        created_at: createdAppraisal.created_at
      });

      // Notify all admins
      global.io.emit('appraisal_created', {
        id: appraisalId,
        ...createdAppraisal
      });

      // Notify the user who created it
      global.io.emit('appraisal_added_to_history', {
        id: appraisalId,
        staff_id,
        staff_name: staff.name,
        appraised_by_user_id,
        appraised_by_name: appraised_by_name
      });
    }

    res.status(201).json({
      message: 'Appraisal created successfully',
      appraisal: createdAppraisal
    });
  } catch (error) {
    console.error('Create appraisal error:', error);
    res.status(500).json({ error: 'Failed to create appraisal: ' + error.message });
  }
});

/**
 * GET /api/appraisals/:id
 * Get single appraisal
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const appraisal = await db.get(`
      SELECT a.*,
             staff.name as staff_full_name,
             staff.email as staff_email,
             appraised_by.name as appraised_by_full_name,
             appraised_by.email as appraised_by_email
      FROM appraisals a
      LEFT JOIN users staff ON a.staff_id = staff.id
      LEFT JOIN users appraised_by ON a.appraised_by_user_id = appraised_by.id
      WHERE a.id = ?
    `, [req.params.id]);

    if (!appraisal) {
      return res.status(404).json({ error: 'Appraisal not found' });
    }

    // Check permissions
    if (req.user.role !== 'Admin' && 
        appraisal.staff_id !== req.user.id && 
        appraisal.appraised_by_user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ appraisal });
  } catch (error) {
    console.error('Get appraisal error:', error);
    res.status(500).json({ error: 'Failed to fetch appraisal' });
  }
});

/**
 * PUT /api/appraisals/:id
 * Update appraisal (only by creator)
 */
router.put('/:id', authenticateToken, [
  body('grade_level_appraise').optional().isInt({ min: 1, max: 3 }).withMessage('Grade level (Appraise) must be 1, 2, or 3'),
  body('grade_level_management').optional().isInt({ min: 1, max: 3 }).withMessage('Grade level (Management) must be 1, 2, or 3'),
  body('comment_appraise').optional().trim(),
  body('comment_management').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed',
        errors: errors.array() 
      });
    }

    if (!req.params.id || isNaN(parseInt(req.params.id))) {
      return res.status(400).json({ error: 'Invalid appraisal ID' });
    }

    const appraisal = await db.get('SELECT * FROM appraisals WHERE id = ?', [req.params.id]);
    if (!appraisal) {
      return res.status(404).json({ error: 'Appraisal not found' });
    }

    // Only creator can update (or admin)
    if (req.user.role !== 'Admin' && appraisal.appraised_by_user_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only update appraisals you created' });
    }

    const updates = req.body;
    const updateFields = [];
    const params = [];

    if (updates.grade_level_appraise !== undefined) {
      updateFields.push('grade_level_appraise = ?');
      params.push(parseInt(updates.grade_level_appraise));
    }
    if (updates.grade_level_management !== undefined) {
      updateFields.push('grade_level_management = ?');
      params.push(parseInt(updates.grade_level_management));
    }
    if (updates.comment_appraise !== undefined) {
      updateFields.push('comment_appraise = ?');
      params.push(updates.comment_appraise);
    }
    if (updates.comment_management !== undefined) {
      updateFields.push('comment_management = ?');
      params.push(updates.comment_management);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(req.params.id);
    await db.run(
      `UPDATE appraisals 
       SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      params
    );

    // Update user appraisal summary
    await updateUserAppraisalSummary(appraisal.staff_id);

    await logAction(req.user.id, 'update_appraisal', 'appraisals', req.params.id, updates, req);

    // Emit real-time event
    if (global.io) {
      global.io.emit('appraisal_updated', {
        id: req.params.id,
        staff_id: appraisal.staff_id,
        ...updates
      });
    }

    res.json({ message: 'Appraisal updated successfully' });
  } catch (error) {
    console.error('Update appraisal error:', error);
    res.status(500).json({ error: 'Failed to update appraisal: ' + error.message });
  }
});

/**
 * DELETE /api/appraisals/:id
 * Delete appraisal (only by creator or admin)
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const appraisal = await db.get('SELECT * FROM appraisals WHERE id = ?', [req.params.id]);
    if (!appraisal) {
      return res.status(404).json({ error: 'Appraisal not found' });
    }

    // Only creator or admin can delete
    if (req.user.role !== 'Admin' && appraisal.appraised_by_user_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete appraisals you created' });
    }

    const staffId = appraisal.staff_id;
    await db.run('DELETE FROM appraisals WHERE id = ?', [req.params.id]);

    // Update user appraisal summary
    await updateUserAppraisalSummary(staffId);

    await logAction(req.user.id, 'delete_appraisal', 'appraisals', req.params.id, {}, req);

    // Emit real-time event
    if (global.io) {
      global.io.emit('appraisal_deleted', {
        id: req.params.id,
        staff_id: staffId,
        deleted_by: req.user.id
      });
    }

    res.json({ message: 'Appraisal deleted successfully' });
  } catch (error) {
    console.error('Delete appraisal error:', error);
    res.status(500).json({ error: 'Failed to delete appraisal: ' + error.message });
  }
});

module.exports = router;


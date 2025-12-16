/**
 * Targets Management System - Production Ready
 * 
 * Features:
 * - Target creation, update, deletion (Admin only)
 * - Real-time progress tracking via target_progress entries
 * - Approval workflow for target progress entries
 * - Net amount calculation: total_progress (approved) + shared_in - shared_out
 * - Progress percentage and remaining amount calculations
 * - Fund sharing between targets
 * - Real-time Socket.IO updates
 * - Comprehensive error handling
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, requireRole } = require('../utils/auth');
const { logAction } = require('../utils/audit');

/**
 * Helper function to calculate target metrics
 * @param {Object} target - Target object from database
 * @returns {Object} Calculated metrics
 */
async function calculateTargetMetrics(target) {
  const USE_POSTGRESQL = !!process.env.DATABASE_URL;
  
  try {
    // Check if target_progress table exists
    let targetProgressExists;
    if (USE_POSTGRESQL) {
      targetProgressExists = await db.get(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'target_progress'"
      );
    } else {
      targetProgressExists = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='target_progress'");
    }

    // Calculate total_progress (only approved entries)
    let totalProgress = 0;
    if (targetProgressExists) {
      const progressResult = await db.get(
        `SELECT COALESCE(SUM(COALESCE(CAST(amount AS NUMERIC), CAST(progress_amount AS NUMERIC), 0)), 0) as total
         FROM target_progress
         WHERE target_id = ?
           AND (UPPER(TRIM(COALESCE(status, ''))) = 'APPROVED' OR status IS NULL OR status = '')`,
        [target.id]
      );
      totalProgress = parseFloat(progressResult?.total || 0) || 0;
    }

    // Check if fund_sharing table exists
    let fundSharingExists;
    if (USE_POSTGRESQL) {
      fundSharingExists = await db.get(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fund_sharing'"
      );
    } else {
      fundSharingExists = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='fund_sharing'");
    }

    // Calculate shared_out (funds shared from this target's user)
    let sharedOut = 0;
    if (fundSharingExists) {
      const sharedOutResult = await db.get(
        `SELECT COALESCE(SUM(CASE WHEN status = 'Active' THEN CAST(amount AS NUMERIC) ELSE 0 END), 0) as total
         FROM fund_sharing
         WHERE from_user_id = ?`,
        [target.user_id]
      );
      sharedOut = parseFloat(sharedOutResult?.total || 0) || 0;
    }

    // Calculate shared_in (funds shared to this target's user)
    let sharedIn = 0;
    if (fundSharingExists) {
      const sharedInResult = await db.get(
        `SELECT COALESCE(SUM(CASE WHEN status = 'Active' THEN CAST(amount AS NUMERIC) ELSE 0 END), 0) as total
         FROM fund_sharing
         WHERE to_user_id = ?`,
        [target.user_id]
      );
      sharedIn = parseFloat(sharedInResult?.total || 0) || 0;
    }

    // Calculate net amount: total_progress + shared_in - shared_out
    const targetAmount = parseFloat(target.target_amount || 0) || 0;
    const netAmount = totalProgress + sharedIn - sharedOut;
    
    // Calculate progress percentage (can exceed 100%)
    const progressPercentage = targetAmount > 0 ? (netAmount / targetAmount) * 100 : 0;
    
    // Calculate remaining amount (cannot be negative)
    const remainingAmount = Math.max(0, targetAmount - netAmount);

    return {
          total_progress: totalProgress,
      shared_in: sharedIn,
      shared_out: sharedOut,
      net_amount: netAmount,
      progress_percentage: progressPercentage.toFixed(2),
      remaining_amount: remainingAmount
    };
  } catch (error) {
    console.error('Error calculating target metrics:', error);
    // Return zero values on error
    return {
      total_progress: 0,
      shared_in: 0,
      shared_out: 0,
      net_amount: 0,
      progress_percentage: '0.00',
      remaining_amount: parseFloat(target.target_amount || 0) || 0
    };
  }
}

/**
 * GET /api/targets
 * Get all targets (Admin sees all, others see their own)
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const USE_POSTGRESQL = !!process.env.DATABASE_URL;
    
    // Check if targets table exists
    let tableExists;
    if (USE_POSTGRESQL) {
      tableExists = await db.get(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'targets'"
      );
    } else {
      tableExists = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='targets'");
    }

    if (!tableExists) {
      return res.json({ targets: [] });
    }

    // Build query
    let query = `
      SELECT t.*, 
             COALESCE(u.name, 'Unknown User') as user_name, 
             COALESCE(u.email, '') as user_email,
             COALESCE(u.role, '') as user_role,
             COALESCE(creator.name, 'System') as created_by_name
      FROM targets t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN users creator ON t.created_by = creator.id
      WHERE 1=1
    `;
    const params = [];

    // Role-based filtering: Non-admin users only see their own targets
    if (req.user.role !== 'Admin') {
      query += ' AND t.user_id = ?';
      params.push(req.user.id);
    }

    // Filter by status if provided
    if (req.query.status) {
      query += ' AND t.status = ?';
      params.push(req.query.status);
    }

    query += ' ORDER BY t.created_at DESC';
    
    const targets = await db.all(query, params);

    // Calculate metrics for each target
    const targetsWithMetrics = await Promise.all(
      targets.map(async (target) => {
        const metrics = await calculateTargetMetrics(target);
        return {
              ...target,
          ...metrics,
          target_amount: parseFloat(target.target_amount || 0) || 0
        };
      })
    );

    res.json({ targets: targetsWithMetrics });
  } catch (error) {
    console.error('Get targets error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch targets',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/targets/:id
 * Get single target by ID
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const target = await db.get(
      `SELECT t.*, 
             COALESCE(u.name, 'Unknown User') as user_name, 
             COALESCE(u.email, '') as user_email,
             COALESCE(u.role, '') as user_role,
              COALESCE(creator.name, 'System') as created_by_name
      FROM targets t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN users creator ON t.created_by = creator.id
       WHERE t.id = ?`,
      [req.params.id]
    );

    if (!target) {
      return res.status(404).json({ error: 'Target not found' });
    }

    // Authorization: Non-admin users can only view their own targets
    if (req.user.role !== 'Admin' && target.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Calculate metrics
    const metrics = await calculateTargetMetrics(target);

    res.json({
      target: {
        ...target,
        ...metrics,
        target_amount: parseFloat(target.target_amount || 0) || 0
      }
    });
  } catch (error) {
    console.error('Get target error:', error);
    res.status(500).json({ error: 'Failed to fetch target' });
  }
});

/**
 * POST /api/targets
 * Create new target (Admin only)
 */
router.post('/', authenticateToken, requireRole('Admin'), [
  body('user_id').isInt().withMessage('Valid user ID is required'),
  body('target_amount').isFloat({ min: 0 }).withMessage('Valid target amount is required'),
  body('category').optional().isIn(['Employee', 'Client for Consultancy', 'Client for Audit', 'Student', 'Others']),
  body('period_start').isISO8601().withMessage('Valid start date is required'),
  body('period_end').optional().isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { user_id, target_amount, category, period_start, period_end, notes } = req.body;

    // Verify user exists
    const user = await db.get('SELECT id, name, email, role FROM users WHERE id = ?', [user_id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user already has an active target
    const existingTarget = await db.get(
      'SELECT id FROM targets WHERE user_id = ? AND status = ?',
      [user_id, 'Active']
    );

    if (existingTarget) {
      return res.status(400).json({ 
        error: 'User already has an active target. Please extend or cancel the existing target first.',
        existing_target_id: existingTarget.id
      });
    }

    // Create target
    const result = await db.run(
      `INSERT INTO targets (user_id, target_amount, category, period_start, period_end, notes, created_by, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [user_id, target_amount, category || null, period_start, period_end || null, notes || null, req.user.id, 'Active']
    );

    const targetId = result.lastID || result.id || (result.rows && result.rows[0] && result.rows[0].id);
    
    if (!targetId) {
      return res.status(500).json({ error: 'Failed to create target - could not retrieve target ID' });
    }

    await logAction(req.user.id, 'create_target', 'targets', targetId, { user_id, target_amount, category }, req);

    // Get created target with metrics
    const createdTarget = await db.get(
      `SELECT t.*, 
             COALESCE(u.name, 'Unknown User') as user_name, 
              COALESCE(u.email, '') as user_email
      FROM targets t
      LEFT JOIN users u ON t.user_id = u.id
       WHERE t.id = ?`,
      [targetId]
    );

    const metrics = await calculateTargetMetrics(createdTarget);

    // Emit real-time update
    if (global.io) {
      global.io.emit('target_created', {
        id: targetId,
        user_id,
        user_name: user.name,
        target_amount,
        created_by: req.user.name
      });
    }

    res.status(201).json({
      message: 'Target created successfully',
      target: {
        ...createdTarget,
        ...metrics
      }
    });
  } catch (error) {
    console.error('Create target error:', error);
    res.status(500).json({ 
      error: 'Failed to create target',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * PUT /api/targets/:id
 * Update target (Admin only)
 */
router.put('/:id', authenticateToken, requireRole('Admin'), [
  body('target_amount').optional().isFloat({ min: 0 }),
  body('category').optional().isIn(['Employee', 'Client for Consultancy', 'Client for Audit', 'Student', 'Others']),
  body('status').optional().isIn(['Active', 'Completed', 'Extended', 'Cancelled']),
  body('period_start').optional().isISO8601(),
  body('period_end').optional().isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const target = await db.get('SELECT * FROM targets WHERE id = ?', [req.params.id]);
    if (!target) {
      return res.status(404).json({ error: 'Target not found' });
    }

    const updates = [];
    const params = [];

    if (req.body.target_amount !== undefined) {
      updates.push('target_amount = ?');
      params.push(req.body.target_amount);
    }
    if (req.body.category !== undefined) {
      updates.push('category = ?');
      params.push(req.body.category);
    }
    if (req.body.status !== undefined) {
      updates.push('status = ?');
      params.push(req.body.status);
    }
    if (req.body.period_start !== undefined) {
      updates.push('period_start = ?');
      params.push(req.body.period_start);
    }
    if (req.body.period_end !== undefined) {
      updates.push('period_end = ?');
      params.push(req.body.period_end);
    }
    if (req.body.notes !== undefined) {
      updates.push('notes = ?');
      params.push(req.body.notes);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(req.params.id);

    await db.run(`UPDATE targets SET ${updates.join(', ')} WHERE id = ?`, params);
    await logAction(req.user.id, 'update_target', 'targets', req.params.id, req.body, req);

    // Get updated target with metrics
    const updatedTarget = await db.get(
      `SELECT t.*, 
             COALESCE(u.name, 'Unknown User') as user_name, 
              COALESCE(u.email, '') as user_email
      FROM targets t
      LEFT JOIN users u ON t.user_id = u.id
       WHERE t.id = ?`,
      [req.params.id]
    );

    const metrics = await calculateTargetMetrics(updatedTarget);

      // Emit real-time update
      if (global.io) {
        global.io.emit('target_updated', {
          id: req.params.id,
        updated_by: req.user.name,
        ...metrics
        });
      }

      res.json({ 
        message: 'Target updated successfully',
      target: {
        ...updatedTarget,
        ...metrics
      }
    });
  } catch (error) {
    console.error('Update target error:', error);
    res.status(500).json({ error: 'Failed to update target' });
  }
});

/**
 * DELETE /api/targets/:id
 * Delete target (Admin only)
 */
router.delete('/:id', authenticateToken, requireRole('Admin'), async (req, res) => {
  try {
    const target = await db.get('SELECT * FROM targets WHERE id = ?', [req.params.id]);
    if (!target) {
      return res.status(404).json({ error: 'Target not found' });
    }

    await db.run('DELETE FROM targets WHERE id = ?', [req.params.id]);
    await logAction(req.user.id, 'delete_target', 'targets', req.params.id, {}, req);

    // Emit real-time update
    if (global.io) {
      global.io.emit('target_deleted', {
        id: req.params.id,
        deleted_by: req.user.name
      });
    }

    res.json({ message: 'Target deleted successfully' });
  } catch (error) {
    console.error('Delete target error:', error);
    res.status(500).json({ error: 'Failed to delete target' });
  }
});

/**
 * GET /api/targets/:id/progress
 * Get target progress history
 */
router.get('/:id/progress', authenticateToken, async (req, res) => {
  try {
    const target = await db.get('SELECT * FROM targets WHERE id = ?', [req.params.id]);
    if (!target) {
      return res.status(404).json({ error: 'Target not found' });
    }

    // Authorization
    if (req.user.role !== 'Admin' && target.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const progressEntries = await db.all(
      `SELECT tp.*, 
              pr.name as progress_report_name,
              pr.date as progress_report_date
       FROM target_progress tp
       LEFT JOIN progress_reports pr ON tp.progress_report_id = pr.id
       WHERE tp.target_id = ?
       ORDER BY tp.transaction_date DESC, tp.created_at DESC`,
      [req.params.id]
    );

    res.json({ progress: progressEntries });
  } catch (error) {
    console.error('Get target progress error:', error);
    res.status(500).json({ error: 'Failed to fetch target progress' });
  }
});

/**
 * PUT /api/targets/progress/:id/approve
 * Approve or reject target progress entry (Admin only)
 */
router.put('/progress/:id/approve', authenticateToken, requireRole('Admin'), [
  body('status').isIn(['Approved', 'Rejected']).withMessage('Status must be Approved or Rejected')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status } = req.body;
    
    // Get progress entry
    const progressEntry = await db.get(
      `SELECT tp.*, t.user_id as target_user_id
       FROM target_progress tp
       JOIN targets t ON tp.target_id = t.id
       WHERE tp.id = ?`,
      [req.params.id]
    );

    if (!progressEntry) {
      return res.status(404).json({ error: 'Progress entry not found' });
    }

    // Update status
      await db.run(
      'UPDATE target_progress SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [status, req.params.id]
      );

    await logAction(req.user.id, 'approve_target_progress', 'target_progress', req.params.id, { status }, req);

    // Get updated target with metrics
    const target = await db.get('SELECT * FROM targets WHERE id = ?', [progressEntry.target_id]);
    const metrics = await calculateTargetMetrics(target);

    // Emit real-time updates
      if (global.io) {
        global.io.emit('target_progress_updated', {
          target_id: progressEntry.target_id,
        user_id: progressEntry.target_user_id,
        progress_id: req.params.id,
        action: status === 'Approved' ? 'progress_approved' : 'progress_rejected',
        status,
        ...metrics
        });

        global.io.emit('target_updated', {
          id: progressEntry.target_id,
        updated_by: req.user.name,
        reason: 'target_progress_' + status.toLowerCase(),
        ...metrics
      });
    }

      res.json({ 
        message: `Target progress entry ${status.toLowerCase()} successfully`,
        progress_id: req.params.id,
        target: {
          id: progressEntry.target_id,
        ...metrics
      }
    });
  } catch (error) {
    console.error('Approve target progress error:', error);
    res.status(500).json({ 
      error: 'Failed to approve target progress entry',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/targets/fund-sharing/history
 * Get fund sharing history
 */
router.get('/fund-sharing/history', authenticateToken, async (req, res) => {
  try {
    const USE_POSTGRESQL = !!process.env.DATABASE_URL;
    
    // Check if fund_sharing table exists
    let tableExists;
    if (USE_POSTGRESQL) {
      tableExists = await db.get(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fund_sharing'"
      );
    } else {
      tableExists = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='fund_sharing'");
    }

    if (!tableExists) {
      return res.json({ history: [] });
    }

    let query = `
      SELECT fs.*,
             sender.name as from_user_name,
             sender.email as from_user_email,
             recipient.name as to_user_name,
             recipient.email as to_user_email
      FROM fund_sharing fs
      LEFT JOIN users sender ON fs.from_user_id = sender.id
      LEFT JOIN users recipient ON fs.to_user_id = recipient.id
      WHERE 1=1
    `;
    const params = [];

    // Non-admin users only see their own sharing history
    if (req.user.role !== 'Admin') {
      query += ' AND (fs.from_user_id = ? OR fs.to_user_id = ?)';
      params.push(req.user.id, req.user.id);
    }

    query += ' ORDER BY fs.created_at DESC';

    const history = await db.all(query, params);
    res.json({ history });
  } catch (error) {
    console.error('Get fund sharing history error:', error);
    res.status(500).json({ error: 'Failed to fetch fund sharing history' });
  }
});

module.exports = router;


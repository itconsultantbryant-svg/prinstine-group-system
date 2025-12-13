const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, requireRole } = require('../utils/auth');
const { logAction } = require('../utils/audit');

// Get all targets (Admin sees all, others see their own)
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Check if using PostgreSQL
    const USE_POSTGRESQL = !!process.env.DATABASE_URL;
    
    // Check if targets table exists
    let tableExists;
    if (USE_POSTGRESQL) {
      tableExists = await db.get(
        "SELECT table_name as name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'targets'"
      );
    } else {
      tableExists = await db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='targets'"
      );
    }

    if (!tableExists) {
      console.log('Targets table does not exist yet');
      return res.json({ targets: [] });
    }

    // Check if fund_sharing table exists for subqueries
    let fundSharingExists;
    if (USE_POSTGRESQL) {
      fundSharingExists = await db.get(
        "SELECT table_name as name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fund_sharing'"
      );
    } else {
      fundSharingExists = await db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='fund_sharing'"
      );
    }

    // Check if target_progress table exists
    let targetProgressExists;
    if (USE_POSTGRESQL) {
      targetProgressExists = await db.get(
        "SELECT table_name as name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'target_progress'"
      );
    } else {
      targetProgressExists = await db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='target_progress'"
      );
    }

    // Build safe subqueries that won't fail if tables don't exist
    const totalProgressSubquery = targetProgressExists
      ? `(SELECT COALESCE(SUM(tp.amount), 0) 
          FROM target_progress tp 
          WHERE tp.target_id = t.id)`
      : 'CAST(0 AS NUMERIC)';
    
    const sharedOutSubquery = fundSharingExists 
      ? `(SELECT COALESCE(SUM(CASE WHEN fs.status = 'Active' THEN fs.amount ELSE 0 END), 0)
          FROM fund_sharing fs
          WHERE fs.from_user_id = t.user_id)`
      : 'CAST(0 AS NUMERIC)';
    
    const sharedInSubquery = fundSharingExists
      ? `(SELECT COALESCE(SUM(CASE WHEN fs.status = 'Active' THEN fs.amount ELSE 0 END), 0)
          FROM fund_sharing fs
          WHERE fs.to_user_id = t.user_id)`
      : 'CAST(0 AS NUMERIC)';

    let query = `
      SELECT t.*, 
             COALESCE(u.name, 'Unknown User') as user_name, 
             COALESCE(u.email, '') as user_email,
             COALESCE(u.role, '') as user_role,
             COALESCE(creator.name, 'System') as created_by_name,
             ${totalProgressSubquery} as total_progress,
             ${sharedOutSubquery} as shared_out,
             ${sharedInSubquery} as shared_in
      FROM targets t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN users creator ON t.created_by = creator.id
      WHERE 1=1
    `;
    const params = [];

    // Everyone can see all targets
    // Use the column aliases in ORDER BY
    query += ' ORDER BY (COALESCE(total_progress, 0) + COALESCE(shared_in, 0) - COALESCE(shared_out, 0)) DESC, t.created_at DESC';

    console.log('Executing targets query:', query.substring(0, 300) + '...');
    console.log('Query params:', params);
    console.log('Tables exist - targets:', !!tableExists, 'fund_sharing:', !!fundSharingExists, 'target_progress:', !!targetProgressExists);
    
    const targets = await db.all(query, params);
    console.log(`Fetched ${targets.length} targets from database`);
    
    if (targets && targets.length > 0) {
      console.log('First target sample:', {
        id: targets[0].id,
        user_id: targets[0].user_id,
        user_name: targets[0].user_name,
        target_amount: targets[0].target_amount,
        total_progress: targets[0].total_progress,
        shared_in: targets[0].shared_in,
        shared_out: targets[0].shared_out,
        status: targets[0].status
      });
      
      // Debug: Check actual target_progress records for first target
      if (targetProgressExists) {
        const progressCheck = await db.all(
          'SELECT SUM(amount) as total FROM target_progress WHERE target_id = ?',
          [targets[0].id]
        );
        console.log('Direct progress check for target', targets[0].id, ':', progressCheck);
      }
    } else {
      console.log('No targets found in database - checking if targets table has any rows...');
      // Try a simple query to see if there are any targets at all
      try {
        const simpleCheck = await db.all('SELECT COUNT(*) as count FROM targets', []);
        console.log('Simple count query result:', simpleCheck);
        if (simpleCheck && simpleCheck[0] && simpleCheck[0].count > 0) {
          console.log(`WARNING: Found ${simpleCheck[0].count} targets in database but query returned 0!`);
          console.log('This suggests the query has an issue. Trying simplified query...');
          // Try a very simple query without subqueries
          const simpleTargets = await db.all('SELECT t.*, u.name as user_name FROM targets t LEFT JOIN users u ON t.user_id = u.id ORDER BY t.created_at DESC', []);
          console.log(`Simplified query returned ${simpleTargets.length} targets`);
          if (simpleTargets.length > 0) {
            // Return the simplified results
            const simplifiedWithProgress = simpleTargets.map(target => ({
              ...target,
              total_progress: 0,
              shared_out: 0,
              shared_in: 0,
              net_amount: 0,
              progress_percentage: '0.00',
              remaining_amount: target.target_amount || 0
            }));
            return res.json({ targets: simplifiedWithProgress });
          }
        }
      } catch (checkError) {
        console.error('Error checking target count:', checkError);
      }
    }

    // Calculate progress percentage and net amount for each target
    // Allow progress to exceed 100% (users can exceed their targets)
    const targetsWithProgress = targets.map(target => {
      const netAmount = (target.total_progress || 0) + (target.shared_in || 0) - (target.shared_out || 0);
      const progressPercentage = target.target_amount > 0 
        ? (netAmount / target.target_amount) * 100 
        : 0;
      
      return {
        ...target,
        net_amount: netAmount,
        progress_percentage: progressPercentage.toFixed(2),
        remaining_amount: Math.max(0, target.target_amount - netAmount)
      };
    });

    console.log(`Returning ${targetsWithProgress.length} targets with progress calculations`);
    res.json({ targets: targetsWithProgress || [] });
  } catch (error) {
    console.error('Get targets error:', error);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error stack:', error.stack?.split('\n').slice(0, 5).join('\n'));
    
    // Return empty array instead of error if table doesn't exist
    if (error.message && (error.message.includes('no such table') || error.message.includes('does not exist'))) {
      console.log('Table does not exist, returning empty array');
      return res.json({ targets: [] });
    }
    
    // Return 400 for syntax errors, 500 for other errors
    const statusCode = error.message && (
      error.message.includes('syntax error') || 
      (error.message.includes('column') && error.message.includes('does not exist')) ||
      error.message.includes('invalid')
    ) ? 400 : 500;
    
    res.status(statusCode).json({ 
      error: 'Failed to fetch targets',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get single target
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT t.*, 
             COALESCE(u.name, 'Unknown User') as user_name, 
             COALESCE(u.email, '') as user_email,
             COALESCE(u.role, '') as user_role,
             COALESCE(creator.name, 'System') as created_by_name,
             (SELECT COALESCE(SUM(tp.amount), 0) 
              FROM target_progress tp 
              WHERE tp.target_id = t.id) as total_progress,
             (SELECT COALESCE(SUM(CASE WHEN fs.status = 'Active' THEN fs.amount ELSE 0 END), 0)
              FROM fund_sharing fs
              WHERE fs.from_user_id = t.user_id) as shared_out,
             (SELECT COALESCE(SUM(CASE WHEN fs.status = 'Active' THEN fs.amount ELSE 0 END), 0)
              FROM fund_sharing fs
              WHERE fs.to_user_id = t.user_id) as shared_in
      FROM targets t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN users creator ON t.created_by = creator.id
      WHERE t.id = ?
    `;
    const params = [req.params.id];

    // Everyone can see all targets
    const target = await db.get(query, params);

    if (!target) {
      return res.status(404).json({ error: 'Target not found' });
    }

    const netAmount = (target.total_progress || 0) + (target.shared_in || 0) - (target.shared_out || 0);
    // Allow progress to exceed 100% (users can exceed their targets)
    const progressPercentage = target.target_amount > 0 
      ? (netAmount / target.target_amount) * 100 
      : 0;

    res.json({
      target: {
        ...target,
        net_amount: netAmount,
        progress_percentage: progressPercentage.toFixed(2),
        remaining_amount: Math.max(0, target.target_amount - netAmount)
      }
    });
  } catch (error) {
    console.error('Get target error:', error);
    res.status(500).json({ error: 'Failed to fetch target' });
  }
});

// Create target (Admin only)
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
    // Check for both 'Active' status and targets that haven't been completed
    const existingTarget = await db.get(
      'SELECT id, target_amount, period_start, period_end FROM targets WHERE user_id = ? AND (status = ? OR status IS NULL OR status = \'\')',
      [user_id, 'Active']
    );

    if (existingTarget) {
      return res.status(400).json({ 
        error: 'User already has an active target. Please extend or cancel the existing target first.',
        existing_target_id: existingTarget.id
      });
    }

    const result = await db.run(
      `INSERT INTO targets (user_id, target_amount, category, period_start, period_end, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [user_id, target_amount, category || null, period_start, period_end || null, notes || null, req.user.id]
    );

    const targetId = result.lastID || result.id || (result.rows && result.rows[0] && result.rows[0].id);
    
    if (!targetId) {
      console.error('Failed to get target ID after creation:', result);
      return res.status(500).json({ error: 'Failed to create target - could not retrieve target ID' });
    }

    await logAction(req.user.id, 'create_target', 'targets', targetId, { user_id, target_amount, category }, req);

    // Get the created target with all details
    const createdTarget = await db.get(`
      SELECT t.*, 
             COALESCE(u.name, 'Unknown User') as user_name, 
             COALESCE(u.email, '') as user_email,
             COALESCE(u.role, '') as user_role,
             COALESCE(creator.name, 'System') as created_by_name,
             (SELECT COALESCE(SUM(tp.amount), 0) 
              FROM target_progress tp 
              WHERE tp.target_id = t.id) as total_progress,
             (SELECT COALESCE(SUM(CASE WHEN fs.status = 'Active' THEN fs.amount ELSE 0 END), 0)
              FROM fund_sharing fs
              WHERE fs.from_user_id = t.user_id) as shared_out,
             (SELECT COALESCE(SUM(CASE WHEN fs.status = 'Active' THEN fs.amount ELSE 0 END), 0)
              FROM fund_sharing fs
              WHERE fs.to_user_id = t.user_id) as shared_in
      FROM targets t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN users creator ON t.created_by = creator.id
      WHERE t.id = ?
    `, [targetId]);

    if (!createdTarget) {
      console.error('Failed to fetch created target:', targetId);
      return res.status(500).json({ error: 'Target created but could not be retrieved' });
    }

    // Calculate initial progress
    const netAmount = (createdTarget.total_progress || 0) + (createdTarget.shared_in || 0) - (createdTarget.shared_out || 0);
    const progressPercentage = target_amount > 0 
      ? (netAmount / target_amount) * 100 
      : 0;
    
    const targetWithProgress = {
      ...createdTarget,
      net_amount: netAmount,
      progress_percentage: progressPercentage.toFixed(2),
      remaining_amount: Math.max(0, target_amount - netAmount)
    };

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

    console.log('Target created successfully:', {
      id: targetId,
      user_id,
      target_amount,
      target: targetWithProgress
    });

    res.status(201).json({
      message: 'Target created successfully',
      target: targetWithProgress
    });
  } catch (error) {
    console.error('Create target error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sql: error.sql
    });
    
    // Handle specific database errors
    let errorMessage = 'Failed to create target';
    if (error.message && error.message.includes('FOREIGN KEY constraint')) {
      errorMessage = 'Foreign key constraint failed. Please ensure user exists.';
    } else if (error.message && error.message.includes('NOT NULL constraint')) {
      errorMessage = 'Required fields are missing.';
    } else if (error.message && error.message.includes('no such table')) {
      errorMessage = 'Targets table does not exist. Please wait for database migration to complete.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    res.status(500).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update target (Admin only)
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

    await db.run(
      `UPDATE targets SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    await logAction(req.user.id, 'update_target', 'targets', req.params.id, req.body, req);

    // Get updated target with all details
    const updatedTarget = await db.get(`
      SELECT t.*, 
             COALESCE(u.name, 'Unknown User') as user_name, 
             COALESCE(u.email, '') as user_email,
             COALESCE(u.role, '') as user_role,
             COALESCE(creator.name, 'System') as created_by_name,
             (SELECT COALESCE(SUM(tp.amount), 0) 
              FROM target_progress tp 
              WHERE tp.target_id = t.id) as total_progress,
             (SELECT COALESCE(SUM(CASE WHEN fs.status = 'Active' THEN fs.amount ELSE 0 END), 0)
              FROM fund_sharing fs
              WHERE fs.from_user_id = t.user_id) as shared_out,
             (SELECT COALESCE(SUM(CASE WHEN fs.status = 'Active' THEN fs.amount ELSE 0 END), 0)
              FROM fund_sharing fs
              WHERE fs.to_user_id = t.user_id) as shared_in
      FROM targets t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN users creator ON t.created_by = creator.id
      WHERE t.id = ?
    `, [req.params.id]);

    if (updatedTarget) {
      const netAmount = (updatedTarget.total_progress || 0) + (updatedTarget.shared_in || 0) - (updatedTarget.shared_out || 0);
      const progressPercentage = updatedTarget.target_amount > 0 
        ? (netAmount / updatedTarget.target_amount) * 100 
        : 0;
      
      const targetWithProgress = {
        ...updatedTarget,
        net_amount: netAmount,
        progress_percentage: progressPercentage.toFixed(2),
        remaining_amount: Math.max(0, updatedTarget.target_amount - netAmount)
      };

      // Emit real-time update
      if (global.io) {
        global.io.emit('target_updated', {
          id: req.params.id,
          updated_by: req.user.name
        });
      }

      res.json({ 
        message: 'Target updated successfully',
        target: targetWithProgress
      });
    } else {
      res.json({ message: 'Target updated successfully' });
    }
  } catch (error) {
    console.error('Update target error:', error);
    res.status(500).json({ error: 'Failed to update target' });
  }
});

// Extend target (Admin only) - creates a new target with extended amount
router.post('/:id/extend', authenticateToken, requireRole('Admin'), [
  body('additional_amount').isFloat({ min: 0 }).withMessage('Valid additional amount is required'),
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

    const { additional_amount, period_end } = req.body;
    const newTargetAmount = target.target_amount + additional_amount;

    // Mark old target as Extended
    await db.run(
      'UPDATE targets SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['Extended', req.params.id]
    );

    // Create new target with extended amount
    const result = await db.run(
      `INSERT INTO targets (user_id, target_amount, category, period_start, period_end, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        target.user_id,
        newTargetAmount,
        target.category,
        target.period_start,
        period_end || target.period_end,
        `Extended from target #${target.id}. Additional amount: ${additional_amount}`,
        req.user.id
      ]
    );

    await logAction(req.user.id, 'extend_target', 'targets', result.lastID, { 
      original_target_id: req.params.id, 
      additional_amount 
    }, req);

    // Get the extended target with all details
    const extendedTarget = await db.get(`
      SELECT t.*, 
             COALESCE(u.name, 'Unknown User') as user_name, 
             COALESCE(u.email, '') as user_email,
             COALESCE(u.role, '') as user_role,
             COALESCE(creator.name, 'System') as created_by_name,
             0 as total_progress,
             0 as shared_out,
             0 as shared_in
      FROM targets t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN users creator ON t.created_by = creator.id
      WHERE t.id = ?
    `, [result.lastID]);

    const netAmount = 0;
    const progressPercentage = 0;
    const targetWithProgress = {
      ...extendedTarget,
      net_amount: netAmount,
      progress_percentage: progressPercentage.toFixed(2),
      remaining_amount: newTargetAmount
    };

    // Emit real-time update
    if (global.io) {
      global.io.emit('target_created', {
        id: result.lastID,
        user_id: target.user_id,
        target_amount: newTargetAmount,
        created_by: req.user.name
      });
    }

    res.json({
      message: 'Target extended successfully',
      target: targetWithProgress
    });
  } catch (error) {
    console.error('Extend target error:', error);
    res.status(500).json({ error: 'Failed to extend target' });
  }
});

// Share fund between employees
router.post('/share-fund', authenticateToken, [
  body('to_user_id').isInt().withMessage('Valid recipient user ID is required'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Valid amount is required'),
  body('progress_report_id').optional().isInt(),
  body('reason').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { to_user_id, amount, progress_report_id, reason } = req.body;
    const from_user_id = req.user.id;

    // Cannot share with self
    if (from_user_id === to_user_id) {
      return res.status(400).json({ error: 'Cannot share fund with yourself' });
    }

    // Verify recipient exists
    const recipient = await db.get('SELECT id, name FROM users WHERE id = ?', [to_user_id]);
    if (!recipient) {
      return res.status(404).json({ error: 'Recipient user not found' });
    }

    // Verify sender has active target and sufficient progress
    const senderTarget = await db.get(
      `SELECT t.*, 
              (SELECT COALESCE(SUM(tp.amount), 0) FROM target_progress tp WHERE tp.target_id = t.id) as total_progress,
              (SELECT COALESCE(SUM(CASE WHEN fs.status = 'Active' THEN fs.amount ELSE 0 END), 0)
               FROM fund_sharing fs WHERE fs.from_user_id = t.user_id) as shared_out,
              (SELECT COALESCE(SUM(CASE WHEN fs.status = 'Active' THEN fs.amount ELSE 0 END), 0)
               FROM fund_sharing fs WHERE fs.to_user_id = t.user_id) as shared_in
       FROM targets t
       WHERE t.user_id = ? AND t.status = 'Active'`,
      [from_user_id]
    );

    if (!senderTarget) {
      return res.status(400).json({ error: 'You do not have an active target' });
    }

    // Calculate net amount (total progress + shared in - shared out)
    const netAmount = (senderTarget.total_progress || 0) + (senderTarget.shared_in || 0) - (senderTarget.shared_out || 0);
    
    // Available amount is the net amount minus what's already been shared out
    // This ensures users can only share from their actual achieved amount
    const alreadySharedOut = senderTarget.shared_out || 0;
    const availableAmount = netAmount - alreadySharedOut;

    if (amount > availableAmount) {
      return res.status(400).json({ 
        error: `Insufficient funds. Available amount to share: $${availableAmount.toFixed(2)}, Requested: $${amount.toFixed(2)}. You can only share from your achieved target amount.` 
      });
    }

    if (availableAmount <= 0) {
      return res.status(400).json({ 
        error: 'You have no available funds to share. You can only share from your achieved target amount.' 
      });
    }

    // Create fund sharing record
    const result = await db.run(
      `INSERT INTO fund_sharing (from_user_id, to_user_id, amount, progress_report_id, reason, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [from_user_id, to_user_id, amount, progress_report_id || null, reason || null, req.user.id]
    );

    const sharingId = result.lastID || result.id || (result.rows && result.rows[0] && result.rows[0].id);
    
    if (!sharingId) {
      console.error('Failed to get sharing ID after creation:', result);
      return res.status(500).json({ error: 'Failed to create fund sharing - could not retrieve sharing ID' });
    }

    await logAction(req.user.id, 'share_fund', 'fund_sharing', sharingId, { 
      to_user_id, amount 
    }, req);

    // Emit real-time update
    if (global.io) {
      const sender = await db.get('SELECT name FROM users WHERE id = ?', [from_user_id]);
      global.io.emit('fund_shared', {
        id: sharingId,
        from_user_id,
        from_user_name: sender?.name || 'Unknown',
        to_user_id,
        to_user_name: recipient.name,
        amount
      });
      
      // Also emit target update events for both users
      global.io.emit('target_progress_updated', {
        target_id: senderTarget.id,
        user_id: from_user_id
      });
    }

    res.status(201).json({
      message: 'Fund shared successfully',
      sharing: { id: sharingId }
    });
  } catch (error) {
    console.error('Share fund error:', error);
    res.status(500).json({ error: 'Failed to share fund' });
  }
});

// Reverse fund sharing (Admin only)
router.post('/reverse-sharing/:id', authenticateToken, requireRole('Admin'), [
  body('reversal_reason').optional().trim()
], async (req, res) => {
  try {
    const sharing = await db.get('SELECT * FROM fund_sharing WHERE id = ?', [req.params.id]);
    if (!sharing) {
      return res.status(404).json({ error: 'Fund sharing record not found' });
    }

    if (sharing.status !== 'Active') {
      return res.status(400).json({ error: 'This fund sharing has already been reversed or cancelled' });
    }

    await db.run(
      `UPDATE fund_sharing 
       SET status = ?, reversed_by = ?, reversed_at = CURRENT_TIMESTAMP, reversal_reason = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      ['Reversed', req.user.id, req.body.reversal_reason || null, req.params.id]
    );

    await logAction(req.user.id, 'reverse_fund_sharing', 'fund_sharing', req.params.id, { 
      reversal_reason: req.body.reversal_reason 
    }, req);

    // Emit real-time update
    if (global.io) {
      global.io.emit('fund_shared', {
        id: req.params.id,
        status: 'Reversed',
        reversed_by: req.user.name
      });
    }

    res.json({ message: 'Fund sharing reversed successfully' });
  } catch (error) {
    console.error('Reverse sharing error:', error);
    res.status(500).json({ error: 'Failed to reverse fund sharing' });
  }
});

// Get fund sharing history
router.get('/fund-sharing/history', authenticateToken, async (req, res) => {
  try {
    // Check if using PostgreSQL
    const USE_POSTGRESQL = !!process.env.DATABASE_URL;
    
    // Check if fund_sharing table exists
    let tableExists;
    if (USE_POSTGRESQL) {
      tableExists = await db.get(
        "SELECT table_name as name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fund_sharing'"
      );
    } else {
      tableExists = await db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='fund_sharing'"
      );
    }

    if (!tableExists) {
      console.log('Fund sharing table does not exist yet');
      return res.json({ sharing_history: [] });
    }

    let query = `
      SELECT fs.*,
             COALESCE(from_user.name, 'Unknown User') as from_user_name,
             COALESCE(from_user.email, '') as from_user_email,
             COALESCE(to_user.name, 'Unknown User') as to_user_name,
             COALESCE(to_user.email, '') as to_user_email,
             COALESCE(reverser.name, 'System') as reversed_by_name,
             COALESCE(pr.name, 'Manual Entry') as progress_report_name
      FROM fund_sharing fs
      LEFT JOIN users from_user ON fs.from_user_id = from_user.id
      LEFT JOIN users to_user ON fs.to_user_id = to_user.id
      LEFT JOIN users reverser ON fs.reversed_by = reverser.id
      LEFT JOIN progress_reports pr ON fs.progress_report_id = pr.id
      WHERE 1=1
    `;
    const params = [];

    // Everyone can see all sharing records
    query += ' ORDER BY fs.created_at DESC';

    const sharingHistory = await db.all(query, params);
    res.json({ sharing_history: sharingHistory || [] });
  } catch (error) {
    console.error('Get fund sharing history error:', error);
    // Return empty array instead of error if table doesn't exist
    if (error.message && error.message.includes('no such table')) {
      return res.json({ sharing_history: [] });
    }
    res.status(500).json({ error: 'Failed to fetch fund sharing history' });
  }
});

// Get target progress history
router.get('/:id/progress', authenticateToken, async (req, res) => {
  try {
    // Check if user has access to this target
    const target = await db.get('SELECT * FROM targets WHERE id = ?', [req.params.id]);
    if (!target) {
      return res.status(404).json({ error: 'Target not found' });
    }

    // Everyone can view progress for all targets

    const progress = await db.all(
      `SELECT tp.*, 
              pr.name as progress_report_name,
              pr.date as progress_report_date,
              pr.category as progress_report_category,
              pr.status as progress_report_status
       FROM target_progress tp
       LEFT JOIN progress_reports pr ON tp.progress_report_id = pr.id
       WHERE tp.target_id = ?
       ORDER BY tp.transaction_date DESC, tp.created_at DESC`,
      [req.params.id]
    );

    res.json({ progress });
  } catch (error) {
    console.error('Get target progress error:', error);
    res.status(500).json({ error: 'Failed to fetch target progress' });
  }
});

// Auto-update target progress from progress reports
// This should be called when a progress report is created/updated
router.post('/update-progress', authenticateToken, async (req, res) => {
  try {
    const { progress_report_id } = req.body;

    if (!progress_report_id) {
      return res.status(400).json({ error: 'Progress report ID is required' });
    }

    // Get progress report
    const progressReport = await db.get(
      'SELECT * FROM progress_reports WHERE id = ?',
      [progress_report_id]
    );

    if (!progressReport) {
      return res.status(404).json({ error: 'Progress report not found' });
    }

    // Find active target for the creator
    const target = await db.get(
      'SELECT * FROM targets WHERE user_id = ? AND status = ?',
      [progressReport.created_by, 'Active']
    );

    if (!target) {
      return res.status(404).json({ error: 'No active target found for this user' });
    }

    // Check if progress already recorded for this report
    const existingProgress = await db.get(
      'SELECT id FROM target_progress WHERE progress_report_id = ?',
      [progress_report_id]
    );

    if (existingProgress) {
      // Update existing progress
      await db.run(
        `UPDATE target_progress 
         SET amount = ?, category = ?, status = ?, transaction_date = ?, updated_at = CURRENT_TIMESTAMP
         WHERE progress_report_id = ?`,
        [
          progressReport.amount || 0,
          progressReport.category,
          progressReport.status,
          progressReport.date,
          progress_report_id
        ]
      );
    } else {
      // Create new progress record
      await db.run(
        `INSERT INTO target_progress (target_id, user_id, progress_report_id, amount, category, status, transaction_date)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          target.id,
          progressReport.created_by,
          progress_report_id,
          progressReport.amount || 0,
          progressReport.category,
          progressReport.status,
          progressReport.date
        ]
      );
    }

    res.json({ message: 'Target progress updated successfully' });
  } catch (error) {
    console.error('Update target progress error:', error);
    res.status(500).json({ error: 'Failed to update target progress' });
  }
});

module.exports = router;


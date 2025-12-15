const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, requireRole } = require('../utils/auth');
const { logAction } = require('../utils/audit');

// Helper function to update admin target in database with aggregated staff and department head data
async function updateAdminTargetInDatabase(periodStart = null) {
  try {
    const adminUser = await db.get("SELECT id FROM users WHERE role = 'Admin' LIMIT 1");
    if (!adminUser) {
      console.log('No admin user found, skipping admin target update');
      return;
    }

    // If periodStart is not provided, update all active admin targets
    let adminTargets;
    if (periodStart) {
      adminTargets = await db.all(
        'SELECT id, period_start FROM targets WHERE user_id = ? AND status = ? AND period_start = ?',
        [adminUser.id, 'Active', periodStart]
      );
    } else {
      adminTargets = await db.all(
        'SELECT id, period_start FROM targets WHERE user_id = ? AND status = ?',
        [adminUser.id, 'Active']
      );
    }

    if (!adminTargets || adminTargets.length === 0) {
      console.log('No active admin targets found to update');
      return;
    }

    // Check if target_progress and fund_sharing tables exist
    const USE_POSTGRESQL = !!process.env.DATABASE_URL;
    let targetProgressExists = false;
    let fundSharingExists = false;

    if (USE_POSTGRESQL) {
      const tpCheck = await db.get(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'target_progress'"
      );
      targetProgressExists = !!tpCheck;
      
      const fsCheck = await db.get(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fund_sharing'"
      );
      fundSharingExists = !!fsCheck;
    } else {
      const tpCheck = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='target_progress'");
      targetProgressExists = !!tpCheck;
      
      const fsCheck = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='fund_sharing'");
      fundSharingExists = !!fsCheck;
    }

    // Update each admin target
    for (const adminTarget of adminTargets) {
      const period = adminTarget.period_start;
      
      // Aggregate all staff and department head targets (exclude admin)
      // This includes both Staff and DepartmentHead roles
      const allStaffTargets = await db.all(
        `SELECT 
          COALESCE(SUM(target_amount), 0) as total_target,
          COALESCE(SUM(
            ${targetProgressExists 
              ? `(SELECT COALESCE(SUM(COALESCE(CAST(tp.amount AS NUMERIC), CAST(tp.progress_amount AS NUMERIC), 0)), 0) FROM target_progress tp WHERE CAST(tp.target_id AS INTEGER) = CAST(t.id AS INTEGER) AND (UPPER(TRIM(COALESCE(tp.status, ''))) = 'APPROVED' OR tp.status IS NULL))`
              : 'CAST(0 AS NUMERIC)'}
          ), 0) as total_progress,
          COALESCE(SUM(
            ${fundSharingExists
              ? `(SELECT COALESCE(SUM(CASE WHEN fs.status = 'Active' THEN CAST(fs.amount AS NUMERIC) ELSE 0 END), 0)
                   FROM fund_sharing fs WHERE CAST(fs.from_user_id AS INTEGER) = CAST(t.user_id AS INTEGER))`
              : 'CAST(0 AS NUMERIC)'}
          ), 0) as total_shared_out,
          COALESCE(SUM(
            ${fundSharingExists
              ? `(SELECT COALESCE(SUM(CASE WHEN fs.status = 'Active' THEN CAST(fs.amount AS NUMERIC) ELSE 0 END), 0)
                   FROM fund_sharing fs WHERE CAST(fs.to_user_id AS INTEGER) = CAST(t.user_id AS INTEGER))`
              : 'CAST(0 AS NUMERIC)'}
          ), 0) as total_shared_in
         FROM targets t
         WHERE CAST(t.user_id AS INTEGER) != CAST(? AS INTEGER) 
           AND t.status = ? 
           AND t.period_start = ?`,
        [adminUser.id, 'Active', period]
      );

      if (allStaffTargets && allStaffTargets[0]) {
        const staffData = allStaffTargets[0];
        const totalProgress = parseFloat(staffData.total_progress || 0);
        const totalSharedIn = parseFloat(staffData.total_shared_in || 0);
        const totalSharedOut = parseFloat(staffData.total_shared_out || 0);
        const totalTarget = parseFloat(staffData.total_target || 0);
        
        const adminNetAmount = totalProgress + totalSharedIn - totalSharedOut;
        
        await db.run(
          `UPDATE targets 
           SET target_amount = ?, 
               notes = ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [
            totalTarget,
            `Auto-aggregated from all staff and department head targets for period ${period}`,
            adminTarget.id
          ]
        );
        
        console.log(`Admin target ${adminTarget.id} updated:`, {
          total_target: totalTarget,
          total_progress: totalProgress,
          total_shared_in: totalSharedIn,
          total_shared_out: totalSharedOut,
          net_amount: adminNetAmount,
          period: period
        });
        
        // Emit update event for real-time frontend refresh
        if (global.io) {
          global.io.emit('target_updated', {
            id: adminTarget.id,
            updated_by: 'System',
            reason: 'admin_target_aggregated',
            period: period
          });
          global.io.emit('target_progress_updated', {
            target_id: adminTarget.id,
            action: 'admin_target_recalculated',
            total_progress: totalProgress,
            net_amount: adminNetAmount
          });
        }
      }
    }
  } catch (error) {
    console.error('Error updating admin target in database:', error);
    // Don't throw - this is a background operation
  }
}

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
    // Only count approved progress entries (or NULL status for backward compatibility)
    // Use simpler syntax that works in both SQLite and PostgreSQL
    const totalProgressSubquery = targetProgressExists
      ? `(SELECT COALESCE(SUM(COALESCE(CAST(tp.amount AS NUMERIC), CAST(tp.progress_amount AS NUMERIC), 0)), 0) 
          FROM target_progress tp 
          WHERE tp.target_id = t.id
            AND (tp.status = 'Approved' OR tp.status IS NULL OR tp.status = ''))`
      : 'CAST(0 AS NUMERIC)';
    
    // Note: Only Approved progress entries are counted in net_amount calculation
    // Pending entries are not included until they are approved
    
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

    // Filter targets: Admin can see all targets including admin targets, others can only see non-admin targets
    if (req.user.role !== 'Admin') {
      // Non-admin users should not see admin targets
      const adminUser = await db.get("SELECT id FROM users WHERE role = 'Admin' LIMIT 1");
      if (adminUser) {
        query += ' AND t.user_id != ?';
        params.push(adminUser.id);
      }
    }
    // Use the column aliases in ORDER BY
    query += ' ORDER BY (COALESCE(total_progress, 0) + COALESCE(shared_in, 0) - COALESCE(shared_out, 0)) DESC, t.created_at DESC';

    console.log('Executing targets query (first 500 chars):', query.substring(0, 500));
    console.log('Query params:', params);
    console.log('Tables exist - targets:', !!tableExists, 'target_progress:', !!targetProgressExists, 'fund_sharing:', !!fundSharingExists, 'target_progress:', !!targetProgressExists);
    
    let targets = await db.all(query, params);
    console.log(`Fetched ${targets.length} targets from database`);
    
    // Calculate progress separately if subquery might have issues
    // This ensures we get accurate totals even if subquery has problems
    if (targetProgressExists && targets && targets.length > 0) {
      console.log('Recalculating progress for all targets separately...');
      for (let i = 0; i < targets.length; i++) {
        const target = targets[i];
        
        // Get approved progress entries manually
        const progressResult = await db.get(
          `SELECT COALESCE(SUM(COALESCE(CAST(amount AS NUMERIC), CAST(progress_amount AS NUMERIC), 0)), 0) as total
           FROM target_progress
           WHERE target_id = ?
             AND (status = 'Approved' OR status IS NULL OR status = '')`,
          [target.id]
        );
        
        const manualTotalProgress = parseFloat(progressResult?.total || 0) || 0;
        
        // Override the subquery result with manual calculation
        if (Math.abs(manualTotalProgress - parseFloat(target.total_progress || 0)) > 0.01) {
          console.log(`Target ${target.id}: Subquery returned ${target.total_progress}, manual calculation: ${manualTotalProgress} - USING MANUAL`);
          targets[i].total_progress = manualTotalProgress;
        } else {
          console.log(`Target ${target.id}: Subquery and manual match: ${target.total_progress}`);
        }
      }
    }
    
    if (targets && targets.length > 0) {
      console.log('First target sample after recalculation:', {
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
      if (targetProgressExists && targets.length > 0) {
        const firstTarget = targets[0];
        const progressCheck = await db.all(
          `SELECT id, amount, status, progress_amount
           FROM target_progress 
           WHERE target_id = ?`,
          [firstTarget.id]
        );
        console.log(`All progress entries for target ${firstTarget.id}:`, JSON.stringify(progressCheck, null, 2));
        
        const approvedCheck = await db.get(
          `SELECT COALESCE(SUM(COALESCE(CAST(amount AS NUMERIC), CAST(progress_amount AS NUMERIC), 0)), 0) as total, COUNT(*) as count
           FROM target_progress 
           WHERE target_id = ? AND (status = 'Approved' OR status IS NULL OR status = '')`,
          [firstTarget.id]
        );
        console.log(`Approved entries for target ${firstTarget.id}:`, approvedCheck);
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
    const targetsWithProgress = targets.map((target, index) => {
      // Ensure all values are numbers - use explicit parsing
      const totalProgress = parseFloat(String(target.total_progress || 0)) || 0;
      const sharedIn = parseFloat(String(target.shared_in || 0)) || 0;
      const sharedOut = parseFloat(String(target.shared_out || 0)) || 0;
      const targetAmount = parseFloat(String(target.target_amount || 0)) || 0;
      
      // Calculate net amount: total_progress + shared_in - shared_out
      const netAmount = totalProgress + sharedIn - sharedOut;
      
      // Calculate progress percentage
      const progressPercentage = targetAmount > 0 
        ? (netAmount / targetAmount) * 100 
        : 0;
      
      // Calculate remaining amount (cannot be negative)
      const remainingAmount = Math.max(0, targetAmount - netAmount);
      
      const result = {
        ...target,
        total_progress: totalProgress,
        shared_in: sharedIn,
        shared_out: sharedOut,
        net_amount: netAmount,
        progress_percentage: progressPercentage.toFixed(2),
        remaining_amount: remainingAmount
      };
      
      // Log calculation for debugging (first 3 targets)
      if (index < 3) {
        console.log(`Target ${index + 1} calculation:`, {
          target_id: target.id,
          user_name: target.user_name,
          target_amount: targetAmount,
          total_progress: totalProgress,
          shared_in: sharedIn,
          shared_out: sharedOut,
          net_amount: netAmount,
          progress_percentage: progressPercentage.toFixed(2),
          remaining_amount: remainingAmount
        });
      }
      
      return result;
    });

    // For admin targets, recalculate with aggregated staff and department head data
    // Find admin user and update admin targets with aggregated data
    try {
      const adminUser = await db.get("SELECT id FROM users WHERE role = 'Admin' LIMIT 1");
      if (adminUser) {
        for (let i = 0; i < targetsWithProgress.length; i++) {
          const target = targetsWithProgress[i];
          if (target.user_id === adminUser.id && target.status === 'Active') {
            // Recalculate admin target with aggregated staff and department head data
            // This includes both Staff and DepartmentHead roles (excludes Admin)
            const allStaffTargets = await db.all(
              `SELECT 
                COALESCE(SUM(target_amount), 0) as total_target,
                COALESCE(SUM(
                  ${targetProgressExists 
                    ? `(SELECT COALESCE(SUM(COALESCE(CAST(tp.amount AS NUMERIC), CAST(tp.progress_amount AS NUMERIC), 0)), 0) FROM target_progress tp WHERE CAST(tp.target_id AS INTEGER) = CAST(t.id AS INTEGER))`
                    : 'CAST(0 AS NUMERIC)'}
                ), 0) as total_progress,
                COALESCE(SUM(
                  ${fundSharingExists
                    ? `(SELECT COALESCE(SUM(CASE WHEN fs.status = 'Active' THEN CAST(fs.amount AS NUMERIC) ELSE 0 END), 0)
                         FROM fund_sharing fs WHERE CAST(fs.from_user_id AS INTEGER) = CAST(t.user_id AS INTEGER))`
                    : 'CAST(0 AS NUMERIC)'}
                ), 0) as total_shared_out,
                COALESCE(SUM(
                  ${fundSharingExists
                    ? `(SELECT COALESCE(SUM(CASE WHEN fs.status = 'Active' THEN CAST(fs.amount AS NUMERIC) ELSE 0 END), 0)
                         FROM fund_sharing fs WHERE CAST(fs.to_user_id AS INTEGER) = CAST(t.user_id AS INTEGER))`
                    : 'CAST(0 AS NUMERIC)'}
                ), 0) as total_shared_in
               FROM targets t
               WHERE CAST(t.user_id AS INTEGER) != CAST(? AS INTEGER) AND t.status = ? AND t.period_start = ?`,
              [adminUser.id, 'Active', target.period_start]
            );

            if (allStaffTargets && allStaffTargets[0]) {
              const staffData = allStaffTargets[0];
              const totalProgress = parseFloat(staffData.total_progress || 0);
              const totalSharedIn = parseFloat(staffData.total_shared_in || 0);
              const totalSharedOut = parseFloat(staffData.total_shared_out || 0);
              const totalTarget = parseFloat(staffData.total_target || 0);
              
              const adminNetAmount = totalProgress + totalSharedIn - totalSharedOut;
              const adminProgressPercentage = totalTarget > 0 
                ? (adminNetAmount / totalTarget) * 100 
                : 0;
              
              targetsWithProgress[i] = {
                ...target,
                target_amount: totalTarget,
                total_progress: totalProgress,
                shared_in: totalSharedIn,
                shared_out: totalSharedOut,
                net_amount: adminNetAmount,
                progress_percentage: adminProgressPercentage.toFixed(2),
                remaining_amount: Math.max(0, totalTarget - adminNetAmount)
              };
            }
          }
        }
      }
    } catch (adminTargetError) {
      console.error('Error recalculating admin target:', adminTargetError);
      // Don't fail the request if admin target recalculation fails
    }

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
             (SELECT COALESCE(SUM(COALESCE(tp.amount, tp.progress_amount, 0)), 0) 
              FROM target_progress tp 
              WHERE tp.target_id = t.id
                AND (tp.status = 'Approved' OR tp.status IS NULL OR tp.status = '')) as total_progress,
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

    const target = await db.get(query, params);

    if (!target) {
      return res.status(404).json({ error: 'Target not found' });
    }

    // Authorization: Non-admin users can only view their own targets
    // Admin can view all targets including admin aggregated targets
    if (req.user.role !== 'Admin') {
      // Check if this is an admin target (should be hidden from non-admin)
      const adminUser = await db.get("SELECT id FROM users WHERE role = 'Admin' LIMIT 1");
      if (adminUser && target.user_id === adminUser.id) {
        return res.status(403).json({ error: 'Access denied. Admin targets are only visible to Admin users.' });
      }
      
      // Non-admin users can only view their own targets
      if (target.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied. You can only view your own targets.' });
      }
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

    // Auto-create/update admin target when staff targets are created
    // Admin target aggregates all staff targets
    if (user.role !== 'Admin') {
      try {
        // Find admin user
        const adminUser = await db.get("SELECT id FROM users WHERE role = 'Admin' LIMIT 1");
        
        if (adminUser) {
          // Check if admin already has an active target for the same period
          const adminTarget = await db.get(
            'SELECT id FROM targets WHERE user_id = ? AND status = ? AND period_start = ?',
            [adminUser.id, 'Active', period_start]
          );

          if (adminTarget) {
            // Update admin target: sum all staff targets for this period
            const allStaffTargets = await db.all(
              `SELECT 
                COALESCE(SUM(target_amount), 0) as total_target,
                COALESCE(SUM(
                  (SELECT COALESCE(SUM(COALESCE(tp.amount, tp.progress_amount, 0)), 0) FROM target_progress tp WHERE tp.target_id = t.id AND (UPPER(TRIM(COALESCE(tp.status, ''))) = 'APPROVED' OR tp.status IS NULL))
                ), 0) as total_progress,
                COALESCE(SUM(
                  (SELECT COALESCE(SUM(CASE WHEN fs.status = 'Active' THEN fs.amount ELSE 0 END), 0)
                   FROM fund_sharing fs WHERE fs.from_user_id = t.user_id)
                ), 0) as total_shared_out,
                COALESCE(SUM(
                  (SELECT COALESCE(SUM(CASE WHEN fs.status = 'Active' THEN fs.amount ELSE 0 END), 0)
                   FROM fund_sharing fs WHERE fs.to_user_id = t.user_id)
                ), 0) as total_shared_in
               FROM targets t
               WHERE t.user_id != ? AND t.status = ? AND t.period_start = ?`,
              [adminUser.id, 'Active', period_start]
            );

            if (allStaffTargets && allStaffTargets[0]) {
              const staffData = allStaffTargets[0];
              const adminNetAmount = (staffData.total_progress || 0) + (staffData.total_shared_in || 0) - (staffData.total_shared_out || 0);
              
              await db.run(
                `UPDATE targets 
                 SET target_amount = ?, 
                     notes = ?,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [
                  staffData.total_target || 0,
                  `Auto-aggregated from all staff targets for period ${period_start}`,
                  adminTarget.id
                ]
              );
              
              console.log('Admin target updated with aggregated staff and department head targets');
              
              // Also update admin target in database using helper function
              await updateAdminTargetInDatabase(period_start);
              
              // Emit update event
              if (global.io) {
                global.io.emit('target_updated', {
                  id: adminTarget.id,
                  updated_by: 'System'
                });
              }
            }
          } else {
            // Create new admin target: sum all staff targets for this period
            const allStaffTargets = await db.all(
              `SELECT 
                COALESCE(SUM(target_amount), 0) as total_target
               FROM targets t
               WHERE t.user_id != ? AND t.status = ? AND t.period_start = ?`,
              [adminUser.id, 'Active', period_start]
            );

            if (allStaffTargets && allStaffTargets[0] && allStaffTargets[0].total_target > 0) {
              const adminTargetResult = await db.run(
                `INSERT INTO targets (user_id, target_amount, category, period_start, period_end, notes, created_by, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  adminUser.id,
                  allStaffTargets[0].total_target || 0,
                  category || 'Employee',
                  period_start,
                  period_end || null,
                  `Auto-aggregated from all staff targets for period ${period_start}`,
                  req.user.id,
                  'Active'
                ]
              );
              
              const adminTargetId = adminTargetResult.lastID || adminTargetResult.id || (adminTargetResult.rows && adminTargetResult.rows[0] && adminTargetResult.rows[0].id);
              
              console.log('Admin target created with aggregated staff and department head targets:', adminTargetId);
              
              // Also update admin target in database using helper function to ensure progress is included
              await updateAdminTargetInDatabase(period_start);
              
              // Emit create event
              if (global.io) {
                global.io.emit('target_created', {
                  id: adminTargetId,
                  user_id: adminUser.id,
                  user_name: 'System Administrator',
                  target_amount: allStaffTargets[0].total_target || 0,
                  created_by: 'System'
                });
              }
            }
          }
        }
      } catch (adminTargetError) {
        console.error('Error creating/updating admin target:', adminTargetError);
        // Don't fail the staff target creation if admin target update fails
      }
    }

    // Get the created target with all details
    // Use try-catch to handle query failures gracefully
    let createdTarget;
    try {
      createdTarget = await db.get(`
        SELECT t.*, 
               COALESCE(u.name, 'Unknown User') as user_name, 
               COALESCE(u.email, '') as user_email,
               COALESCE(u.role, '') as user_role,
               COALESCE(creator.name, 'System') as created_by_name,
               (SELECT COALESCE(SUM(COALESCE(CAST(tp.amount AS NUMERIC), CAST(tp.progress_amount AS NUMERIC), 0)), 0) 
                FROM target_progress tp 
                WHERE tp.target_id = t.id
                  AND (tp.status = 'Approved' OR tp.status IS NULL OR tp.status = '')) as total_progress,
               (SELECT COALESCE(SUM(CASE WHEN fs.status = 'Active' THEN CAST(fs.amount AS NUMERIC) ELSE 0 END), 0)
                FROM fund_sharing fs
                WHERE fs.from_user_id = t.user_id) as shared_out,
               (SELECT COALESCE(SUM(CASE WHEN fs.status = 'Active' THEN CAST(fs.amount AS NUMERIC) ELSE 0 END), 0)
                FROM fund_sharing fs
                WHERE fs.to_user_id = t.user_id) as shared_in
        FROM targets t
        LEFT JOIN users u ON t.user_id = u.id
        LEFT JOIN users creator ON t.created_by = creator.id
        WHERE t.id = ?
      `, [targetId]);
    } catch (queryError) {
      console.error('Error fetching created target with subqueries:', queryError);
      // Fallback to simpler query without subqueries
      createdTarget = await db.get(`
        SELECT t.*, 
               COALESCE(u.name, 'Unknown User') as user_name, 
               COALESCE(u.email, '') as user_email,
               COALESCE(u.role, '') as user_role,
               COALESCE(creator.name, 'System') as created_by_name
        FROM targets t
        LEFT JOIN users u ON t.user_id = u.id
        LEFT JOIN users creator ON t.created_by = creator.id
        WHERE t.id = ?
      `, [targetId]);
      
      if (createdTarget) {
        // Manually set progress values to 0 for new target
        createdTarget.total_progress = 0;
        createdTarget.shared_out = 0;
        createdTarget.shared_in = 0;
      }
    }

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
             (SELECT COALESCE(SUM(COALESCE(tp.amount, tp.progress_amount, 0)), 0) 
              FROM target_progress tp 
              WHERE tp.target_id = t.id
                AND (tp.status = 'Approved' OR tp.status IS NULL OR tp.status = '')) as total_progress,
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
              (SELECT COALESCE(SUM(COALESCE(tp.amount, tp.progress_amount, 0)), 0) FROM target_progress tp WHERE tp.target_id = t.id AND (tp.status = 'Approved' OR tp.status IS NULL)) as total_progress,
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
      
      // Emit fund_shared event to all users
      global.io.emit('fund_shared', {
        id: sharingId,
        from_user_id,
        from_user_name: sender?.name || 'Unknown',
        to_user_id,
        to_user_name: recipient.name,
        amount
      });
      console.log('Emitted fund_shared event to all users');
      
      // Also emit target update events for both sender and recipient targets
      global.io.emit('target_progress_updated', {
        target_id: senderTarget.id,
        user_id: from_user_id,
        action: 'fund_shared_out'
      });
      
      // Check if recipient has an active target
      const recipientTarget = await db.get(
        'SELECT id FROM targets WHERE user_id = ? AND status = ?',
        [to_user_id, 'Active']
      );
      
      if (recipientTarget) {
        global.io.emit('target_progress_updated', {
          target_id: recipientTarget.id,
          user_id: to_user_id,
          action: 'fund_shared_in'
        });
      }
      
      console.log('Emitted target_progress_updated events for fund sharing');
    }

    // Update admin target in database when fund sharing occurs
    try {
      const senderTargetInfo = await db.get('SELECT period_start FROM targets WHERE id = ?', [senderTarget.id]);
      if (senderTargetInfo && senderTargetInfo.period_start) {
        await updateAdminTargetInDatabase(senderTargetInfo.period_start);
        console.log('Admin target updated after fund sharing');
      }
    } catch (adminUpdateError) {
      console.error('Error updating admin target after fund sharing (non-fatal):', adminUpdateError);
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

    // Update admin target in database when fund sharing is reversed
    try {
      const fromTarget = await db.get('SELECT id, period_start FROM targets WHERE user_id = ? AND status = ?', [sharing.from_user_id, 'Active']);
      if (fromTarget && fromTarget.period_start) {
        await updateAdminTargetInDatabase(fromTarget.period_start);
        console.log('Admin target updated after fund sharing reversal');
      }
    } catch (adminUpdateError) {
      console.error('Error updating admin target after fund reversal (non-fatal):', adminUpdateError);
    }
    
    // Emit real-time updates for both sender and recipient targets
    if (global.io) {
      // Emit fund_reversed event
      global.io.emit('fund_reversed', {
        id: req.params.id,
        from_user_id: sharing.from_user_id,
        to_user_id: sharing.to_user_id,
        amount: sharing.amount,
        status: 'Reversed',
        reversed_by: req.user.name
      });
      
      // Emit target progress updates for both users
      global.io.emit('target_progress_updated', {
        target_id: null, // Will be fetched by frontend
        user_id: sharing.from_user_id
      });
      global.io.emit('target_progress_updated', {
        target_id: null,
        user_id: sharing.to_user_id
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

    // Authorization: Filter sharing records based on user role
    if (req.user.role !== 'Admin') {
      // Non-admin users can only see their own transactions (as sender or recipient)
      query += ' AND (fs.from_user_id = ? OR fs.to_user_id = ?)';
      params.push(req.user.id, req.user.id);
    }
    
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

    // Authorization: Check if user has access to this target
    if (req.user.role !== 'Admin') {
      // Non-admin users can only view progress for their own targets
      if (target.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied. You can only view progress for your own targets.' });
      }
    }

    const progress = await db.all(
      `SELECT tp.*, 
              COALESCE(pr.name, 'Manual Entry') as progress_report_name,
              COALESCE(pr.date, tp.transaction_date) as progress_report_date,
              COALESCE(pr.category, tp.category) as progress_report_category,
              COALESCE(pr.status, tp.status) as progress_report_status,
              COALESCE(u.name, 'System') as source_user_name
       FROM target_progress tp
       LEFT JOIN progress_reports pr ON tp.progress_report_id = pr.id
       LEFT JOIN users u ON tp.user_id = u.id
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

// Approve target progress entry (Admin only)
router.put('/progress/:id/approve', authenticateToken, requireRole('Admin'), [
  body('status').isIn(['Approved', 'Rejected']).withMessage('Status must be Approved or Rejected')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('Validation errors when approving progress:', errors.array());
      const errorMessage = errors.array().map(e => e.msg).join(', ');
      return res.status(400).json({ 
        error: errorMessage || 'Validation failed',
        errors: errors.array() 
      });
    }

    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }
    
    // Get the target progress entry
    const progressEntry = await db.get(
      `SELECT tp.*, t.user_id as target_user_id, t.period_start
       FROM target_progress tp
       LEFT JOIN targets t ON tp.target_id = t.id
       WHERE tp.id = ?`,
      [req.params.id]
    );

    if (!progressEntry) {
      console.error(`Target progress entry ${req.params.id} not found`);
      return res.status(404).json({ error: 'Target progress entry not found' });
    }

    console.log(`Updating progress entry ${req.params.id} from status "${progressEntry.status}" to "${status}"`);
    
    // Allow status changes: Approved -> Rejected, Rejected -> Approved, Pending/null -> Approved/Rejected
    // Only prevent if trying to set the same status it already has
    if (progressEntry.status === status) {
      return res.status(400).json({ 
        error: `This progress entry is already ${status.toLowerCase()}` 
      });
    }

    // Update the progress entry status
    // Check if updated_at column exists, if not, just update status
    const USE_POSTGRESQL = !!process.env.DATABASE_URL;
    let hasUpdatedAt = false;
    
    try {
      if (USE_POSTGRESQL) {
        const updatedAtCheck = await db.get(
          "SELECT column_name FROM information_schema.columns WHERE table_name = 'target_progress' AND column_name = 'updated_at'"
        );
        hasUpdatedAt = !!updatedAtCheck;
      } else {
        const tableInfo = await db.all("PRAGMA table_info(target_progress)");
        hasUpdatedAt = tableInfo.some(col => col.name === 'updated_at');
      }
    } catch (colCheckError) {
      console.error('Error checking updated_at column:', colCheckError);
      // Continue without updated_at
    }
    
    // Update the status - ensure it's stored as 'Approved' or 'Rejected' (capitalized)
    const normalizedStatus = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
    if (hasUpdatedAt) {
      await db.run(
        `UPDATE target_progress 
         SET status = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [normalizedStatus, req.params.id]
      );
    } else {
      await db.run(
        `UPDATE target_progress 
         SET status = ?
         WHERE id = ?`,
        [normalizedStatus, req.params.id]
      );
    }

    console.log(`Target progress entry ${req.params.id} status updated to: ${normalizedStatus}`);

    // Verify the update was successful
    const verifyUpdate = await db.get(
      'SELECT id, status, amount, target_id FROM target_progress WHERE id = ?',
      [req.params.id]
    );
    console.log('Verified target_progress update:', verifyUpdate);

    // If approved, update the target and admin target in real-time
    if (status === 'Approved') {
      // Wait a moment for database commit
      await new Promise(resolve => setTimeout(resolve, 100));

      // Update admin target in database first
      if (progressEntry.period_start) {
        await updateAdminTargetInDatabase(progressEntry.period_start);
      }

      // Wait again for admin target update to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      // Get updated target - use simpler query and manual calculation for reliability
      let updatedTarget = await db.get(
        `SELECT t.*
         FROM targets t
         WHERE t.id = ?`,
        [progressEntry.target_id]
      );
      
      if (!updatedTarget) {
        console.error('Target not found after approval:', progressEntry.target_id);
        return res.status(404).json({ error: 'Target not found' });
      }
      
      // Manually calculate total_progress from approved entries
      const progressResult = await db.get(
        `SELECT COALESCE(SUM(COALESCE(CAST(amount AS NUMERIC), CAST(progress_amount AS NUMERIC), 0)), 0) as total
         FROM target_progress
         WHERE target_id = ?
           AND (status = 'Approved' OR status IS NULL OR status = '')`,
        [progressEntry.target_id]
      );
      updatedTarget.total_progress = parseFloat(progressResult?.total || 0) || 0;
      
      // Manually calculate shared_in and shared_out
      const sharedOutResult = await db.get(
        `SELECT COALESCE(SUM(CASE WHEN status = 'Active' THEN CAST(amount AS NUMERIC) ELSE 0 END), 0) as total
         FROM fund_sharing
         WHERE from_user_id = ?`,
        [progressEntry.target_user_id]
      );
      updatedTarget.shared_out = parseFloat(sharedOutResult?.total || 0) || 0;
      
      const sharedInResult = await db.get(
        `SELECT COALESCE(SUM(CASE WHEN status = 'Active' THEN CAST(amount AS NUMERIC) ELSE 0 END), 0) as total
         FROM fund_sharing
         WHERE to_user_id = ?`,
        [progressEntry.target_user_id]
      );
      updatedTarget.shared_in = parseFloat(sharedInResult?.total || 0) || 0;

      console.log('Updated target after approval:', {
        target_id: progressEntry.target_id,
        total_progress: updatedTarget?.total_progress,
        shared_in: updatedTarget?.shared_in,
        shared_out: updatedTarget?.shared_out,
        target_amount: updatedTarget?.target_amount
      });

      // Also verify by directly querying target_progress
      // First, let's see ALL entries for this target
      const allProgressEntries = await db.all(
        `SELECT id, amount, status, CAST(amount AS NUMERIC) as amount_num
         FROM target_progress 
         WHERE CAST(target_id AS INTEGER) = CAST(? AS INTEGER)`,
        [progressEntry.target_id]
      );
      console.log('All progress entries for target', progressEntry.target_id, ':', allProgressEntries);
      
      // Then get the approved ones
      const directProgressCheck = await db.get(
        `SELECT 
          COALESCE(SUM(COALESCE(CAST(amount AS NUMERIC), CAST(progress_amount AS NUMERIC), 0)), 0) as total,
          COUNT(*) as count
         FROM target_progress 
         WHERE CAST(target_id AS INTEGER) = CAST(? AS INTEGER)
           AND (UPPER(TRIM(status)) = 'APPROVED' OR status IS NULL)`,
        [progressEntry.target_id]
      );
      console.log('Direct progress check after approval (approved entries):', directProgressCheck);
      
      // Also check with case-insensitive comparison
      const directProgressCheckCaseInsensitive = await db.get(
        `SELECT 
          COALESCE(SUM(COALESCE(CAST(amount AS NUMERIC), CAST(progress_amount AS NUMERIC), 0)), 0) as total,
          COUNT(*) as count
         FROM target_progress 
         WHERE CAST(target_id AS INTEGER) = CAST(? AS INTEGER)
           AND (UPPER(TRIM(COALESCE(status, ''))) = 'APPROVED' OR status IS NULL)`,
        [progressEntry.target_id]
      );
      console.log('Direct progress check (case-insensitive):', directProgressCheckCaseInsensitive);

      let netAmount = 0;
      let progressPercentage = 0;
      let remainingAmount = 0;
      
      if (updatedTarget) {
        const totalProgress = parseFloat(updatedTarget.total_progress || 0) || 0;
        const sharedIn = parseFloat(updatedTarget.shared_in || 0) || 0;
        const sharedOut = parseFloat(updatedTarget.shared_out || 0) || 0;
        const targetAmount = parseFloat(updatedTarget.target_amount || 0) || 0;
        
        netAmount = totalProgress + sharedIn - sharedOut;
        progressPercentage = targetAmount > 0 ? (netAmount / targetAmount) * 100 : 0;
        remainingAmount = Math.max(0, targetAmount - netAmount);

        console.log('Calculated values after approval:', {
          total_progress: totalProgress,
          shared_in: sharedIn,
          shared_out: sharedOut,
          net_amount: netAmount,
          progress_percentage: progressPercentage,
          remaining_amount: remainingAmount,
          target_amount: targetAmount
        });
      }

      // Emit real-time updates with updated values
      if (global.io) {
        // Emit immediately
        global.io.emit('target_progress_updated', {
          target_id: progressEntry.target_id,
          user_id: progressEntry.user_id,
          amount: parseFloat(progressEntry.amount || 0),
          progress_id: parseInt(req.params.id),
          action: 'progress_approved',
          status: 'Approved',
          total_progress: updatedTarget?.total_progress || 0,
          net_amount: netAmount,
          progress_percentage: progressPercentage.toFixed(2),
          remaining_amount: remainingAmount
        });

        global.io.emit('target_updated', {
          id: progressEntry.target_id,
          updated_by: req.user.name || 'Admin',
          reason: 'target_progress_approved',
          progress_added: true,
          net_amount: netAmount,
          progress_percentage: progressPercentage.toFixed(2),
          remaining_amount: remainingAmount,
          total_progress: updatedTarget?.total_progress || 0
        });

        // Also emit again after delay to ensure all clients get the update
        setTimeout(() => {
          global.io.emit('target_progress_updated', {
            target_id: progressEntry.target_id,
            user_id: progressEntry.user_id,
            amount: parseFloat(progressEntry.amount || 0),
            progress_id: parseInt(req.params.id),
            action: 'progress_approved',
            status: 'Approved',
            total_progress: updatedTarget?.total_progress || 0,
            net_amount: netAmount,
            progress_percentage: progressPercentage.toFixed(2),
            remaining_amount: remainingAmount
          });

          global.io.emit('target_updated', {
            id: progressEntry.target_id,
            updated_by: req.user.name || 'Admin',
            reason: 'target_progress_approved',
            progress_added: true,
            net_amount: netAmount,
            progress_percentage: progressPercentage.toFixed(2),
            remaining_amount: remainingAmount
          });
        }, 500);
      }

      await logAction(req.user.id, 'approve_target_progress', 'target_progress', req.params.id, { status }, req);

      res.json({ 
        message: `Target progress entry ${status.toLowerCase()} successfully`,
        progress_id: req.params.id,
        target: {
          id: progressEntry.target_id,
          net_amount: netAmount,
          progress_percentage: progressPercentage.toFixed(2),
          remaining_amount: remainingAmount,
          total_progress: updatedTarget?.total_progress || 0,
          shared_in: updatedTarget?.shared_in || 0,
          shared_out: updatedTarget?.shared_out || 0
        }
      });
    } else {
      // If rejected, just log and return
      await logAction(req.user.id, 'approve_target_progress', 'target_progress', req.params.id, { status }, req);
      
      // Emit update event even for rejection
      if (global.io) {
        global.io.emit('target_progress_updated', {
          target_id: progressEntry.target_id,
          user_id: progressEntry.user_id,
          progress_id: req.params.id,
          action: 'progress_rejected',
          status: 'Rejected'
        });
      }
      
      res.json({ 
        message: `Target progress entry ${status.toLowerCase()} successfully`,
        progress_id: req.params.id
      });
    }
  } catch (error) {
    console.error('Approve target progress error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      params: req.params,
      body: req.body
    });
    res.status(500).json({ 
      error: 'Failed to approve target progress entry',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
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

// Delete target (Admin only)
router.delete('/:id', authenticateToken, requireRole('Admin'), async (req, res) => {
  try {
    const target = await db.get('SELECT * FROM targets WHERE id = ?', [req.params.id]);
    
    if (!target) {
      return res.status(404).json({ error: 'Target not found' });
    }

    // Get user info to check if it's an admin target
    const targetUser = await db.get('SELECT role FROM users WHERE id = ?', [target.user_id]);
    const periodStart = target.period_start;
    
    // Delete the target
    await db.run('DELETE FROM targets WHERE id = ?', [req.params.id]);
    
    // Also delete associated target_progress records
    await db.run('DELETE FROM target_progress WHERE target_id = ?', [req.params.id]);
    
    await logAction(req.user.id, 'delete_target', 'targets', req.params.id, { 
      user_id: target.user_id,
      target_amount: target.target_amount 
    }, req);

    // If deleted target was a staff target, update admin target
    if (targetUser && targetUser.role !== 'Admin') {
      try {
        const adminUser = await db.get("SELECT id FROM users WHERE role = 'Admin' LIMIT 1");
        if (adminUser && periodStart) {
          const adminTarget = await db.get(
            'SELECT id FROM targets WHERE user_id = ? AND status = ? AND period_start = ?',
            [adminUser.id, 'Active', periodStart]
          );

          if (adminTarget) {
            // Recalculate admin target after staff target deletion
            const allStaffTargets = await db.all(
              `SELECT 
                COALESCE(SUM(target_amount), 0) as total_target,
                COALESCE(SUM(
                  (SELECT COALESCE(SUM(COALESCE(tp.amount, tp.progress_amount, 0)), 0) FROM target_progress tp WHERE tp.target_id = t.id AND (UPPER(TRIM(COALESCE(tp.status, ''))) = 'APPROVED' OR tp.status IS NULL))
                ), 0) as total_progress,
                COALESCE(SUM(
                  (SELECT COALESCE(SUM(CASE WHEN fs.status = 'Active' THEN fs.amount ELSE 0 END), 0)
                   FROM fund_sharing fs WHERE fs.from_user_id = t.user_id)
                ), 0) as total_shared_out,
                COALESCE(SUM(
                  (SELECT COALESCE(SUM(CASE WHEN fs.status = 'Active' THEN fs.amount ELSE 0 END), 0)
                   FROM fund_sharing fs WHERE fs.to_user_id = t.user_id)
                ), 0) as total_shared_in
               FROM targets t
               WHERE t.user_id != ? AND t.status = ? AND t.period_start = ?`,
              [adminUser.id, 'Active', periodStart]
            );

            if (allStaffTargets && allStaffTargets[0]) {
              const staffData = allStaffTargets[0];
              
              await db.run(
                `UPDATE targets 
                 SET target_amount = ?, 
                     notes = ?,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [
                  staffData.total_target || 0,
                  `Auto-aggregated from all staff targets for period ${periodStart}`,
                  adminTarget.id
                ]
              );
              
              console.log('Admin target updated after staff target deletion');
              
              // Emit update event
              if (global.io) {
                global.io.emit('target_updated', {
                  id: adminTarget.id,
                  updated_by: req.user.name
                });
              }
            }
          }
        }
      } catch (adminTargetError) {
        console.error('Error updating admin target after deletion:', adminTargetError);
      }
    }

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

// Recalculate all targets (Admin only) - ensures all approved progress entries are included
router.post('/recalculate-all', authenticateToken, requireRole('Admin'), async (req, res) => {
  try {
    console.log('Recalculating all targets...');
    
    // Check if target_progress and fund_sharing tables exist
    const USE_POSTGRESQL = !!process.env.DATABASE_URL;
    let targetProgressExists = false;
    let fundSharingExists = false;
    
    if (USE_POSTGRESQL) {
      const tpCheck = await db.get(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'target_progress'"
      );
      targetProgressExists = !!tpCheck;
      
      const fsCheck = await db.get(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fund_sharing'"
      );
      fundSharingExists = !!fsCheck;
    } else {
      const tpCheck = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='target_progress'");
      targetProgressExists = !!tpCheck;
      
      const fsCheck = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='fund_sharing'");
      fundSharingExists = !!fsCheck;
    }
    
    // Get all active targets
    const allTargets = await db.all(
      'SELECT id, user_id, period_start FROM targets WHERE status = ?',
      ['Active']
    );
    
    let recalculated = 0;
    const results = [];
    
    for (const target of allTargets) {
      // Recalculate total_progress using the same query as GET /targets
      // Use case-insensitive comparison for status
      // First, let's see ALL entries for this target for debugging
      const allEntries = targetProgressExists
        ? await db.all(
            `SELECT id, amount, status, progress_amount, CAST(amount AS NUMERIC) as amount_num
             FROM target_progress
             WHERE CAST(target_id AS INTEGER) = CAST(? AS INTEGER)`,
            [target.id]
          )
        : [];
      
      console.log(`Target ${target.id} - All progress entries:`, allEntries);
      
      const totalProgressResult = targetProgressExists
        ? await db.get(
            `SELECT 
              COALESCE(SUM(COALESCE(CAST(amount AS NUMERIC), CAST(progress_amount AS NUMERIC), 0)), 0) as total,
              COUNT(*) as count
             FROM target_progress
             WHERE CAST(target_id AS INTEGER) = CAST(? AS INTEGER)
               AND (UPPER(TRIM(COALESCE(status, ''))) = 'APPROVED' OR status IS NULL)`,
            [target.id]
          )
        : { total: 0, count: 0 };
      
      console.log(`Target ${target.id} - Approved entries summary:`, {
        total: totalProgressResult?.total,
        count: totalProgressResult?.count,
        entries_checked: allEntries.length
      });
      
      // Show status breakdown
      if (allEntries.length > 0) {
        const statusBreakdown = await db.all(
          `SELECT status, COUNT(*) as count, SUM(CAST(amount AS NUMERIC)) as total_amount
           FROM target_progress 
           WHERE CAST(target_id AS INTEGER) = CAST(? AS INTEGER)
           GROUP BY status`,
          [target.id]
        );
        console.log(`Target ${target.id} - Status breakdown:`, statusBreakdown);
      }
      
      const totalProgress = parseFloat(totalProgressResult?.total || 0) || 0;
      
      // Recalculate shared_in and shared_out
      const sharedOutResult = fundSharingExists
        ? await db.get(
            `SELECT COALESCE(SUM(CASE WHEN status = 'Active' THEN CAST(amount AS NUMERIC) ELSE 0 END), 0) as total
             FROM fund_sharing
             WHERE CAST(from_user_id AS INTEGER) = CAST(? AS INTEGER)`,
            [target.user_id]
          )
        : { total: 0 };
      
      const sharedOut = parseFloat(sharedOutResult?.total || 0) || 0;
      
      const sharedInResult = fundSharingExists
        ? await db.get(
            `SELECT COALESCE(SUM(CASE WHEN status = 'Active' THEN CAST(amount AS NUMERIC) ELSE 0 END), 0) as total
             FROM fund_sharing
             WHERE CAST(to_user_id AS INTEGER) = CAST(? AS INTEGER)`,
            [target.user_id]
          )
        : { total: 0 };
      
      const sharedIn = parseFloat(sharedInResult?.total || 0) || 0;
      
      // Get target_amount
      const targetInfo = await db.get('SELECT target_amount FROM targets WHERE id = ?', [target.id]);
      const targetAmount = parseFloat(targetInfo?.target_amount || 0) || 0;
      
      // Calculate net amount
      const netAmount = totalProgress + sharedIn - sharedOut;
      
      // Calculate progress percentage
      const progressPercentage = targetAmount > 0 ? (netAmount / targetAmount) * 100 : 0;
      
      // Calculate remaining amount
      const remainingAmount = Math.max(0, targetAmount - netAmount);
      
      results.push({
        target_id: target.id,
        user_id: target.user_id,
        total_progress: totalProgress,
        shared_in: sharedIn,
        shared_out: sharedOut,
        net_amount: netAmount,
        progress_percentage: progressPercentage.toFixed(2),
        remaining_amount: remainingAmount
      });
      
      recalculated++;
      
      console.log(`Recalculated target ${target.id}:`, {
        total_progress: totalProgress,
        shared_in: sharedIn,
        shared_out: sharedOut,
        net_amount: netAmount
      });
    }
    
    // Update admin targets
    await updateAdminTargetInDatabase();
    
    // Emit real-time update to refresh all clients
    if (global.io) {
      global.io.emit('target_updated', {
        updated_by: req.user.name || 'Admin',
        reason: 'all_targets_recalculated',
        recalculated_count: recalculated
      });
      global.io.emit('target_progress_updated', {
        action: 'recalculate_all',
        recalculated_count: recalculated
      });
    }
    
    await logAction(req.user.id, 'recalculate_all_targets', 'targets', null, { recalculated }, req);
    
    res.json({
      message: `Successfully recalculated ${recalculated} targets`,
      recalculated,
      results
    });
  } catch (error) {
    console.error('Recalculate all targets error:', error);
    res.status(500).json({ error: 'Failed to recalculate targets: ' + error.message });
  }
});

// Diagnostic endpoint to check target progress entries (Admin only)
router.get('/diagnostic/:targetId', authenticateToken, requireRole('Admin'), async (req, res) => {
  try {
    const targetId = req.params.targetId;
    
    // Get all progress entries for this target
    const allEntries = await db.all(
      `SELECT 
        id, 
        target_id, 
        amount, 
        status, 
        progress_amount,
        transaction_date,
        CAST(amount AS NUMERIC) as amount_num,
        UPPER(TRIM(COALESCE(status, ''))) as status_normalized
       FROM target_progress
       WHERE CAST(target_id AS INTEGER) = CAST(? AS INTEGER)
       ORDER BY id DESC`,
      [targetId]
    );
    
    // Test different query variations
    const query1 = await db.get(
      `SELECT 
        COALESCE(SUM(COALESCE(CAST(amount AS NUMERIC), CAST(progress_amount AS NUMERIC), 0)), 0) as total,
        COUNT(*) as count
       FROM target_progress
       WHERE CAST(target_id AS INTEGER) = CAST(? AS INTEGER)
         AND (UPPER(TRIM(COALESCE(status, ''))) = 'APPROVED' OR status IS NULL)`,
      [targetId]
    );
    
    const query2 = await db.get(
      `SELECT 
        COALESCE(SUM(COALESCE(CAST(amount AS NUMERIC), CAST(progress_amount AS NUMERIC), 0)), 0) as total,
        COUNT(*) as count
       FROM target_progress
       WHERE CAST(target_id AS INTEGER) = CAST(? AS INTEGER)
         AND status = 'Approved'`,
      [targetId]
    );
    
    const query3 = await db.get(
      `SELECT 
        COALESCE(SUM(COALESCE(CAST(amount AS NUMERIC), CAST(progress_amount AS NUMERIC), 0)), 0) as total,
        COUNT(*) as count
       FROM target_progress
       WHERE CAST(target_id AS INTEGER) = CAST(? AS INTEGER)`,
      [targetId]
    );
    
    res.json({
      target_id: targetId,
      all_entries: allEntries,
      queries: {
        case_insensitive_approved_or_null: query1,
        exact_match_approved: query2,
        all_entries_total: query3
      }
    });
  } catch (error) {
    console.error('Diagnostic error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export the helper function for use in other routes
module.exports = router;
module.exports.updateAdminTargetInDatabase = updateAdminTargetInDatabase;


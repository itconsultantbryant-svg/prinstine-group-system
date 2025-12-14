const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, requireRole, hashPassword } = require('../utils/auth');
const { logAction } = require('../utils/audit');
const crypto = require('crypto');

// Generate unique client ID
function generateClientId() {
  return 'CLT-' + Date.now().toString().slice(-8) + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();
}

// Get all progress reports (accessible to Admin, Department Heads, and Staff)
router.get('/', authenticateToken, requireRole('Admin', 'DepartmentHead', 'Staff'), async (req, res) => {
  try {
    const { from_date, to_date, category, status, department_id, created_by } = req.query;
    
    let query = `
      SELECT pr.*, d.name as department_full_name
      FROM progress_reports pr
      LEFT JOIN departments d ON pr.department_id = d.id
      WHERE 1=1
    `;
    const params = [];

    // Filter by date range
    if (from_date) {
      query += ' AND DATE(pr.date) >= ?';
      params.push(from_date);
    }
    if (to_date) {
      query += ' AND DATE(pr.date) <= ?';
      params.push(to_date);
    }
    
    // Filter by category
    if (category) {
      query += ' AND pr.category = ?';
      params.push(category);
    }
    
    // Filter by status
    if (status) {
      query += ' AND pr.status = ?';
      params.push(status);
    }
    
    // Filter by department
    if (department_id) {
      query += ' AND pr.department_id = ?';
      params.push(department_id);
    }
    
    // Filter by creator
    if (created_by) {
      query += ' AND pr.created_by = ?';
      params.push(created_by);
    }

    query += ' ORDER BY pr.date DESC, pr.created_at DESC';

    const reports = await db.all(query, params);
    res.json({ reports });
  } catch (error) {
    console.error('Get progress reports error:', error);
    // If table doesn't exist, return empty array instead of 500 error
    if (error.message && error.message.includes('no such table')) {
      console.warn('progress_reports table does not exist yet');
      return res.json({ reports: [] });
    }
    res.status(500).json({ error: 'Failed to fetch progress reports' });
  }
});

// Get single progress report
router.get('/:id', authenticateToken, requireRole('Admin', 'DepartmentHead', 'Staff'), async (req, res) => {
  try {
    const report = await db.get(
      `SELECT pr.*, d.name as department_full_name
       FROM progress_reports pr
       LEFT JOIN departments d ON pr.department_id = d.id
       WHERE pr.id = ?`,
      [req.params.id]
    );

    if (!report) {
      return res.status(404).json({ error: 'Progress report not found' });
    }

    res.json({ report });
  } catch (error) {
    console.error('Get progress report error:', error);
    res.status(500).json({ error: 'Failed to fetch progress report' });
  }
});

// Create progress report
router.post('/', authenticateToken, requireRole('Admin', 'DepartmentHead', 'Staff'), [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('date').isISO8601().withMessage('Valid date is required'),
  body('category').isIn(['Student', 'Client for Consultancy', 'Client for Audit', 'Others']).withMessage('Valid category is required'),
  body('status').optional().isIn(['Signed Contract', 'Pipeline Client', 'Submitted']).withMessage('Valid status is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, date, category, status, amount } = req.body;

    // All progress reports require admin approval
    // Set initial status to 'Pending' (pending admin approval)
    const reportStatus = 'Pending';

    // Get user's department information
    // For DepartmentHead: Join on head_email
    // For Staff: Get department from staff table
    let user, departmentId, departmentName;
    
    if (req.user.role === 'Staff') {
      // Get department from staff record
      const staff = await db.get(
        `SELECT s.department, d.id as department_id, d.name as department_name
         FROM staff s
         LEFT JOIN departments d ON d.name = s.department
         WHERE s.user_id = ?`,
        [req.user.id]
      );
      if (staff) {
        departmentId = staff.department_id;
        departmentName = staff.department_name || staff.department;
      }
      user = req.user;
    } else {
      // For Admin and DepartmentHead: Join on head_email
      const userWithDept = await db.get(
        `SELECT u.*, d.id as department_id, d.name as department_name
         FROM users u
         LEFT JOIN departments d ON LOWER(TRIM(d.head_email)) = LOWER(TRIM(u.email))
         WHERE u.id = ?`,
        [req.user.id]
      );
      if (userWithDept) {
        user = userWithDept;
        departmentId = userWithDept.department_id;
        departmentName = userWithDept.department_name;
      } else {
        user = req.user;
      }
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create progress report
    // Ensure created_by_name and created_by_email are not null
    const createdByName = req.user.name || user.name || 'Unknown';
    const createdByEmail = req.user.email || user.email || '';
    
    const result = await db.run(
      `INSERT INTO progress_reports 
       (name, date, category, status, amount, department_id, department_name, created_by, created_by_name, created_by_email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        date,
        category,
        reportStatus, // Always 'Pending' for admin approval
        amount || 0,
        user.department_id || null,
        user.department_name || null,
        req.user.id,
        createdByName,
        createdByEmail
      ]
    );

    // Also create a client entry from the progress report (only for client categories, not students)
    let clientId = null;
    let clientCreated = false;
    let createdClientId = null;
    
    // Only create client if category is not 'Student'
    if (category !== 'Student' && (category === 'Client for Consultancy' || category === 'Client for Audit' || category === 'Others')) {
      try {
        // Check if clients table exists
        const USE_POSTGRESQL = !!process.env.DATABASE_URL;
        let clientsTableExists = false;
        
        if (USE_POSTGRESQL) {
          const tableCheck = await db.get(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'clients'"
          );
          clientsTableExists = !!tableCheck;
        } else {
          const tableCheck = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='clients'");
          clientsTableExists = !!tableCheck;
        }
        
        if (!clientsTableExists) {
          console.log('Clients table does not exist, skipping client creation');
        } else {
          // Generate unique email for client based on name and timestamp
          const sanitizedName = name.toLowerCase().replace(/[^a-z0-9]/g, '.');
          const timestamp = Date.now().toString().slice(-6);
          const clientEmail = `${sanitizedName}.${timestamp}@progress.local`;
          
          // Check if a client with this name already exists (by company_name or user name)
          const existingClientByName = await db.get(
            'SELECT id, user_id FROM clients WHERE company_name = ? OR (SELECT name FROM users WHERE id = clients.user_id) = ?',
            [name, name]
          );
          
          if (!existingClientByName) {
            // Check if user exists
            let userId = null;
            const existingUser = await db.get('SELECT id FROM users WHERE email = ?', [clientEmail]);
            
            if (!existingUser) {
              // Create user for client
              const { hashPassword } = require('../utils/auth');
              const passwordHash = await hashPassword('Client@123'); // Default password
              
              const userResult = await db.run(
                `INSERT INTO users (email, username, password_hash, role, name, is_active, email_verified)
                 VALUES (?, ?, ?, ?, ?, 1, 1)`,
                [clientEmail, clientEmail.split('@')[0], passwordHash, 'Client', name]
              );
              userId = USE_POSTGRESQL ? (userResult.rows && userResult.rows[0] && userResult.rows[0].id) : userResult.lastID;
            } else {
              userId = existingUser.id;
            }

            // Check if client already exists for this user
            const existingClient = await db.get('SELECT id FROM clients WHERE user_id = ?', [userId]);
            if (!existingClient) {
              const generatedClientId = generateClientId();
              
              // Map progress report category to client table category
              const categoryMap = {
                'Client for Consultancy': 'client for consultancy',
                'Client for Audit': 'client for audit',
                'Others': 'others'
              };
              const clientCategory = categoryMap[category] || category.toLowerCase();
              
              // Map progress report status to client table progress_status
              const statusMap = {
                'Signed Contract': 'signed contract',
                'Pipeline Client': 'pipeline client',
                'Submitted': 'submitted',
                'Pending': 'pending'
              };
              const clientProgressStatus = statusMap[status] || (status ? status.toLowerCase() : 'pending');
              
              // Check which columns exist in clients table
              let clientsColumnNames = [];
              if (USE_POSTGRESQL) {
                const columns = await db.all(
                  "SELECT column_name FROM information_schema.columns WHERE table_name = 'clients'"
                );
                clientsColumnNames = columns.map(col => col.column_name);
              } else {
                const tableInfo = await db.all("PRAGMA table_info(clients)");
                clientsColumnNames = tableInfo.map(col => col.name);
              }
              
              const hasCategory = clientsColumnNames.includes('category');
              const hasProgressStatus = clientsColumnNames.includes('progress_status');
              const hasCreatedBy = clientsColumnNames.includes('created_by');
              
              // Build INSERT query dynamically
              let insertColumns = ['user_id', 'client_id', 'company_name', 'status'];
              let insertValues = [userId, generatedClientId, name, 'Active'];
              
              if (hasCategory) {
                insertColumns.push('category');
                insertValues.push(clientCategory);
              }
              if (hasProgressStatus) {
                insertColumns.push('progress_status');
                insertValues.push(clientProgressStatus);
              }
              if (hasCreatedBy) {
                insertColumns.push('created_by');
                insertValues.push(req.user.id);
              }
              
              const placeholders = insertColumns.map(() => '?').join(', ');
              const clientResult = await db.run(
                `INSERT INTO clients (${insertColumns.join(', ')})
                 VALUES (${placeholders})`,
                insertValues
              );
              
              createdClientId = USE_POSTGRESQL 
                ? (clientResult.rows && clientResult.rows[0] && clientResult.rows[0].id)
                : clientResult.lastID;
              
              clientId = generatedClientId;
              clientCreated = true;
              
              console.log('Client created from progress report:', {
                client_id: generatedClientId,
                client_db_id: createdClientId,
                name: name,
                category: clientCategory
              });
              
              // Emit real-time update for new client to all connected clients
              if (global.io) {
                global.io.emit('client_created', {
                  id: createdClientId,
                  client_id: generatedClientId,
                  name: name,
                  company_name: name,
                  category: clientCategory,
                  progress_status: clientProgressStatus,
                  status: 'Active',
                  created_by: req.user.name || user.name,
                  created_by_email: req.user.email || user.email
                });
                console.log('Emitted client_created event for client:', generatedClientId);
              }
            } else {
              console.log('Client already exists for this user, skipping client creation');
            }
          } else {
            console.log('Client with this name already exists, skipping client creation');
            // Update existing client's progress_status if status changed
            if (status) {
              try {
                const statusMap = {
                  'Signed Contract': 'signed contract',
                  'Pipeline Client': 'pipeline client',
                  'Submitted': 'submitted',
                  'Pending': 'pending'
                };
                const clientProgressStatus = statusMap[status] || status.toLowerCase();
                
                // Check if progress_status column exists
                let clientsColumnNames = [];
                if (USE_POSTGRESQL) {
                  const columns = await db.all(
                    "SELECT column_name FROM information_schema.columns WHERE table_name = 'clients'"
                  );
                  clientsColumnNames = columns.map(col => col.column_name);
                } else {
                  const tableInfo = await db.all("PRAGMA table_info(clients)");
                  clientsColumnNames = tableInfo.map(col => col.name);
                }
                
                if (clientsColumnNames.includes('progress_status')) {
                  await db.run(
                    'UPDATE clients SET progress_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                    [clientProgressStatus, existingClientByName.id]
                  );
                  
                  // Emit update event
                  if (global.io) {
                    global.io.emit('client_updated', {
                      id: existingClientByName.id,
                      progress_status: clientProgressStatus,
                      updated_by: req.user.name
                    });
                  }
                }
              } catch (updateError) {
                console.error('Error updating existing client progress_status:', updateError);
              }
            }
          }
        }
      } catch (clientError) {
        // Log error but don't fail the progress report creation
        console.error('Error creating client from progress report:', clientError);
      }
    }

    await logAction(req.user.id, 'create_progress_report', 'progress_reports', result.lastID, { name, category, status }, req);

    // Auto-update target progress if amount is provided
    if (amount && parseFloat(amount) > 0) {
      try {
        console.log('Processing target progress update for progress report:', {
          progress_report_id: result.lastID,
          amount: amount,
          user_id: req.user.id
        });
        
        // Find active target for the creator
        const target = await db.get(
          'SELECT * FROM targets WHERE user_id = ? AND status = ?',
          [req.user.id, 'Active']
        );

        if (target) {
          console.log('Found active target:', { target_id: target.id, user_id: req.user.id });
          
          // Check if progress already recorded for this report
          const existingProgress = await db.get(
            'SELECT id FROM target_progress WHERE progress_report_id = ?',
            [result.lastID]
          );

          if (!existingProgress) {
            // Create new progress record
            const progressResult = await db.run(
              `INSERT INTO target_progress (target_id, user_id, progress_report_id, amount, category, status, transaction_date)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                target.id,
                req.user.id,
                result.lastID,
                parseFloat(amount),
                category,
                status,
                date
              ]
            );
            
            const progressId = progressResult.lastID || progressResult.id || (progressResult.rows && progressResult.rows[0] && progressResult.rows[0].id);
            
            console.log('Target progress created successfully:', {
              progress_id: progressId,
              target_id: target.id,
              user_id: req.user.id,
              amount: parseFloat(amount),
              progress_report_id: result.lastID,
              progressResult: progressResult
            });
            
            // Verify the progress was created
            const verifyProgress = await db.get(
              'SELECT * FROM target_progress WHERE id = ?',
              [progressId]
            );
            console.log('Verified target progress record:', verifyProgress);
            
            // Verify the total progress for this target
            const totalProgressCheck = await db.get(
              'SELECT COALESCE(SUM(amount), 0) as total FROM target_progress WHERE target_id = ?',
              [target.id]
            );
            console.log('Total progress for target', target.id, ':', totalProgressCheck);
            
            // Emit real-time update for target progress - emit to all users so everyone sees the update
            if (global.io) {
              global.io.emit('target_progress_updated', {
                target_id: target.id,
                user_id: req.user.id,
                amount: parseFloat(amount),
                progress_report_id: result.lastID,
                total_progress: totalProgressCheck?.total || 0
              });
              console.log('Emitted target_progress_updated event to all users');
            }
          } else {
            console.log('Target progress already exists for progress report:', result.lastID);
          }
        } else {
          console.log('No active target found for user:', req.user.id);
        }
      } catch (targetError) {
        // Log but don't fail the progress report creation
        console.error('Error updating target progress:', targetError);
        console.error('Error details:', {
          message: targetError.message,
          code: targetError.code,
          stack: targetError.stack?.split('\n').slice(0, 5).join('\n')
        });
      }
    } else {
      console.log('No amount provided or amount is 0, skipping target progress update');
    }

    // Emit real-time update for progress report
    if (global.io) {
      global.io.emit('progress_report_created', {
        id: result.lastID,
        name: name,
        category: category,
        status: status,
        amount: amount || 0,
        department: user.department_name || null,
        created_by: req.user.name || user.name
      });
    }

    res.status(201).json({
      message: 'Progress report created successfully',
      report: { id: result.lastID },
      client_created: clientCreated,
      client_id: clientId
    });
  } catch (error) {
    console.error('Create progress report error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sql: error.sql
    });
    
    // Handle specific database errors
    let errorMessage = 'Failed to create progress report';
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

// Update progress report (only by creator or admin)
router.put('/:id', authenticateToken, requireRole('Admin', 'DepartmentHead', 'Staff'), [
  body('name').optional().trim().notEmpty(),
  body('date').optional().isISO8601(),
  body('category').optional().isIn(['Student', 'Client for Consultancy', 'Client for Audit', 'Others']),
  body('status').optional().isIn(['Signed Contract', 'Pipeline Client', 'Submitted'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check if report exists and user has permission
    const report = await db.get('SELECT * FROM progress_reports WHERE id = ?', [req.params.id]);
    if (!report) {
      return res.status(404).json({ error: 'Progress report not found' });
    }

    // Admin can edit all progress reports, others can only edit their own
    if (req.user.role !== 'Admin' && report.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    // Non-admin users can only edit if report is still pending approval
    if (req.user.role !== 'Admin' && report.status !== 'Pending') {
      return res.status(403).json({ error: 'Cannot edit progress report that has been approved or rejected' });
    }

    const updates = [];
    const params = [];

    if (req.body.name) {
      updates.push('name = ?');
      params.push(req.body.name);
    }
    if (req.body.date) {
      updates.push('date = ?');
      params.push(req.body.date);
    }
    if (req.body.category) {
      updates.push('category = ?');
      params.push(req.body.category);
    }
    if (req.body.status) {
      updates.push('status = ?');
      params.push(req.body.status);
    }
    if (req.body.amount !== undefined) {
      updates.push('amount = ?');
      params.push(req.body.amount);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(req.params.id);

    await db.run(
      `UPDATE progress_reports SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    // Auto-update target progress if amount is updated
    if (req.body.amount !== undefined) {
      try {
        const updatedReport = await db.get('SELECT * FROM progress_reports WHERE id = ?', [req.params.id]);
        if (updatedReport) {
          const target = await db.get(
            'SELECT * FROM targets WHERE user_id = ? AND status = ?',
            [updatedReport.created_by, 'Active']
          );

          if (target) {
            const existingProgress = await db.get(
              'SELECT id FROM target_progress WHERE progress_report_id = ?',
              [req.params.id]
            );

            if (existingProgress) {
              await db.run(
                `UPDATE target_progress 
                 SET amount = ?, category = ?, status = ?, transaction_date = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE progress_report_id = ?`,
                [
                  updatedReport.amount || 0,
                  updatedReport.category,
                  updatedReport.status,
                  updatedReport.date,
                  req.params.id
                ]
              );
            } else {
              await db.run(
                `INSERT INTO target_progress (target_id, user_id, progress_report_id, amount, category, status, transaction_date)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                  target.id,
                  updatedReport.created_by,
                  req.params.id,
                  updatedReport.amount || 0,
                  updatedReport.category,
                  updatedReport.status,
                  updatedReport.date
                ]
              );
            }
            
            // Verify the total progress for this target
            const totalProgressCheck = await db.get(
              'SELECT COALESCE(SUM(amount), 0) as total FROM target_progress WHERE target_id = ?',
              [target.id]
            );
            console.log('Total progress for target', target.id, 'after update:', totalProgressCheck);
            
            // Emit real-time update for target progress - emit to all users
            if (global.io) {
              global.io.emit('target_progress_updated', {
                target_id: target.id,
                user_id: updatedReport.created_by,
                amount: updatedReport.amount || 0,
                progress_report_id: req.params.id,
                total_progress: totalProgressCheck?.total || 0
              });
              console.log('Emitted target_progress_updated event to all users');
            }
          }
        }
      } catch (targetError) {
        console.error('Error updating target progress:', targetError);
      }
    }

    await logAction(req.user.id, 'update_progress_report', 'progress_reports', req.params.id, req.body, req);

    // Emit real-time update
    if (global.io) {
      global.io.emit('progress_report_updated', {
        id: req.params.id,
        updated_by: req.user.name
      });
    }

    res.json({ message: 'Progress report updated successfully' });
  } catch (error) {
    console.error('Update progress report error:', error);
    res.status(500).json({ error: 'Failed to update progress report' });
  }
});

// Admin approval/rejection for progress reports
router.put('/:id/approve', authenticateToken, requireRole('Admin'), [
  body('status').isIn(['Approved', 'Rejected']).withMessage('Status must be Approved or Rejected'),
  body('admin_notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status, admin_notes } = req.body;
    const report = await db.get('SELECT * FROM progress_reports WHERE id = ?', [req.params.id]);
    
    if (!report) {
      return res.status(404).json({ error: 'Progress report not found' });
    }

    if (report.status !== 'Pending') {
      return res.status(400).json({ error: 'Progress report is not pending approval' });
    }

    await db.run(
      `UPDATE progress_reports 
       SET status = ?, admin_notes = ?, admin_reviewed_by = ?, admin_reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [status, admin_notes || null, req.user.id, req.params.id]
    );

    await logAction(req.user.id, 'approve_progress_report', 'progress_reports', req.params.id, { status }, req);

    // Send notification to creator
    try {
      const { sendNotificationToUser } = require('../utils/notifications');
      await sendNotificationToUser(report.created_by, {
        title: `Progress Report ${status}`,
        message: `Your progress report "${report.name}" has been ${status.toLowerCase()}`,
        link: `/progress-reports/${req.params.id}`,
        type: status === 'Approved' ? 'success' : 'warning',
        senderId: req.user.id
      });
    } catch (notifError) {
      console.error('Error sending notification:', notifError);
    }

    // Emit real-time update
    if (global.io) {
      global.io.emit('progress_report_updated', {
        id: req.params.id,
        status: status,
        reviewed_by: req.user.name
      });
    }

    res.json({ message: `Progress report ${status.toLowerCase()} successfully` });
  } catch (error) {
    console.error('Approve progress report error:', error);
    res.status(500).json({ error: 'Failed to approve progress report' });
  }
});

// Delete progress report (only by creator or admin)
router.delete('/:id', authenticateToken, requireRole('Admin', 'DepartmentHead', 'Staff'), async (req, res) => {
  try {
    const report = await db.get('SELECT * FROM progress_reports WHERE id = ?', [req.params.id]);
    if (!report) {
      return res.status(404).json({ error: 'Progress report not found' });
    }

    // Only creator or admin can delete
    if (req.user.role !== 'Admin' && report.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    await db.run('DELETE FROM progress_reports WHERE id = ?', [req.params.id]);
    await logAction(req.user.id, 'delete_progress_report', 'progress_reports', req.params.id, {}, req);

    res.json({ message: 'Progress report deleted successfully' });
  } catch (error) {
    console.error('Delete progress report error:', error);
    res.status(500).json({ error: 'Failed to delete progress report' });
  }
});

module.exports = router;


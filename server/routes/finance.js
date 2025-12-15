const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, requireRole } = require('../utils/auth');
const { logAction } = require('../utils/audit');
const { createNotification, sendNotificationToRole } = require('../utils/notifications');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/finance');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

// Helper function to check if user is Finance staff
async function isFinanceStaff(user) {
  if (user.role === 'Admin') return true;
  if (user.role === 'DepartmentHead') {
    const dept = await db.get(
      'SELECT name FROM departments WHERE manager_id = ? OR LOWER(TRIM(head_email)) = ?',
      [user.id, user.email.toLowerCase().trim()]
    );
    return dept && dept.name.toLowerCase().includes('finance');
  }
  // Assistant Finance Officer role check - we'll check by email or a role field
  // For now, Staff role with Finance department access
  const staff = await db.get('SELECT department FROM staff WHERE user_id = ?', [user.id]);
  return staff && staff.department && staff.department.toLowerCase().includes('finance');
}

// Helper function to check if user is Assistant Finance Officer (Staff in Finance)
async function isAssistantFinanceOfficer(user) {
  if (user.role === 'Staff') {
    const staff = await db.get('SELECT department FROM staff WHERE user_id = ?', [user.id]);
    return staff && staff.department && staff.department.toLowerCase().includes('finance');
  }
  return false;
}

// Helper function to check if user is Finance Department Head
async function isFinanceDepartmentHead(user) {
  if (user.role === 'DepartmentHead') {
    const dept = await db.get(
      'SELECT name FROM departments WHERE manager_id = ? OR LOWER(TRIM(head_email)) = ?',
      [user.id, user.email.toLowerCase().trim()]
    );
    return dept && dept.name.toLowerCase().includes('finance');
  }
  return false;
}

// Helper function to generate Petty Cash Slip Number
function generatePettyCashSlipNo(year, month) {
  const monthStr = String(month).padStart(2, '0');
  return `PC-${year}-${monthStr}-001`; // Sequential will be handled per ledger
}

// Helper function to get month name
const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                'July', 'August', 'September', 'October', 'November', 'December'];

// Helper function to generate Asset ID
function generateAssetId(category) {
  const categoryCode = category.substring(0, 2).toUpperCase();
  const timestamp = Date.now().toString().slice(-6);
  return `A${timestamp}-${categoryCode}-01`;
}

// ==========================================
// PETTY CASH LEDGER ROUTES
// ==========================================

// Get all petty cash ledgers
router.get('/petty-cash/ledgers', authenticateToken, async (req, res) => {
  try {
    const { year, month, status } = req.query;
    let query = `
      SELECT pcl.*,
             cust.name as custodian_name, cust_staff.staff_id as custodian_staff_id,
             approver.name as approved_by_name,
             creator.name as created_by_name,
             counter.name as counted_by_name,
             witness.name as witnessed_by_name
      FROM petty_cash_ledgers pcl
      LEFT JOIN staff cust_staff ON pcl.petty_cash_custodian_id = cust_staff.id
      LEFT JOIN users cust ON cust_staff.user_id = cust.id
      LEFT JOIN users approver ON pcl.approved_by_id = approver.id
      LEFT JOIN users creator ON pcl.created_by = creator.id
      LEFT JOIN staff counter_staff ON pcl.counted_by_id = counter_staff.id
      LEFT JOIN users counter ON counter_staff.user_id = counter.id
      LEFT JOIN staff witness_staff ON pcl.witnessed_by_id = witness_staff.id
      LEFT JOIN users witness ON witness_staff.user_id = witness.id
      WHERE 1=1
    `;
    const params = [];

    if (year) {
      query += ' AND pcl.year = ?';
      params.push(year);
    }
    if (month) {
      query += ' AND pcl.month = ?';
      params.push(month);
    }
    if (status) {
      query += ' AND pcl.approval_status = ?';
      params.push(status);
    }

    // Role-based access
    if (req.user.role === 'Staff' && !(await isFinanceStaff(req.user))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    query += ' ORDER BY pcl.year DESC, pcl.month DESC';

    const ledgers = await db.all(query, params);

    // Calculate totals for each ledger
    for (const ledger of ledgers) {
      const transactions = await db.all(
        'SELECT amount_deposited, amount_withdrawn FROM petty_cash_transactions WHERE ledger_id = ?',
        [ledger.id]
      );
      ledger.total_deposited = transactions.reduce((sum, t) => sum + (t.amount_deposited || 0), 0);
      ledger.total_withdrawn = transactions.reduce((sum, t) => sum + (t.amount_withdrawn || 0), 0);
      ledger.closing_balance = ledger.starting_balance + ledger.total_deposited - ledger.total_withdrawn;
    }

    res.json({ ledgers });
  } catch (error) {
    console.error('Get petty cash ledgers error:', error);
    res.status(500).json({ error: 'Failed to fetch petty cash ledgers: ' + error.message });
  }
});

// Get single petty cash ledger with transactions
router.get('/petty-cash/ledgers/:id', authenticateToken, async (req, res) => {
  try {
    const ledger = await db.get(
      `SELECT pcl.*,
              COALESCE(cust.name, cust_direct.name) as custodian_name, 
              cust_staff.staff_id as custodian_staff_id,
              approver.name as approved_by_name
       FROM petty_cash_ledgers pcl
       LEFT JOIN staff cust_staff ON pcl.petty_cash_custodian_id = cust_staff.id
       LEFT JOIN users cust ON cust_staff.user_id = cust.id
       LEFT JOIN users cust_direct ON pcl.petty_cash_custodian_id = cust_direct.id AND cust_staff.id IS NULL
       LEFT JOIN users approver ON pcl.approved_by_id = approver.id
       WHERE pcl.id = ?`,
      [req.params.id]
    );

    if (!ledger) {
      return res.status(404).json({ error: 'Ledger not found' });
    }

    const transactions = await db.all(
      `SELECT t.*,
              receiver.name as received_by_name,
              approver.name as approved_by_name
       FROM petty_cash_transactions t
       LEFT JOIN staff receiver_staff ON t.received_by_staff_id = receiver_staff.id
       LEFT JOIN users receiver ON receiver_staff.user_id = receiver.id
       LEFT JOIN users approver ON t.approved_by_id = approver.id
       WHERE t.ledger_id = ?
       ORDER BY t.transaction_date, t.id`,
      [req.params.id]
    );

    const totals = transactions.reduce((acc, t) => {
      acc.deposited += t.amount_deposited || 0;
      acc.withdrawn += t.amount_withdrawn || 0;
      return acc;
    }, { deposited: 0, withdrawn: 0 });

    ledger.transactions = transactions;
    ledger.total_deposited = totals.deposited;
    ledger.total_withdrawn = totals.withdrawn;
    ledger.closing_balance = ledger.starting_balance + totals.deposited - totals.withdrawn;

    res.json({ ledger });
  } catch (error) {
    console.error('Get petty cash ledger error:', error);
    res.status(500).json({ error: 'Failed to fetch petty cash ledger' });
  }
});

// Create petty cash ledger
router.post('/petty-cash/ledgers', authenticateToken, [
  body('month').isInt({ min: 1, max: 12 }).withMessage('Month must be 1-12'),
  body('year').isInt({ min: 2020, max: 2100 }).withMessage('Year must be valid'),
  body('starting_balance').isFloat({ min: 0 }).withMessage('Starting balance must be >= 0'),
  body('petty_cash_custodian_id').isInt().withMessage('Petty cash custodian is required'),
  body('date_from').optional().isISO8601().withMessage('Valid date_from is required'),
  body('date_to').optional().isISO8601().withMessage('Valid date_to is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!(await isFinanceStaff(req.user)) && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Only Finance staff can create ledgers' });
    }

    const { month, year, starting_balance, petty_cash_custodian_id, date_from, date_to } = req.body;

    // Validate custodian exists (can be staff, dept head, or admin user)
    // For backward compatibility, try staff first, then user
    let custodianExists = false;
    let custodianIsUser = false;
    
    // Check if it's a staff member
    const staff = await db.get('SELECT id, user_id FROM staff WHERE id = ?', [petty_cash_custodian_id]);
    if (staff) {
      custodianExists = true;
    } else {
      // Check if it's a user (dept head or admin without staff record)
      const user = await db.get('SELECT id FROM users WHERE id = ?', [petty_cash_custodian_id]);
      if (user) {
        custodianExists = true;
        custodianIsUser = true;
      }
    }
    
    if (!custodianExists) {
      return res.status(400).json({ error: 'Invalid petty cash custodian. Must be a valid staff member, department head, or admin user.' });
    }

    // Check if ledger already exists for this month/year
    const existing = await db.get(
      'SELECT id FROM petty_cash_ledgers WHERE year = ? AND month = ?',
      [year, month]
    );
    if (existing) {
      return res.status(400).json({ error: `Ledger already exists for ${month}/${year}` });
    }

    // Get previous month's closing balance if not provided
    let actualStartingBalance = starting_balance;
    if (!starting_balance || starting_balance === 0) {
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      const prevLedger = await db.get(
        'SELECT id FROM petty_cash_ledgers WHERE year = ? AND month = ?',
        [prevYear, prevMonth]
      );
      if (prevLedger) {
        const prevTransactions = await db.all(
          'SELECT amount_deposited, amount_withdrawn FROM petty_cash_transactions WHERE ledger_id = ?',
          [prevLedger.id]
        );
        const prevLedgerData = await db.get(
          'SELECT starting_balance FROM petty_cash_ledgers WHERE id = ?',
          [prevLedger.id]
        );
        const prevDeposited = prevTransactions.reduce((sum, t) => sum + (t.amount_deposited || 0), 0);
        const prevWithdrawn = prevTransactions.reduce((sum, t) => sum + (t.amount_withdrawn || 0), 0);
        actualStartingBalance = prevLedgerData.starting_balance + prevDeposited - prevWithdrawn;
      }
    }

    // Determine initial approval status based on user role
    // Assistant Finance Officer → Pending_DeptHead
    // Finance Department Head or Admin → can be Draft or directly Approved
    let initialStatus = 'Draft';
    let deptHeadStatus = null;
    
    if (await isAssistantFinanceOfficer(req.user)) {
      initialStatus = 'Pending_DeptHead';
      deptHeadStatus = 'Pending';
    }

    // Handle constraint violation for approval_status
    let result;
    try {
      // Build INSERT query dynamically to handle optional date_from and date_to
      const insertColumns = ['month', 'year', 'starting_balance', 'petty_cash_custodian_id', 'created_by', 'approval_status', 'dept_head_status'];
      const insertValues = [month, year, actualStartingBalance, petty_cash_custodian_id, req.user.id, initialStatus, deptHeadStatus];
      
      if (date_from) {
        insertColumns.push('date_from');
        insertValues.push(date_from);
      }
      if (date_to) {
        insertColumns.push('date_to');
        insertValues.push(date_to);
      }
      
      const placeholders = insertColumns.map(() => '?').join(', ');
      result = await db.run(
        `INSERT INTO petty_cash_ledgers 
         (${insertColumns.join(', ')})
         VALUES (${placeholders})`,
        insertValues
      );
    } catch (insertError) {
      // If constraint violation, try to fix the constraint and retry
      if (insertError.message && insertError.message.includes('check constraint') && insertError.message.includes('petty_cash_ledgers_approval_status_check')) {
        console.log('Constraint violation detected, attempting to update constraint...');
        const USE_POSTGRESQL = !!process.env.DATABASE_URL;
        
        if (USE_POSTGRESQL) {
          try {
            // Find and drop the existing constraint
            const constraint = await db.get(`
              SELECT constraint_name 
              FROM information_schema.table_constraints 
              WHERE table_name = 'petty_cash_ledgers' 
              AND constraint_type = 'CHECK'
              AND constraint_name LIKE '%approval_status%'
            `);
            
            if (constraint) {
              await db.run(`ALTER TABLE petty_cash_ledgers DROP CONSTRAINT ${constraint.constraint_name}`);
            } else {
              // Try common constraint names
              const constraintNames = ['petty_cash_ledgers_approval_status_check', 'petty_cash_ledgers_approval_status_chk', 'check_approval_status'];
              for (const constraintName of constraintNames) {
                try {
                  await db.run(`ALTER TABLE petty_cash_ledgers DROP CONSTRAINT IF EXISTS ${constraintName}`);
                } catch (e) {
                  // Ignore if doesn't exist
                }
              }
            }
            
            // Add new constraint with all status values including workflow statuses
            await db.run(`
              ALTER TABLE petty_cash_ledgers 
              ADD CONSTRAINT petty_cash_ledgers_approval_status_check 
              CHECK (approval_status IN ('Draft', 'Pending Review', 'Pending Approval', 'Approved', 'Locked', 'Pending_DeptHead', 'Pending_Admin', 'Rejected'))
            `);
            console.log('✓ Updated petty_cash_ledgers approval_status constraint to include workflow statuses');
            
            // Retry the insert with same dynamic columns
            const insertColumns2 = ['month', 'year', 'starting_balance', 'petty_cash_custodian_id', 'created_by', 'approval_status', 'dept_head_status'];
            const insertValues2 = [month, year, actualStartingBalance, petty_cash_custodian_id, req.user.id, initialStatus, deptHeadStatus];
            
            if (date_from) {
              insertColumns2.push('date_from');
              insertValues2.push(date_from);
            }
            if (date_to) {
              insertColumns2.push('date_to');
              insertValues2.push(date_to);
            }
            
            const placeholders2 = insertColumns2.map(() => '?').join(', ');
            result = await db.run(
              `INSERT INTO petty_cash_ledgers 
               (${insertColumns2.join(', ')})
               VALUES (${placeholders2})`,
              insertValues2
            );
          } catch (constraintError) {
            console.error('Error updating constraint:', constraintError);
            throw insertError; // Re-throw original error
          }
        } else {
          // SQLite doesn't support ALTER TABLE to modify CHECK constraints
          console.error('SQLite constraint violation - cannot modify CHECK constraint dynamically');
          throw insertError;
        }
      } else {
        throw insertError;
      }
    }

    await logAction(req.user.id, 'create_petty_cash_ledger', 'finance', result.lastID, { month, year }, req);

    // Send notification to Finance Department Head if submitted by Assistant Finance Officer
    if (initialStatus === 'Pending_DeptHead') {
      try {
        // Get Finance Department Head
        const financeDept = await db.get(
          'SELECT manager_id, head_email FROM departments WHERE LOWER(name) LIKE ?',
          ['%finance%']
        );
        if (financeDept && financeDept.manager_id) {
          await createNotification(
            financeDept.manager_id,
            'Petty Cash Ledger Pending Approval',
            `A new petty cash ledger for ${months[month - 1]} ${year} has been submitted and requires your approval.`,
            'warning',
            `/finance/petty-cash/ledgers/${result.lastID}`,
            req.user.id
          );
        }
      } catch (notifError) {
        console.error('Error sending notification:', notifError);
        // Don't fail the request if notification fails
      }
    }

    res.status(201).json({
      message: 'Petty cash ledger created successfully',
      ledger: { id: result.lastID, month, year, starting_balance: actualStartingBalance }
    });
  } catch (error) {
    console.error('Create petty cash ledger error:', error);
    res.status(500).json({ error: 'Failed to create petty cash ledger: ' + error.message });
  }
});

// Add transaction to petty cash ledger
router.post('/petty-cash/ledgers/:id/transactions', authenticateToken, upload.single('attachment'), [
  body('transaction_date').isISO8601().withMessage('Valid transaction date required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('charged_to').trim().notEmpty().withMessage('Expense category is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!(await isFinanceStaff(req.user)) && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const ledger = await db.get('SELECT * FROM petty_cash_ledgers WHERE id = ?', [req.params.id]);
    if (!ledger) {
      return res.status(404).json({ error: 'Ledger not found' });
    }
    if (ledger.locked) {
      return res.status(400).json({ error: 'Ledger is locked and cannot be modified' });
    }

    const {
      transaction_date, description, amount_deposited, amount_withdrawn,
      charged_to, received_by_type, received_by_staff_id, received_by_name
    } = req.body;

    const deposited = parseFloat(amount_deposited || 0);
    const withdrawn = parseFloat(amount_withdrawn || 0);

    if (deposited > 0 && withdrawn > 0) {
      return res.status(400).json({ error: 'Cannot have both deposit and withdrawal in same transaction' });
    }
    if (deposited === 0 && withdrawn === 0) {
      return res.status(400).json({ error: 'Either deposit or withdrawal amount is required' });
    }

    // Get last transaction balance
    const lastTransaction = await db.get(
      'SELECT balance FROM petty_cash_transactions WHERE ledger_id = ? ORDER BY id DESC LIMIT 1',
      [req.params.id]
    );
    const previousBalance = lastTransaction ? lastTransaction.balance : ledger.starting_balance;
    const newBalance = previousBalance + deposited - withdrawn;

    // Generate slip number
    const transactionCount = await db.get(
      'SELECT COUNT(*) as count FROM petty_cash_transactions WHERE ledger_id = ?',
      [req.params.id]
    );
    const slipNo = `PC-${ledger.year}-${String(ledger.month).padStart(2, '0')}-${String((transactionCount.count || 0) + 1).padStart(3, '0')}`;

    const attachmentPath = req.file ? `/uploads/finance/${req.file.filename}` : null;

    const result = await db.run(
      `INSERT INTO petty_cash_transactions 
       (ledger_id, transaction_date, petty_cash_slip_no, description, amount_deposited, 
        amount_withdrawn, balance, charged_to, received_by_type, received_by_staff_id, 
        received_by_name, approved_by_id, attachment_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.params.id, transaction_date, slipNo, description, deposited, withdrawn, newBalance,
       charged_to, received_by_type, received_by_staff_id || null, received_by_name || null,
       req.user.id, attachmentPath]
    );

    await logAction(req.user.id, 'add_petty_cash_transaction', 'finance', result.lastID, { ledger_id: req.params.id }, req);

    res.status(201).json({
      message: 'Transaction added successfully',
      transaction: { id: result.lastID, balance: newBalance, slip_no: slipNo }
    });
  } catch (error) {
    console.error('Add transaction error:', error);
    res.status(500).json({ error: 'Failed to add transaction: ' + error.message });
  }
});

// Approve petty cash ledger (two-stage: DeptHead → Admin)
router.put('/petty-cash/ledgers/:id/approve', authenticateToken, [
  body('approved').isBoolean().withMessage('Approval status required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const ledger = await db.get('SELECT * FROM petty_cash_ledgers WHERE id = ?', [req.params.id]);
    if (!ledger) {
      return res.status(404).json({ error: 'Ledger not found' });
    }

    const { approved } = req.body;
    const isDeptHead = await isFinanceDepartmentHead(req.user);
    const isAdmin = req.user.role === 'Admin';

    // Determine which stage of approval
    if (isDeptHead && ledger.approval_status === 'Pending_DeptHead') {
      // Department Head approving/rejecting
      if (approved) {
        await db.run(
          `UPDATE petty_cash_ledgers 
           SET approval_status = 'Pending_Admin',
               dept_head_status = 'Approved',
               dept_head_approved_by = ?,
               dept_head_approved_at = CURRENT_TIMESTAMP,
               admin_status = 'Pending'
           WHERE id = ?`,
          [req.user.id, req.params.id]
        );
        await logAction(req.user.id, 'approve_petty_cash_ledger_depthead', 'finance', req.params.id, { approved }, req);
        
        // Notify Admin
        try {
          await sendNotificationToRole(
            'Admin',
            'Petty Cash Ledger Pending Admin Approval',
            `Petty cash ledger for ${months[ledger.month - 1]} ${ledger.year} has been approved by Finance Department Head and requires your approval.`,
            'info',
            `/finance/petty-cash/ledgers/${req.params.id}`,
            req.user.id
          );
        } catch (notifError) {
          console.error('Error sending notification:', notifError);
        }
      } else {
        await db.run(
          `UPDATE petty_cash_ledgers 
           SET approval_status = 'Rejected',
               dept_head_status = 'Rejected',
               dept_head_approved_by = ?,
               dept_head_approved_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [req.user.id, req.params.id]
        );
        await logAction(req.user.id, 'reject_petty_cash_ledger_depthead', 'finance', req.params.id, { approved }, req);
        
        // Notify creator
        try {
          if (ledger.created_by) {
            await createNotification(
              ledger.created_by,
              'Petty Cash Ledger Rejected',
              `Your petty cash ledger for ${months[ledger.month - 1]} ${ledger.year} has been rejected by Finance Department Head.`,
              'error',
              `/finance/petty-cash/ledgers/${req.params.id}`,
              req.user.id
            );
          }
        } catch (notifError) {
          console.error('Error sending notification:', notifError);
        }
      }
    } else if (isAdmin && ledger.approval_status === 'Pending_Admin') {
      // Admin approving/rejecting
      if (approved) {
        await db.run(
          `UPDATE petty_cash_ledgers 
           SET approval_status = 'Approved',
               admin_status = 'Approved',
               admin_approved_by = ?,
               admin_approved_at = CURRENT_TIMESTAMP,
               locked = 1,
               date_signed = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [req.user.id, req.params.id]
        );
        await logAction(req.user.id, 'approve_petty_cash_ledger_admin', 'finance', req.params.id, { approved }, req);
        
        // Notify creator and dept head
        try {
          if (ledger.created_by) {
            await createNotification(
              ledger.created_by,
              'Petty Cash Ledger Approved',
              `Your petty cash ledger for ${months[ledger.month - 1]} ${ledger.year} has been fully approved.`,
              'success',
              `/finance/petty-cash/ledgers/${req.params.id}`,
              req.user.id
            );
          }
          if (ledger.dept_head_approved_by) {
            await createNotification(
              ledger.dept_head_approved_by,
              'Petty Cash Ledger Approved by Admin',
              `The petty cash ledger for ${months[ledger.month - 1]} ${ledger.year} that you approved has been approved by Admin.`,
              'success',
              `/finance/petty-cash/ledgers/${req.params.id}`,
              req.user.id
            );
          }
        } catch (notifError) {
          console.error('Error sending notification:', notifError);
        }
      } else {
        await db.run(
          `UPDATE petty_cash_ledgers 
           SET approval_status = 'Rejected',
               admin_status = 'Rejected',
               admin_approved_by = ?,
               admin_approved_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [req.user.id, req.params.id]
        );
        await logAction(req.user.id, 'reject_petty_cash_ledger_admin', 'finance', req.params.id, { approved }, req);
        
        // Notify creator and dept head
        try {
          if (ledger.created_by) {
            await createNotification(
              ledger.created_by,
              'Petty Cash Ledger Rejected',
              `Your petty cash ledger for ${months[ledger.month - 1]} ${ledger.year} has been rejected by Admin.`,
              'error',
              `/finance/petty-cash/ledgers/${req.params.id}`,
              req.user.id
            );
          }
          if (ledger.dept_head_approved_by) {
            await createNotification(
              ledger.dept_head_approved_by,
              'Petty Cash Ledger Rejected by Admin',
              `The petty cash ledger for ${months[ledger.month - 1]} ${ledger.year} that you approved has been rejected by Admin.`,
              'error',
              `/finance/petty-cash/ledgers/${req.params.id}`,
              req.user.id
            );
          }
        } catch (notifError) {
          console.error('Error sending notification:', notifError);
        }
      }
    } else {
      return res.status(403).json({ 
        error: 'You do not have permission to approve this ledger at this stage' 
      });
    }

    res.json({ message: `Ledger ${approved ? 'approved' : 'rejected'} successfully` });
  } catch (error) {
    console.error('Approve ledger error:', error);
    res.status(500).json({ error: 'Failed to approve ledger: ' + error.message });
  }
});

// ==========================================
// ASSET REGISTRY ROUTES
// ==========================================

// Get all assets
router.get('/assets', authenticateToken, async (req, res) => {
  try {
    const { category, department, location, search } = req.query;
    let query = `
      SELECT a.*,
             resp.name as responsible_person_name, resp_staff.staff_id as responsible_person_staff_id,
             creator.name as added_by_name,
             reviewer.name as reviewed_by_name,
             approver.name as approved_by_name
      FROM assets a
      LEFT JOIN staff resp_staff ON a.responsible_person_id = resp_staff.id
      LEFT JOIN users resp ON resp_staff.user_id = resp.id
      LEFT JOIN users creator ON a.added_by = creator.id
      LEFT JOIN users reviewer ON a.reviewed_by_id = reviewer.id
      LEFT JOIN users approver ON a.approved_by_id = approver.id
      WHERE 1=1
    `;
    const params = [];

    if (category) {
      query += ' AND a.asset_category = ?';
      params.push(category);
    }
    if (department) {
      query += ' AND a.department = ?';
      params.push(department);
    }
    if (location) {
      query += ' AND a.location = ?';
      params.push(location);
    }
    if (search) {
      query += ' AND (a.asset_description LIKE ? OR a.asset_id LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    query += ' ORDER BY a.date_acquired DESC, a.id DESC';

    const assets = await db.all(query, params);

    // Calculate current book value for each asset (as of today)
    const today = new Date();
    for (const asset of assets) {
      const acquiredDate = new Date(asset.date_acquired);
      const yearsSinceAcquired = (today - acquiredDate) / (1000 * 60 * 60 * 24 * 365);
      
      if (yearsSinceAcquired > 0 && asset.depreciation_expense_per_annum) {
        const accumulatedDep = Math.min(
          yearsSinceAcquired * asset.depreciation_expense_per_annum,
          asset.purchase_price_usd
        );
        asset.accumulated_depreciation = accumulatedDep;
        asset.current_book_value = asset.purchase_price_usd - accumulatedDep;
      } else {
        asset.accumulated_depreciation = 0;
        asset.current_book_value = asset.purchase_price_usd;
      }
    }

    res.json({ assets });
  } catch (error) {
    console.error('Get assets error:', error);
    res.status(500).json({ error: 'Failed to fetch assets: ' + error.message });
  }
});

// Get single asset
router.get('/assets/:id', authenticateToken, async (req, res) => {
  try {
    const asset = await db.get(
      `SELECT a.*,
              resp.name as responsible_person_name,
              creator.name as added_by_name
       FROM assets a
       LEFT JOIN staff resp_staff ON a.responsible_person_id = resp_staff.id
       LEFT JOIN users resp ON resp_staff.user_id = resp.id
       LEFT JOIN users creator ON a.added_by = creator.id
       WHERE a.id = ?`,
      [req.params.id]
    );

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    // Get depreciation history
    const depreciations = await db.all(
      'SELECT * FROM asset_depreciations WHERE asset_id = ? ORDER BY depreciation_year',
      [req.params.id]
    );

    asset.depreciations = depreciations;

    // Calculate current book value
    const today = new Date();
    const acquiredDate = new Date(asset.date_acquired);
    const yearsSinceAcquired = (today - acquiredDate) / (1000 * 60 * 60 * 24 * 365);
    if (yearsSinceAcquired > 0 && asset.depreciation_expense_per_annum) {
      const accumulatedDep = Math.min(
        yearsSinceAcquired * asset.depreciation_expense_per_annum,
        asset.purchase_price_usd
      );
      asset.accumulated_depreciation = accumulatedDep;
      asset.current_book_value = asset.purchase_price_usd - accumulatedDep;
    } else {
      asset.accumulated_depreciation = 0;
      asset.current_book_value = asset.purchase_price_usd;
    }

    res.json({ asset });
  } catch (error) {
    console.error('Get asset error:', error);
    res.status(500).json({ error: 'Failed to fetch asset' });
  }
});

// Create asset
router.post('/assets', authenticateToken, upload.single('attachment'), [
  body('asset_description').trim().notEmpty().withMessage('Asset description is required'),
  body('asset_category').trim().notEmpty().withMessage('Asset category is required'),
  body('department').trim().notEmpty().withMessage('Department is required'),
  body('location').trim().notEmpty().withMessage('Location is required'),
  body('date_acquired').isISO8601().withMessage('Valid date acquired required'),
  body('purchase_price_usd').isFloat({ min: 0 }).withMessage('Purchase price must be >= 0'),
  body('responsible_person_id').isInt().withMessage('Responsible person is required'),
  body('expected_useful_life_years').isInt({ min: 1, max: 100 }).withMessage('Useful life must be 1-100 years')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!(await isFinanceStaff(req.user)) && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Only Finance staff can create assets' });
    }

    const {
      asset_description, asset_category, department, location, date_acquired,
      supplier, purchase_price_usd, purchase_price_lrd, asset_condition,
      serial_number, warranty_expiry_date, expected_useful_life_years,
      responsible_person_id, remarks
    } = req.body;

    // Generate asset ID
    const assetId = generateAssetId(asset_category);

    // Check if asset ID already exists (very unlikely but check anyway)
    let finalAssetId = assetId;
    let counter = 1;
    while (await db.get('SELECT id FROM assets WHERE asset_id = ?', [finalAssetId])) {
      finalAssetId = `${assetId.slice(0, -2)}${String(counter).padStart(2, '0')}`;
      counter++;
    }

    // Calculate depreciation
    const depreciationRate = parseFloat(req.body.depreciation_rate_annual || 0.05); // Default 5%
    const depreciationExpensePerAnnum = parseFloat(purchase_price_usd) * depreciationRate;
    const depreciationPerMonth = depreciationExpensePerAnnum / 12;

    const attachmentPath = req.file ? `/uploads/finance/${req.file.filename}` : null;

    // Determine initial approval status based on user role
    // Assistant Finance Officer → Pending_DeptHead
    // Finance Department Head or Admin → can be Draft or directly Approved
    let initialStatus = 'Draft';
    let deptHeadStatus = null;
    
    if (await isAssistantFinanceOfficer(req.user)) {
      initialStatus = 'Pending_DeptHead';
      deptHeadStatus = 'Pending';
    }

    const result = await db.run(
      `INSERT INTO assets 
       (asset_id, asset_description, asset_category, department, location, date_acquired,
        supplier, purchase_price_usd, purchase_price_lrd, asset_condition, serial_number,
        warranty_expiry_date, expected_useful_life_years, depreciation_rate_annual,
        depreciation_expense_per_annum, depreciation_per_month, responsible_person_id,
        remarks, attachment_path, added_by, approval_status, dept_head_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [finalAssetId, asset_description, asset_category, department, location, date_acquired,
       supplier || null, parseFloat(purchase_price_usd), purchase_price_lrd ? parseFloat(purchase_price_lrd) : null,
       asset_condition || 'Good', serial_number || null, warranty_expiry_date || null,
       parseInt(expected_useful_life_years), depreciationRate, depreciationExpensePerAnnum,
       depreciationPerMonth, parseInt(responsible_person_id), remarks || null,
       attachmentPath, req.user.id, initialStatus, deptHeadStatus]
    );

    await logAction(req.user.id, 'create_asset', 'finance', result.lastID, { asset_id: finalAssetId }, req);

    // Send notification to Finance Department Head if submitted by Assistant Finance Officer
    if (initialStatus === 'Pending_DeptHead') {
      try {
        // Get Finance Department Head
        const financeDept = await db.get(
          'SELECT manager_id, head_email FROM departments WHERE LOWER(name) LIKE ?',
          ['%finance%']
        );
        if (financeDept && financeDept.manager_id) {
          await createNotification(
            financeDept.manager_id,
            'Asset Pending Approval',
            `A new asset "${asset_description}" (${finalAssetId}) has been submitted and requires your approval.`,
            'warning',
            `/finance/assets/${result.lastID}`,
            req.user.id
          );
        }
      } catch (notifError) {
        console.error('Error sending notification:', notifError);
        // Don't fail the request if notification fails
      }
    }

    res.status(201).json({
      message: 'Asset created successfully',
      asset: { id: result.lastID, asset_id: finalAssetId }
    });
  } catch (error) {
    console.error('Create asset error:', error);
    res.status(500).json({ error: 'Failed to create asset: ' + error.message });
  }
});

// Approve asset (two-stage: DeptHead → Admin)
router.put('/assets/:id/approve', authenticateToken, [
  body('approved').isBoolean().withMessage('Approval status required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const asset = await db.get('SELECT * FROM assets WHERE id = ?', [req.params.id]);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const { approved } = req.body;
    const isDeptHead = await isFinanceDepartmentHead(req.user);
    const isAdmin = req.user.role === 'Admin';

    // Determine which stage of approval
    if (isDeptHead && asset.approval_status === 'Pending_DeptHead') {
      // Department Head approving/rejecting
      if (approved) {
        await db.run(
          `UPDATE assets 
           SET approval_status = 'Pending_Admin',
               dept_head_status = 'Approved',
               dept_head_approved_by = ?,
               dept_head_approved_at = CURRENT_TIMESTAMP,
               admin_status = 'Pending'
           WHERE id = ?`,
          [req.user.id, req.params.id]
        );
        await logAction(req.user.id, 'approve_asset_depthead', 'finance', req.params.id, { approved }, req);
        
        // Notify Admin
        try {
          await sendNotificationToRole(
            'Admin',
            'Asset Pending Admin Approval',
            `Asset "${asset.asset_description}" (${asset.asset_id}) has been approved by Finance Department Head and requires your approval.`,
            'info',
            `/finance/assets/${req.params.id}`,
            req.user.id
          );
        } catch (notifError) {
          console.error('Error sending notification:', notifError);
        }
      } else {
        await db.run(
          `UPDATE assets 
           SET approval_status = 'Rejected',
               dept_head_status = 'Rejected',
               dept_head_approved_by = ?,
               dept_head_approved_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [req.user.id, req.params.id]
        );
        await logAction(req.user.id, 'reject_asset_depthead', 'finance', req.params.id, { approved }, req);
        
        // Notify creator
        try {
          if (asset.added_by) {
            await createNotification(
              asset.added_by,
              'Asset Rejected',
              `Your asset "${asset.asset_description}" (${asset.asset_id}) has been rejected by Finance Department Head.`,
              'error',
              `/finance/assets/${req.params.id}`,
              req.user.id
            );
          }
        } catch (notifError) {
          console.error('Error sending notification:', notifError);
        }
      }
    } else if (isAdmin && asset.approval_status === 'Pending_Admin') {
      // Admin approving/rejecting
      if (approved) {
        await db.run(
          `UPDATE assets 
           SET approval_status = 'Approved',
               admin_status = 'Approved',
               admin_approved_by = ?,
               admin_approved_at = CURRENT_TIMESTAMP,
               locked = 1
           WHERE id = ?`,
          [req.user.id, req.params.id]
        );
        await logAction(req.user.id, 'approve_asset_admin', 'finance', req.params.id, { approved }, req);
        
        // Notify creator and dept head
        try {
          if (asset.added_by) {
            await createNotification(
              asset.added_by,
              'Asset Approved',
              `Your asset "${asset.asset_description}" (${asset.asset_id}) has been fully approved.`,
              'success',
              `/finance/assets/${req.params.id}`,
              req.user.id
            );
          }
          if (asset.dept_head_approved_by) {
            await createNotification(
              asset.dept_head_approved_by,
              'Asset Approved by Admin',
              `The asset "${asset.asset_description}" (${asset.asset_id}) that you approved has been approved by Admin.`,
              'success',
              `/finance/assets/${req.params.id}`,
              req.user.id
            );
          }
        } catch (notifError) {
          console.error('Error sending notification:', notifError);
        }
      } else {
        await db.run(
          `UPDATE assets 
           SET approval_status = 'Rejected',
               admin_status = 'Rejected',
               admin_approved_by = ?,
               admin_approved_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [req.user.id, req.params.id]
        );
        await logAction(req.user.id, 'reject_asset_admin', 'finance', req.params.id, { approved }, req);
        
        // Notify creator and dept head
        try {
          if (asset.added_by) {
            await createNotification(
              asset.added_by,
              'Asset Rejected',
              `Your asset "${asset.asset_description}" (${asset.asset_id}) has been rejected by Admin.`,
              'error',
              `/finance/assets/${req.params.id}`,
              req.user.id
            );
          }
          if (asset.dept_head_approved_by) {
            await createNotification(
              asset.dept_head_approved_by,
              'Asset Rejected by Admin',
              `The asset "${asset.asset_description}" (${asset.asset_id}) that you approved has been rejected by Admin.`,
              'error',
              `/finance/assets/${req.params.id}`,
              req.user.id
            );
          }
        } catch (notifError) {
          console.error('Error sending notification:', notifError);
        }
      }
    } else {
      return res.status(403).json({ 
        error: 'You do not have permission to approve this asset at this stage' 
      });
    }

    res.json({ message: `Asset ${approved ? 'approved' : 'rejected'} successfully` });
  } catch (error) {
    console.error('Approve asset error:', error);
    res.status(500).json({ error: 'Failed to approve asset: ' + error.message });
  }
});

// Get monthly acquisition sheet
router.get('/assets/monthly/:year/:month', authenticateToken, async (req, res) => {
  try {
    const { year, month } = req.params;
    const assets = await db.all(
      `SELECT * FROM assets 
       WHERE strftime('%Y', date_acquired) = ? AND strftime('%m', date_acquired) = ?
       ORDER BY date_acquired, id`,
      [year, String(month).padStart(2, '0')]
    );

    const total = assets.reduce((sum, a) => sum + parseFloat(a.purchase_price_usd || 0), 0);

    res.json({
      year: parseInt(year),
      month: parseInt(month),
      assets,
      total_acquisition_amount: total
    });
  } catch (error) {
    console.error('Get monthly acquisitions error:', error);
    res.status(500).json({ error: 'Failed to fetch monthly acquisitions' });
  }
});

module.exports = router;


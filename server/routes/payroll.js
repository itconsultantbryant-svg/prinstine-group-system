const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, requireRole } = require('../utils/auth');
const { logAction } = require('../utils/audit');

// Get all payroll records
// Finance Head can see all, Admin can see all, Staff can see their own
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Check if payroll_records table exists
    const tableExists = await db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='payroll_records'"
    );
    
    if (!tableExists) {
      return res.json({ records: [] });
    }

    let query = `
      SELECT pr.*, 
             s.staff_id, s.position, s.department, s.employment_type,
             u.name as staff_name, u.email as staff_email,
             submitter.name as submitted_by_name,
             approver.name as approved_by_name
      FROM payroll_records pr
      JOIN staff s ON pr.staff_id = s.id
      JOIN users u ON pr.user_id = u.id
      LEFT JOIN users submitter ON pr.submitted_by = submitter.id
      LEFT JOIN users approver ON pr.approved_by = approver.id
      WHERE 1=1
    `;
    const params = [];

    // Role-based filtering
    if (req.user.role === 'Staff') {
      query += ' AND pr.user_id = ?';
      params.push(req.user.id);
    } else if (req.user.role === 'DepartmentHead') {
      // Finance Head can see all payroll records
      const dept = await db.get(
        'SELECT id, name FROM departments WHERE manager_id = ? OR LOWER(TRIM(head_email)) = ?',
        [req.user.id, req.user.email.toLowerCase().trim()]
      );
      if (dept && dept.name.toLowerCase().includes('finance')) {
        // Finance Head can see all
      } else {
        // Other department heads cannot access
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
    }
    // Admin can see all (no additional filter)

    query += ' ORDER BY pr.payroll_period_start DESC, COALESCE(pr.submitted_at, pr.created_at) DESC';

    const records = await db.all(query, params);
    res.json({ records: records || [] });
  } catch (error) {
    console.error('Get payroll records error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      errno: error.errno
    });
    res.status(500).json({ error: 'Failed to fetch payroll records: ' + error.message });
  }
});

// Get single payroll record
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const record = await db.get(
      `SELECT pr.*, 
              s.staff_id, s.position, s.department, s.employment_type, s.base_salary,
              u.name as staff_name, u.email as staff_email,
              submitter.name as submitted_by_name,
              approver.name as approved_by_name
       FROM payroll_records pr
       JOIN staff s ON pr.staff_id = s.id
       JOIN users u ON pr.user_id = u.id
       LEFT JOIN users submitter ON pr.submitted_by = submitter.id
       LEFT JOIN users approver ON pr.approved_by = approver.id
       WHERE pr.id = ?`,
      [req.params.id]
    );

    if (!record) {
      return res.status(404).json({ error: 'Payroll record not found' });
    }

    // Check permissions
    if (req.user.role === 'Staff' && record.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    res.json({ record });
  } catch (error) {
    console.error('Get payroll record error:', error);
    res.status(500).json({ error: 'Failed to fetch payroll record' });
  }
});

// Create payroll record (Finance Head only)
router.post('/', authenticateToken, requireRole('DepartmentHead', 'Admin'), [
  body('staff_id').isInt().withMessage('Staff ID is required'),
  body('payroll_period_start').isISO8601().withMessage('Valid start date is required'),
  body('payroll_period_end').isISO8601().withMessage('Valid end date is required'),
  body('gross_salary').isFloat({ min: 0 }).withMessage('Gross salary must be a positive number'),
  body('net_salary').isFloat({ min: 0 }).withMessage('Net salary must be a positive number')
], async (req, res) => {
  try {
    // Check if user is Finance Head
    if (req.user.role === 'DepartmentHead') {
      const dept = await db.get(
        'SELECT id, name FROM departments WHERE manager_id = ? OR LOWER(TRIM(head_email)) = ?',
        [req.user.id, req.user.email.toLowerCase().trim()]
      );
      if (!dept || !dept.name.toLowerCase().includes('finance')) {
        return res.status(403).json({ error: 'Only Finance Department Head can create payroll records' });
      }
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      staff_id,
      payroll_period_start,
      payroll_period_end,
      gross_salary,
      deductions = 0,
      net_salary,
      bonus = 0,
      allowances = 0,
      tax_deductions = 0,
      other_deductions = 0,
      notes
    } = req.body;

    // Get staff record
    const staff = await db.get('SELECT user_id FROM staff WHERE id = ?', [staff_id]);
    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    const result = await db.run(
      `INSERT INTO payroll_records 
       (staff_id, user_id, payroll_period_start, payroll_period_end, gross_salary, deductions, 
        net_salary, bonus, allowances, tax_deductions, other_deductions, notes, 
        status, submitted_by, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Submitted', ?, CURRENT_TIMESTAMP)`,
      [
        staff_id, staff.user_id, payroll_period_start, payroll_period_end,
        gross_salary, deductions, net_salary, bonus, allowances,
        tax_deductions, other_deductions, notes || null, req.user.id
      ]
    );

    await logAction(req.user.id, 'create_payroll', 'payroll_records', result.lastID, { staff_id }, req);

    res.status(201).json({
      message: 'Payroll record created successfully',
      record: { id: result.lastID }
    });
  } catch (error) {
    console.error('Create payroll record error:', error);
    res.status(500).json({ error: 'Failed to create payroll record' });
  }
});

// Update payroll record (Finance Head only, if status is Draft or Submitted)
router.put('/:id', authenticateToken, requireRole('DepartmentHead', 'Admin'), [
  body('gross_salary').optional().isFloat({ min: 0 }),
  body('net_salary').optional().isFloat({ min: 0 })
], async (req, res) => {
  try {
    // Check if user is Finance Head
    if (req.user.role === 'DepartmentHead') {
      const dept = await db.get(
        'SELECT id, name FROM departments WHERE manager_id = ? OR LOWER(TRIM(head_email)) = ?',
        [req.user.id, req.user.email.toLowerCase().trim()]
      );
      if (!dept || !dept.name.toLowerCase().includes('finance')) {
        return res.status(403).json({ error: 'Only Finance Department Head can update payroll records' });
      }
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Get existing record
    const existing = await db.get('SELECT status FROM payroll_records WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Payroll record not found' });
    }

    // Can only update if Draft or Submitted
    if (existing.status !== 'Draft' && existing.status !== 'Submitted') {
      return res.status(400).json({ error: 'Cannot update payroll record in current status' });
    }

    const {
      payroll_period_start,
      payroll_period_end,
      gross_salary,
      deductions,
      net_salary,
      bonus,
      allowances,
      tax_deductions,
      other_deductions,
      notes
    } = req.body;

    const updateFields = [];
    const params = [];

    if (payroll_period_start !== undefined) {
      updateFields.push('payroll_period_start = ?');
      params.push(payroll_period_start);
    }
    if (payroll_period_end !== undefined) {
      updateFields.push('payroll_period_end = ?');
      params.push(payroll_period_end);
    }
    if (gross_salary !== undefined) {
      updateFields.push('gross_salary = ?');
      params.push(gross_salary);
    }
    if (deductions !== undefined) {
      updateFields.push('deductions = ?');
      params.push(deductions);
    }
    if (net_salary !== undefined) {
      updateFields.push('net_salary = ?');
      params.push(net_salary);
    }
    if (bonus !== undefined) {
      updateFields.push('bonus = ?');
      params.push(bonus);
    }
    if (allowances !== undefined) {
      updateFields.push('allowances = ?');
      params.push(allowances);
    }
    if (tax_deductions !== undefined) {
      updateFields.push('tax_deductions = ?');
      params.push(tax_deductions);
    }
    if (other_deductions !== undefined) {
      updateFields.push('other_deductions = ?');
      params.push(other_deductions);
    }
    if (notes !== undefined) {
      updateFields.push('notes = ?');
      params.push(notes);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(req.params.id);

    await db.run(
      `UPDATE payroll_records SET ${updateFields.join(', ')} WHERE id = ?`,
      params
    );

    await logAction(req.user.id, 'update_payroll', 'payroll_records', req.params.id, {}, req);

    res.json({ message: 'Payroll record updated successfully' });
  } catch (error) {
    console.error('Update payroll record error:', error);
    res.status(500).json({ error: 'Failed to update payroll record' });
  }
});

// Admin approval/rejection
router.put('/:id/approve', authenticateToken, requireRole('Admin'), [
  body('approved').isBoolean().withMessage('Approved status is required'),
  body('admin_notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { approved, admin_notes } = req.body;

    const record = await db.get('SELECT status FROM payroll_records WHERE id = ?', [req.params.id]);
    if (!record) {
      return res.status(404).json({ error: 'Payroll record not found' });
    }

    if (record.status !== 'Submitted') {
      return res.status(400).json({ error: 'Can only approve/reject submitted payroll records' });
    }

    const newStatus = approved ? 'Admin_Approved' : 'Admin_Rejected';
    
    await db.run(
      `UPDATE payroll_records 
       SET status = ?, approved_by = ?, approved_at = CURRENT_TIMESTAMP, admin_notes = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [newStatus, req.user.id, admin_notes || null, req.params.id]
    );

    await logAction(req.user.id, approved ? 'approve_payroll' : 'reject_payroll', 'payroll_records', req.params.id, { approved }, req);

    res.json({ message: `Payroll record ${approved ? 'approved' : 'rejected'} successfully` });
  } catch (error) {
    console.error('Approve payroll error:', error);
    res.status(500).json({ error: 'Failed to process approval' });
  }
});

// Process payroll (Finance Head, after admin approval)
router.put('/:id/process', authenticateToken, requireRole('DepartmentHead', 'Admin'), async (req, res) => {
  try {
    // Check if user is Finance Head
    if (req.user.role === 'DepartmentHead') {
      const dept = await db.get(
        'SELECT id, name FROM departments WHERE manager_id = ? OR LOWER(TRIM(head_email)) = ?',
        [req.user.id, req.user.email.toLowerCase().trim()]
      );
      if (!dept || !dept.name.toLowerCase().includes('finance')) {
        return res.status(403).json({ error: 'Only Finance Department Head can process payroll' });
      }
    }

    const record = await db.get('SELECT status FROM payroll_records WHERE id = ?', [req.params.id]);
    if (!record) {
      return res.status(404).json({ error: 'Payroll record not found' });
    }

    if (record.status !== 'Admin_Approved') {
      return res.status(400).json({ error: 'Can only process approved payroll records' });
    }

    await db.run(
      `UPDATE payroll_records 
       SET status = 'Processed', processed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [req.params.id]
    );

    await logAction(req.user.id, 'process_payroll', 'payroll_records', req.params.id, {}, req);

    res.json({ message: 'Payroll processed successfully' });
  } catch (error) {
    console.error('Process payroll error:', error);
    res.status(500).json({ error: 'Failed to process payroll' });
  }
});

// Mark as paid (Finance Head or Admin)
router.put('/:id/mark-paid', authenticateToken, requireRole('DepartmentHead', 'Admin'), [
  body('payment_date').isISO8601().withMessage('Valid payment date is required')
], async (req, res) => {
  try {
    // Check if user is Finance Head
    if (req.user.role === 'DepartmentHead') {
      const dept = await db.get(
        'SELECT id, name FROM departments WHERE manager_id = ? OR LOWER(TRIM(head_email)) = ?',
        [req.user.id, req.user.email.toLowerCase().trim()]
      );
      if (!dept || !dept.name.toLowerCase().includes('finance')) {
        return res.status(403).json({ error: 'Only Finance Department Head can mark payroll as paid' });
      }
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { payment_date } = req.body;

    const record = await db.get('SELECT status FROM payroll_records WHERE id = ?', [req.params.id]);
    if (!record) {
      return res.status(404).json({ error: 'Payroll record not found' });
    }

    if (record.status !== 'Processed') {
      return res.status(400).json({ error: 'Can only mark processed payroll records as paid' });
    }

    await db.run(
      `UPDATE payroll_records 
       SET status = 'Paid', payment_date = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [payment_date, req.params.id]
    );

    await logAction(req.user.id, 'mark_payroll_paid', 'payroll_records', req.params.id, { payment_date }, req);

    res.json({ message: 'Payroll marked as paid successfully' });
  } catch (error) {
    console.error('Mark payroll paid error:', error);
    res.status(500).json({ error: 'Failed to mark payroll as paid' });
  }
});

// Delete payroll record (Finance Head or Admin, only if Draft)
router.delete('/:id', authenticateToken, requireRole('DepartmentHead', 'Admin'), async (req, res) => {
  try {
    // Check if user is Finance Head
    if (req.user.role === 'DepartmentHead') {
      const dept = await db.get(
        'SELECT id, name FROM departments WHERE manager_id = ? OR LOWER(TRIM(head_email)) = ?',
        [req.user.id, req.user.email.toLowerCase().trim()]
      );
      if (!dept || !dept.name.toLowerCase().includes('finance')) {
        return res.status(403).json({ error: 'Only Finance Department Head can delete payroll records' });
      }
    }

    const record = await db.get('SELECT status FROM payroll_records WHERE id = ?', [req.params.id]);
    if (!record) {
      return res.status(404).json({ error: 'Payroll record not found' });
    }

    if (record.status !== 'Draft') {
      return res.status(400).json({ error: 'Can only delete draft payroll records' });
    }

    await db.run('DELETE FROM payroll_records WHERE id = ?', [req.params.id]);

    await logAction(req.user.id, 'delete_payroll', 'payroll_records', req.params.id, {}, req);

    res.json({ message: 'Payroll record deleted successfully' });
  } catch (error) {
    console.error('Delete payroll record error:', error);
    res.status(500).json({ error: 'Failed to delete payroll record' });
  }
});

module.exports = router;


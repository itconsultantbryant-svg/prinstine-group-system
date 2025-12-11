const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, requireRole } = require('../utils/auth');
const { logAction } = require('../utils/audit');

// Get all student payments (Finance Head, Academy Head, Admin)
router.get('/', authenticateToken, requireRole('Admin', 'DepartmentHead'), async (req, res) => {
  try {
    let query = `
      SELECT sp.*,
             s.student_id,
             u.name as student_name, u.email as student_email, u.phone as student_phone,
             c.course_code, c.title as course_title, c.course_fee,
             creator.name as created_by_name
      FROM student_payments sp
      JOIN students s ON sp.student_id = s.id
      JOIN users u ON sp.user_id = u.id
      JOIN courses c ON sp.course_id = c.id
      LEFT JOIN users creator ON sp.created_at = sp.created_at
      WHERE 1=1
    `;
    const params = [];

    // Finance or Academy Department Head can see all student payments
    if (req.user.role === 'DepartmentHead') {
      const dept = await db.get(
        'SELECT id, name FROM departments WHERE manager_id = ? OR LOWER(TRIM(head_email)) = ?',
        [req.user.id, req.user.email.toLowerCase().trim()]
      );
      const isFinanceHead = dept && dept.name.toLowerCase().includes('finance');
      const isAcademyHead = dept && (dept.name.toLowerCase().includes('academy') || dept.name.toLowerCase().includes('elearning'));
      const isExplicitAcademyHead = req.user.email.toLowerCase() === 'fwallace@prinstinegroup.org';
      
      if (!isFinanceHead && !isAcademyHead && !isExplicitAcademyHead) {
        return res.status(403).json({ error: 'Only Finance or Academy Department Heads can view student payments' });
      }
    }

    query += ' ORDER BY sp.created_at DESC';

    const payments = await db.all(query, params);
    res.json({ payments });
  } catch (error) {
    console.error('Get student payments error:', error);
    res.status(500).json({ error: 'Failed to fetch student payments' });
  }
});

// Get enrolled courses for a student (for payment form) - MUST be before /student/:studentId
router.get('/student/:studentId/enrolled-courses', authenticateToken, requireRole('Admin', 'DepartmentHead'), async (req, res) => {
  try {
    const { studentId } = req.params;

    // Finance or Academy Department Head check
    if (req.user.role === 'DepartmentHead') {
      const dept = await db.get(
        'SELECT id, name FROM departments WHERE manager_id = ? OR LOWER(TRIM(head_email)) = ?',
        [req.user.id, req.user.email.toLowerCase().trim()]
      );
      const isFinanceHead = dept && dept.name.toLowerCase().includes('finance');
      const isAcademyHead = dept && (dept.name.toLowerCase().includes('academy') || dept.name.toLowerCase().includes('elearning'));
      const isExplicitAcademyHead = req.user.email.toLowerCase() === 'fwallace@prinstinegroup.org';
      
      if (!isFinanceHead && !isAcademyHead && !isExplicitAcademyHead) {
        return res.status(403).json({ error: 'Only Finance or Academy Department Heads can view student courses' });
      }
    }

    // Get enrolled courses from student_course_enrollments
    let enrolledCourses = await db.all(
      `SELECT 
        e.course_id,
        e.status as enrollment_status,
        c.course_code,
        c.title,
        c.course_fee,
        sp.id as payment_id,
        sp.amount_paid,
        sp.balance
       FROM student_course_enrollments e
       JOIN courses c ON e.course_id = c.id
       LEFT JOIN student_payments sp ON e.student_id = sp.student_id AND e.course_id = sp.course_id
       WHERE e.student_id = ? AND e.status != 'Dropped'
       ORDER BY c.course_code`,
      [studentId]
    );

    // If no enrollments in student_course_enrollments, check courses_enrolled JSON field in students table
    if (enrolledCourses.length === 0) {
      const student = await db.get('SELECT courses_enrolled FROM students WHERE id = ?', [studentId]);
      if (student && student.courses_enrolled) {
        let courseIds = [];
        try {
          courseIds = JSON.parse(student.courses_enrolled);
        } catch (e) {
          // If parsing fails, try to extract IDs from string
          courseIds = student.courses_enrolled.replace(/[\[\]]/g, '').split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        }
        
        if (courseIds && courseIds.length > 0) {
          const placeholders = courseIds.map(() => '?').join(',');
          enrolledCourses = await db.all(
            `SELECT 
              c.id as course_id,
              'Enrolled' as enrollment_status,
              c.course_code,
              c.title,
              c.course_fee,
              sp.id as payment_id,
              sp.amount_paid,
              sp.balance
             FROM courses c
             LEFT JOIN student_payments sp ON sp.student_id = ? AND sp.course_id = c.id
             WHERE c.id IN (${placeholders})
             ORDER BY c.course_code`,
            [studentId, ...courseIds]
          );
        }
      }
    }

    res.json({ courses: enrolledCourses });
  } catch (error) {
    console.error('Get enrolled courses error:', error);
    res.status(500).json({ error: 'Failed to fetch enrolled courses' });
  }
});

// Get student payment summary (all payments for a student)
router.get('/student/:studentId', authenticateToken, requireRole('Admin', 'DepartmentHead'), async (req, res) => {
  try {
    const { studentId } = req.params;

    // Finance or Academy Department Head check
    if (req.user.role === 'DepartmentHead') {
      const dept = await db.get(
        'SELECT id, name FROM departments WHERE manager_id = ? OR LOWER(TRIM(head_email)) = ?',
        [req.user.id, req.user.email.toLowerCase().trim()]
      );
      const isFinanceHead = dept && dept.name.toLowerCase().includes('finance');
      const isAcademyHead = dept && (dept.name.toLowerCase().includes('academy') || dept.name.toLowerCase().includes('elearning'));
      const isExplicitAcademyHead = req.user.email.toLowerCase() === 'fwallace@prinstinegroup.org';
      
      if (!isFinanceHead && !isAcademyHead && !isExplicitAcademyHead) {
        return res.status(403).json({ error: 'Only Finance or Academy Department Heads can view student payments' });
      }
    }

    const payments = await db.all(
      `SELECT sp.*,
              s.student_id,
              u.name as student_name, u.email as student_email, u.phone as student_phone,
              c.course_code, c.title as course_title, c.course_fee
       FROM student_payments sp
       JOIN students s ON sp.student_id = s.id
       JOIN users u ON sp.user_id = u.id
       JOIN courses c ON sp.course_id = c.id
       WHERE sp.student_id = ? OR s.student_id = ?
       ORDER BY sp.created_at DESC`,
      [studentId, studentId]
    );

    // Get student details
    const student = await db.get(
      `SELECT s.*, u.name, u.email, u.phone, u.profile_image
       FROM students s
       JOIN users u ON s.user_id = u.id
       WHERE s.id = ? OR s.student_id = ?`,
      [studentId, studentId]
    );

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Calculate totals
    const totalFees = payments.reduce((sum, p) => sum + (parseFloat(p.course_fee) || 0), 0);
    const totalPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amount_paid) || 0), 0);
    const totalBalance = payments.reduce((sum, p) => sum + (parseFloat(p.balance) || 0), 0);

    res.json({
      student,
      payments,
      summary: {
        totalFees,
        totalPaid,
        totalBalance
      }
    });
  } catch (error) {
    console.error('Get student payment summary error:', error);
    res.status(500).json({ error: 'Failed to fetch student payment summary' });
  }
});

// Get all students with payment summary (Finance Head, Academy Head, Admin)
router.get('/students', authenticateToken, requireRole('Admin', 'DepartmentHead'), async (req, res) => {
  try {
    // Check if user is Finance or Academy Department Head
    if (req.user.role === 'DepartmentHead') {
      const dept = await db.get(
        'SELECT id, name FROM departments WHERE manager_id = ? OR LOWER(TRIM(head_email)) = ?',
        [req.user.id, req.user.email.toLowerCase().trim()]
      );
      const isFinanceHead = dept && dept.name.toLowerCase().includes('finance');
      const isAcademyHead = dept && (dept.name.toLowerCase().includes('academy') || dept.name.toLowerCase().includes('elearning'));
      const isExplicitAcademyHead = req.user.email.toLowerCase() === 'fwallace@prinstinegroup.org';
      
      if (!isFinanceHead && !isAcademyHead && !isExplicitAcademyHead) {
        return res.status(403).json({ error: 'Only Finance or Academy Department Heads can view student payments' });
      }
    }

    const students = await db.all(
      `SELECT s.*, u.name, u.email, u.phone, u.profile_image
       FROM students s
       JOIN users u ON s.user_id = u.id
       ORDER BY s.created_at DESC`
    );

    // Get payment summary for each student
    const studentsWithPayments = await Promise.all(
      students.map(async (student) => {
        const payments = await db.all(
          `SELECT course_fee, amount_paid, balance
           FROM student_payments
           WHERE student_id = ?`,
          [student.id]
        );

        const totalFees = payments.reduce((sum, p) => sum + (parseFloat(p.course_fee) || 0), 0);
        const totalPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amount_paid) || 0), 0);
        const totalBalance = payments.reduce((sum, p) => sum + (parseFloat(p.balance) || 0), 0);

        return {
          ...student,
          paymentSummary: {
            totalFees,
            totalPaid,
            totalBalance,
            paymentCount: payments.length
          }
        };
      })
    );

    res.json({ students: studentsWithPayments });
  } catch (error) {
    console.error('Get students with payments error:', error);
    res.status(500).json({ error: 'Failed to fetch students with payments' });
  }
});

// Add payment to student (Finance Head, Admin)
router.post('/add-payment', authenticateToken, requireRole('Admin', 'DepartmentHead'), [
  body('student_id').isInt().withMessage('Student ID is required'),
  body('course_id').isInt().withMessage('Course ID is required'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Payment amount must be greater than 0'),
  body('payment_date').optional().isISO8601().withMessage('Payment date must be a valid date'),
  body('payment_method').optional().trim(),
  body('payment_reference').optional().trim(),
  body('notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Finance or Academy Department Head check
    if (req.user.role === 'DepartmentHead') {
      const dept = await db.get(
        'SELECT id, name FROM departments WHERE manager_id = ? OR LOWER(TRIM(head_email)) = ?',
        [req.user.id, req.user.email.toLowerCase().trim()]
      );
      const isFinanceHead = dept && dept.name.toLowerCase().includes('finance');
      const isAcademyHead = dept && (dept.name.toLowerCase().includes('academy') || dept.name.toLowerCase().includes('elearning'));
      const isExplicitAcademyHead = req.user.email.toLowerCase() === 'fwallace@prinstinegroup.org';
      
      if (!isFinanceHead && !isAcademyHead && !isExplicitAcademyHead) {
        return res.status(403).json({ error: 'Only Finance or Academy Department Heads can add payments' });
      }
    }

    const { student_id, course_id, amount, payment_date, payment_method, payment_reference, notes } = req.body;

    // Verify student is enrolled in this course
    const enrollment = await db.get(
      `SELECT e.*, c.course_fee
       FROM student_course_enrollments e
       JOIN courses c ON e.course_id = c.id
       WHERE e.student_id = ? AND e.course_id = ? AND e.status != 'Dropped'`,
      [student_id, course_id]
    );

    if (!enrollment) {
      return res.status(404).json({ error: 'Student is not enrolled in this course' });
    }

    // Get or create the payment record
    let paymentRecord = await db.get(
      `SELECT sp.*, c.course_fee
       FROM student_payments sp
       JOIN courses c ON sp.course_id = c.id
       WHERE sp.student_id = ? AND sp.course_id = ?`,
      [student_id, course_id]
    );

    // If payment record doesn't exist, create it
    if (!paymentRecord) {
      const courseFee = parseFloat(enrollment.course_fee) || 0;
      const student = await db.get('SELECT user_id FROM students WHERE id = ?', [student_id]);
      
      if (!student) {
        return res.status(404).json({ error: 'Student not found' });
      }

      const result = await db.run(
        `INSERT INTO student_payments (student_id, user_id, course_id, course_fee, amount_paid, balance)
         VALUES (?, ?, ?, ?, 0, ?)`,
        [student_id, student.user_id, course_id, courseFee, courseFee]
      );

      paymentRecord = await db.get(
        `SELECT sp.*, c.course_fee
         FROM student_payments sp
         JOIN courses c ON sp.course_id = c.id
         WHERE sp.id = ?`,
        [result.lastID]
      );
    }

    const currentAmountPaid = parseFloat(paymentRecord.amount_paid) || 0;
    const paymentAmount = parseFloat(amount);
    const newAmountPaid = currentAmountPaid + paymentAmount;
    const courseFee = parseFloat(paymentRecord.course_fee) || 0;
    const newBalance = Math.max(0, courseFee - newAmountPaid);

    // Update payment record
    await db.run(
      `UPDATE student_payments
       SET amount_paid = ?,
           balance = ?,
           payment_date = COALESCE(?, payment_date, CURRENT_DATE),
           payment_method = COALESCE(?, payment_method),
           payment_reference = COALESCE(?, payment_reference),
           notes = COALESCE(?, notes),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [newAmountPaid, newBalance, payment_date || null, payment_method || null, payment_reference || null, notes || null, paymentRecord.id]
    );

    await logAction(req.user.id, 'add_student_payment', 'student_payments', paymentRecord.id, {
      student_id,
      course_id,
      amount: paymentAmount,
      new_balance: newBalance
    }, req);

    res.json({
      message: 'Payment added successfully',
      payment: {
        id: paymentRecord.id,
        amount_paid: newAmountPaid,
        balance: newBalance
      }
    });
  } catch (error) {
    console.error('Add student payment error:', error);
    res.status(500).json({ error: 'Failed to add payment: ' + error.message });
  }
});

// Get single payment record
router.get('/:id', authenticateToken, requireRole('Admin', 'DepartmentHead'), async (req, res) => {
  try {
    const { id } = req.params;

    // Finance Department Head check
    if (req.user.role === 'DepartmentHead') {
      const dept = await db.get(
        'SELECT id, name FROM departments WHERE manager_id = ? OR LOWER(TRIM(head_email)) = ?',
        [req.user.id, req.user.email.toLowerCase().trim()]
      );
      if (!(dept && dept.name.toLowerCase().includes('finance'))) {
        return res.status(403).json({ error: 'Only Finance Department Heads can view student payments' });
      }
    }

    const payment = await db.get(
      `SELECT sp.*,
              s.student_id,
              u.name as student_name, u.email as student_email, u.phone as student_phone,
              c.course_code, c.title as course_title, c.course_fee
       FROM student_payments sp
       JOIN students s ON sp.student_id = s.id
       JOIN users u ON sp.user_id = u.id
       JOIN courses c ON sp.course_id = c.id
       WHERE sp.id = ?`,
      [id]
    );

    if (!payment) {
      return res.status(404).json({ error: 'Payment record not found' });
    }

    res.json({ payment });
  } catch (error) {
    console.error('Get student payment error:', error);
    res.status(500).json({ error: 'Failed to fetch payment record' });
  }
});

module.exports = router;


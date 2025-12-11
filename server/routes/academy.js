const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, requireRole } = require('../utils/auth');
const { logAction } = require('../utils/audit');
const crypto = require('crypto');

// Generate unique student ID
function generateStudentId() {
  return 'STU-' + Date.now().toString().slice(-8) + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();
}

// Generate unique instructor ID
function generateInstructorId() {
  return 'INS-' + Date.now().toString().slice(-8) + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();
}

// Generate unique certificate ID
function generateCertificateId() {
  return 'CERT-' + Date.now().toString().slice(-8) + '-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

// ========== STUDENTS ==========

// Get all students
router.get('/students', authenticateToken, async (req, res) => {
  try {
    const { status, search, pending_approval } = req.query;
    let query = `
      SELECT s.*, u.name, u.email, u.phone, u.profile_image
      FROM students s
      JOIN users u ON s.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (req.user.role === 'Student') {
      query += ' AND s.user_id = ? AND s.approved = 1';
      params.push(req.user.id);
    } else if (req.user.role !== 'Admin') {
      // Non-admin users only see approved students
      query += ' AND s.approved = 1';
    } else if (pending_approval === 'true') {
      // Admin can filter for pending approvals
      query += ' AND s.approved = 0';
    }

    if (status) {
      query += ' AND s.status = ?';
      params.push(status);
    }
    if (search) {
      query += ' AND (u.name LIKE ? OR u.email LIKE ? OR s.student_id LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ' ORDER BY s.created_at DESC';

    const students = await db.all(query, params);
    res.json({ students });
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// Get single student
router.get('/students/:id', authenticateToken, async (req, res) => {
  try {
    const studentId = req.params.id;

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

    if (req.user.role === 'Student' && student.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    res.json({ student });
  } catch (error) {
    console.error('Get student error:', error);
    res.status(500).json({ error: 'Failed to fetch student' });
  }
});

// Create student
router.post('/students', authenticateToken, requireRole('Admin', 'Instructor', 'DepartmentHead', 'Staff'), [
  body('email').isEmail().normalizeEmail(),
  body('name').trim().notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, name, username, phone, enrollment_date, courses_enrolled, password, status, profile_image } = req.body;

    // Check if user exists
    const existingUser = await db.get('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Check if user is Academy staff (Academy Head or authorized staff)
    let isAcademyStaff = false;
    if (req.user.role === 'Admin') {
      isAcademyStaff = true;
    } else if (req.user.role === 'DepartmentHead') {
      const dept = await db.get(
        'SELECT name FROM departments WHERE manager_id = ? OR LOWER(TRIM(head_email)) = ?',
        [req.user.id, req.user.email.toLowerCase().trim()]
      );
      if (dept && dept.name.toLowerCase().includes('academy')) {
        isAcademyStaff = true;
      } else if (req.user.email.toLowerCase() === 'fwallace@prinstinegroup.org') {
        isAcademyStaff = true;
      }
    } else if (req.user.email.toLowerCase() === 'jsieh@prinstinegroup.org' || req.user.email.toLowerCase() === 'cvulue@prinstinegroup.org') {
      isAcademyStaff = true;
    }

    // If created by Academy staff (not admin), require admin approval
    // 0 = Pending, 1 = Approved, 2 = Rejected
    const approved = req.user.role === 'Admin' ? 1 : 0;

    const { hashPassword } = require('../utils/auth');
    const passwordHash = await hashPassword(password || 'Student@123');

    // Create user - if pending approval, set is_active to 0
    const userResult = await db.run(
      `INSERT INTO users (email, username, password_hash, role, name, phone, profile_image, is_active, email_verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [email, username || email.split('@')[0], passwordHash, 'Student', name, phone || null, profile_image || null, approved]
    );

    const studentId = generateStudentId();

    const result = await db.run(
      `INSERT INTO students (user_id, student_id, enrollment_date, courses_enrolled, status, approved, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        userResult.lastID, studentId,
        enrollment_date || new Date().toISOString().split('T')[0],
        courses_enrolled ? JSON.stringify(courses_enrolled) : null,
        status || 'Active',
        approved,
        req.user.id
      ]
    );

    // Only create course enrollments and payment records if approved (Admin created)
    // If pending approval, these will be created when approved
    if (approved === 1 && courses_enrolled && Array.isArray(courses_enrolled) && courses_enrolled.length > 0) {
      for (const courseId of courses_enrolled) {
        // Get course fee
        const course = await db.get('SELECT id, course_fee FROM courses WHERE id = ?', [courseId]);
        if (course) {
          // Create enrollment record
          try {
            await db.run(
              `INSERT INTO student_course_enrollments (student_id, user_id, course_id, enrollment_date, status)
               VALUES (?, ?, ?, ?, 'Enrolled')`,
              [result.lastID, userResult.lastID, courseId, enrollment_date || new Date().toISOString().split('T')[0]]
            );
          } catch (enrollError) {
            // Ignore duplicate enrollment errors
            if (!enrollError.message.includes('UNIQUE constraint')) {
              console.error('Error creating enrollment:', enrollError);
            }
          }

          // Create payment record
          const courseFee = course.course_fee || 0;
          await db.run(
            `INSERT INTO student_payments (student_id, user_id, course_id, course_fee, amount_paid, balance)
             VALUES (?, ?, ?, ?, 0, ?)`,
            [result.lastID, userResult.lastID, courseId, courseFee, courseFee]
          );
        }
      }
    }

    await logAction(req.user.id, 'create_student', 'academy', result.lastID, { studentId, approved }, req);

    res.status(201).json({
      message: req.user.role === 'Admin' 
        ? 'Student created successfully' 
        : 'Student created successfully and is pending admin approval',
      student: { id: result.lastID, student_id: studentId, approved }
    });
  } catch (error) {
    console.error('Create student error:', error);
    res.status(500).json({ error: 'Failed to create student: ' + error.message });
  }
});

// Approve/reject student (Admin only) - MUST be before /students/:id
router.put('/students/:id/approve', authenticateToken, requireRole('Admin'), [
  body('approved').isBoolean().withMessage('Approved status is required'),
  body('admin_notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { approved, admin_notes } = req.body;

    const student = await db.get(
      `SELECT s.id, s.user_id, s.approved, s.courses_enrolled 
       FROM students s 
       WHERE s.id = ?`,
      [req.params.id]
    );
    
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const approvedStatus = approved ? 1 : 2; // 1 = Approved, 2 = Rejected
    
    await db.run(
      `UPDATE students 
       SET approved = ?, approved_by = ?, approved_at = CURRENT_TIMESTAMP, admin_notes = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [approvedStatus, req.user.id, admin_notes || null, req.params.id]
    );

    // Update user account to active if approved, inactive if rejected
    await db.run(
      `UPDATE users SET is_active = ? WHERE id = ?`,
      [approved ? 1 : 0, student.user_id]
    );

    // If approved and has courses_enrolled, create enrollments and payment records
    if (approved && student.courses_enrolled) {
      try {
        let courseIds = [];
        try {
          courseIds = JSON.parse(student.courses_enrolled);
        } catch (e) {
          courseIds = student.courses_enrolled.replace(/[\[\]]/g, '').split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        }

        const enrollmentDate = new Date().toISOString().split('T')[0];
        
        for (const courseId of courseIds) {
          const course = await db.get('SELECT id, course_fee FROM courses WHERE id = ?', [courseId]);
          if (course) {
            // Create enrollment record
            try {
              await db.run(
                `INSERT INTO student_course_enrollments (student_id, user_id, course_id, enrollment_date, status)
                 VALUES (?, ?, ?, ?, 'Enrolled')`,
                [student.id, student.user_id, courseId, enrollmentDate]
              );
            } catch (enrollError) {
              if (!enrollError.message.includes('UNIQUE constraint')) {
                console.error('Error creating enrollment:', enrollError);
              }
            }

            // Create payment record
            const courseFee = course.course_fee || 0;
            try {
              await db.run(
                `INSERT INTO student_payments (student_id, user_id, course_id, course_fee, amount_paid, balance)
                 VALUES (?, ?, ?, ?, 0, ?)`,
                [student.id, student.user_id, courseId, courseFee, courseFee]
              );
            } catch (paymentError) {
              if (!paymentError.message.includes('UNIQUE constraint')) {
                console.error('Error creating payment record:', paymentError);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error processing course enrollments on approval:', error);
        // Don't fail the approval if enrollment creation fails
      }
    }

    await logAction(req.user.id, approved ? 'approve_student' : 'reject_student', 'academy', req.params.id, { approved }, req);

    res.json({ message: `Student ${approved ? 'approved' : 'rejected'} successfully` });
  } catch (error) {
    console.error('Approve student error:', error);
    res.status(500).json({ error: 'Failed to process approval' });
  }
});

// Update student
router.put('/students/:id', authenticateToken, requireRole('Admin', 'Instructor', 'DepartmentHead', 'Staff'), async (req, res) => {
  try {
    const studentId = req.params.id;
    const updates = req.body;

    const student = await db.get('SELECT user_id FROM students WHERE id = ?', [studentId]);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
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
        userParams.push(student.user_id);
        await db.run(`UPDATE users SET ${userUpdates.join(', ')} WHERE id = ?`, userParams);
      }
    }

    // Update student info
    const studentUpdates = [];
    const studentParams = [];
    if (updates.enrollment_date !== undefined) {
      studentUpdates.push('enrollment_date = ?');
      studentParams.push(updates.enrollment_date);
    }
    if (updates.status !== undefined) {
      studentUpdates.push('status = ?');
      studentParams.push(updates.status);
    }
    if (updates.courses_enrolled !== undefined) {
      studentUpdates.push('courses_enrolled = ?');
      studentParams.push(JSON.stringify(updates.courses_enrolled));
    }

    if (studentUpdates.length > 0) {
      studentParams.push(studentId);
      await db.run(`UPDATE students SET ${studentUpdates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, studentParams);
    }

    await logAction(req.user.id, 'update_student', 'academy', studentId, updates, req);

    res.json({ message: 'Student updated successfully' });
  } catch (error) {
    console.error('Update student error:', error);
    res.status(500).json({ error: 'Failed to update student' });
  }
});

// Delete student
router.delete('/students/:id', authenticateToken, requireRole('Admin'), async (req, res) => {
  try {
    const studentId = req.params.id;

    const student = await db.get('SELECT user_id FROM students WHERE id = ?', [studentId]);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Delete student (cascade will delete user)
    await db.run('DELETE FROM students WHERE id = ?', [studentId]);

    await logAction(req.user.id, 'delete_student', 'academy', studentId, {}, req);

    res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({ error: 'Failed to delete student' });
  }
});

// ========== INSTRUCTORS ==========

// Get all instructors
router.get('/instructors', authenticateToken, async (req, res) => {
  try {
    const { search, pending_approval } = req.query;
    let query = `
      SELECT i.*, u.name, u.email, u.phone, u.profile_image
      FROM instructors i
      JOIN users u ON i.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (req.user.role !== 'Admin') {
      // Non-admin users only see approved instructors
      query += ' AND i.approved = 1';
    } else if (pending_approval === 'true') {
      // Admin can filter for pending approvals
      query += ' AND i.approved = 0';
    }

    if (search) {
      query += ' AND (u.name LIKE ? OR u.email LIKE ? OR i.instructor_id LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ' ORDER BY i.created_at DESC';

    const instructors = await db.all(query, params);
    res.json({ instructors });
  } catch (error) {
    console.error('Get instructors error:', error);
    res.status(500).json({ error: 'Failed to fetch instructors' });
  }
});

// Create instructor (Admin and Academy Heads can create, but Academy Heads need approval)
router.post('/instructors', authenticateToken, requireRole('Admin', 'DepartmentHead', 'Staff'), [
  body('email').isEmail().normalizeEmail(),
  body('name').trim().notEmpty()
], async (req, res) => {
  try {
    const { email, name, username, phone, specialization, courses_assigned, password, profile_image } = req.body;

    const existingUser = await db.get('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const { hashPassword } = require('../utils/auth');
    const passwordHash = await hashPassword(password || 'Instructor@123');

    const userResult = await db.run(
      `INSERT INTO users (email, username, password_hash, role, name, phone, profile_image, is_active, email_verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1)`,
      [email, username || email.split('@')[0], passwordHash, 'Instructor', name, phone || null, profile_image || null]
    );

    const instructorId = generateInstructorId();

    // Check if user is Academy staff (Academy Head or authorized staff)
    // Academy Head: Francess (fwallace@prinstinegroup.org)
    // Authorized staff: jsieh@prinstinegroup.org, Constantine (cvulue@prinstinegroup.org)
    let isAcademyStaff = false;
    if (req.user.role === 'Admin') {
      isAcademyStaff = true;
    } else if (req.user.role === 'DepartmentHead') {
      const dept = await db.get(
        'SELECT name FROM departments WHERE manager_id = ? OR LOWER(TRIM(head_email)) = ?',
        [req.user.id, req.user.email.toLowerCase().trim()]
      );
      if (dept && dept.name.toLowerCase().includes('academy')) {
        isAcademyStaff = true;
      } else if (req.user.email.toLowerCase() === 'fwallace@prinstinegroup.org') {
        // Explicitly allow Francess Wallace as Academy Head
        isAcademyStaff = true;
      }
    } else if (req.user.email.toLowerCase() === 'jsieh@prinstinegroup.org' || req.user.email.toLowerCase() === 'cvulue@prinstinegroup.org') {
      isAcademyStaff = true;
    }

    // If not Academy staff or Admin, deny access
    if (!isAcademyStaff && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Only Academy Heads and Admins can create instructors' });
    }

    // If created by Academy staff (not admin), require admin approval
    // 0 = Pending, 1 = Approved, 2 = Rejected
    const approved = req.user.role === 'Admin' ? 1 : 0;

    const result = await db.run(
      `INSERT INTO instructors (user_id, instructor_id, specialization, courses_assigned, approved, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        userResult.lastID, instructorId,
        specialization || null,
        courses_assigned ? JSON.stringify(courses_assigned) : null,
        approved
      ]
    );

    await logAction(req.user.id, 'create_instructor', 'academy', result.lastID, { instructorId, approved }, req);

    res.status(201).json({
      message: req.user.role === 'Admin' 
        ? 'Instructor created successfully' 
        : 'Instructor created successfully and is pending admin approval',
      instructor: { id: result.lastID, instructor_id: instructorId, approved }
    });
  } catch (error) {
    console.error('Create instructor error:', error);
    res.status(500).json({ error: 'Failed to create instructor: ' + error.message });
  }
});

// Update instructor
router.put('/instructors/:id', authenticateToken, requireRole('Admin'), async (req, res) => {
  try {
    const instructorId = req.params.id;
    const updates = req.body;

    const instructor = await db.get('SELECT user_id FROM instructors WHERE id = ?', [instructorId]);
    if (!instructor) {
      return res.status(404).json({ error: 'Instructor not found' });
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
        userParams.push(instructor.user_id);
        await db.run(`UPDATE users SET ${userUpdates.join(', ')} WHERE id = ?`, userParams);
      }
    }

    // Update instructor info
    const instructorUpdates = [];
    const instructorParams = [];
    if (updates.specialization !== undefined) {
      instructorUpdates.push('specialization = ?');
      instructorParams.push(updates.specialization);
    }
    if (updates.courses_assigned !== undefined) {
      instructorUpdates.push('courses_assigned = ?');
      instructorParams.push(JSON.stringify(updates.courses_assigned));
    }

    if (instructorUpdates.length > 0) {
      instructorParams.push(instructorId);
      await db.run(`UPDATE instructors SET ${instructorUpdates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, instructorParams);
    }

    await logAction(req.user.id, 'update_instructor', 'academy', instructorId, updates, req);

    res.json({ message: 'Instructor updated successfully' });
  } catch (error) {
    console.error('Update instructor error:', error);
    res.status(500).json({ error: 'Failed to update instructor' });
  }
});

// Get single instructor
router.get('/instructors/:id', authenticateToken, async (req, res) => {
  try {
    const instructorId = req.params.id;

    const instructor = await db.get(
      `SELECT i.*, u.name, u.email, u.phone, u.profile_image, u.username
       FROM instructors i
       JOIN users u ON i.user_id = u.id
       WHERE i.id = ? OR i.instructor_id = ?`,
      [instructorId, instructorId]
    );

    if (!instructor) {
      return res.status(404).json({ error: 'Instructor not found' });
    }

    res.json({ instructor });
  } catch (error) {
    console.error('Get instructor error:', error);
    res.status(500).json({ error: 'Failed to fetch instructor' });
  }
});

// Delete instructor
router.delete('/instructors/:id', authenticateToken, requireRole('Admin'), async (req, res) => {
  try {
    const instructorId = req.params.id;

    const instructor = await db.get('SELECT user_id FROM instructors WHERE id = ?', [instructorId]);
    if (!instructor) {
      return res.status(404).json({ error: 'Instructor not found' });
    }

    // Check if instructor has assigned courses
    const courses = await db.get('SELECT COUNT(*) as count FROM courses WHERE instructor_id = ?', [instructorId]);
    if (courses.count > 0) {
      return res.status(400).json({ error: 'Cannot delete instructor with assigned courses' });
    }

    await db.run('DELETE FROM instructors WHERE id = ?', [instructorId]);

    await logAction(req.user.id, 'delete_instructor', 'academy', instructorId, {}, req);

    res.json({ message: 'Instructor deleted successfully' });
  } catch (error) {
    console.error('Delete instructor error:', error);
    res.status(500).json({ error: 'Failed to delete instructor' });
  }
});

// ========== COURSES ==========

// Get all courses
router.get('/courses', authenticateToken, async (req, res) => {
  try {
    const { mode, status, instructor_id } = req.query;
    let query = `
      SELECT c.*, u.name as instructor_name
      FROM courses c
      LEFT JOIN instructors i ON c.instructor_id = i.id
      LEFT JOIN users u ON i.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (mode) {
      query += ' AND c.mode = ?';
      params.push(mode);
    }
    if (status) {
      query += ' AND c.status = ?';
      params.push(status);
    }
    if (instructor_id) {
      query += ' AND c.instructor_id = ?';
      params.push(instructor_id);
    }

    query += ' ORDER BY c.created_at DESC';

    const courses = await db.all(query, params);
    res.json({ courses });
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

// Get single course
router.get('/courses/:id', authenticateToken, async (req, res) => {
  try {
    const courseId = req.params.id;

    const course = await db.get(
      `SELECT c.*, u.name as instructor_name
       FROM courses c
       LEFT JOIN instructors i ON c.instructor_id = i.id
       LEFT JOIN users u ON i.user_id = u.id
       WHERE c.id = ? OR c.course_code = ?`,
      [courseId, courseId]
    );

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.json({ course });
  } catch (error) {
    console.error('Get course error:', error);
    res.status(500).json({ error: 'Failed to fetch course' });
  }
});

// Create course
router.post('/courses', authenticateToken, requireRole('Admin', 'Instructor', 'DepartmentHead'), [
  body('course_code').trim().notEmpty(),
  body('title').trim().notEmpty(),
  body('mode').isIn(['Online', 'In-person', 'Hybrid'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      course_code, title, description, instructor_id, mode,
      materials, start_date, end_date, max_students, status,
      course_fee
    } = req.body;

    // Check if course code exists
    const existing = await db.get('SELECT id FROM courses WHERE course_code = ?', [course_code]);
    if (existing) {
      return res.status(400).json({ error: 'Course code already exists' });
    }

    // Check if user is Academy staff (Academy Head or authorized staff)
    // Academy Head: Francess (fwallace@prinstinegroup.org)
    // Authorized staff: jsieh@prinstinegroup.org, Constantine (cvulue@prinstinegroup.org)
    let isAcademyStaff = false;
    if (req.user.role === 'Admin') {
      isAcademyStaff = true;
    } else if (req.user.role === 'DepartmentHead') {
      const dept = await db.get(
        'SELECT name FROM departments WHERE manager_id = ? OR LOWER(TRIM(head_email)) = ?',
        [req.user.id, req.user.email.toLowerCase().trim()]
      );
      if (dept && dept.name.toLowerCase().includes('academy')) {
        isAcademyStaff = true;
      } else if (req.user.email.toLowerCase() === 'fwallace@prinstinegroup.org') {
        // Explicitly allow Francess Wallace as Academy Head
        isAcademyStaff = true;
      }
    } else if (req.user.email.toLowerCase() === 'jsieh@prinstinegroup.org' || req.user.email.toLowerCase() === 'cvulue@prinstinegroup.org') {
      isAcademyStaff = true;
    }

    // If course_fee is provided and user is not admin, require admin approval
    const feeApproved = req.user.role === 'Admin' ? 1 : (course_fee ? 0 : null);
    const createdBy = isAcademyStaff ? req.user.id : null;

    const result = await db.run(
      `INSERT INTO courses (course_code, title, description, instructor_id, mode, materials,
        start_date, end_date, max_students, status, course_fee, fee_approved, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        course_code, title, description || null, instructor_id || null,
        mode, materials ? JSON.stringify(materials) : null,
        start_date || null, end_date || null, max_students || null,
        status || 'Active', course_fee || 0, feeApproved, createdBy
      ]
    );

    await logAction(req.user.id, 'create_course', 'academy', result.lastID, { course_code }, req);

    res.status(201).json({
      message: 'Course created successfully',
      course: { id: result.lastID, course_code }
    });
  } catch (error) {
    console.error('Create course error:', error);
    res.status(500).json({ error: 'Failed to create course' });
  }
});

// Update course
router.put('/courses/:id', authenticateToken, requireRole('Admin', 'Instructor', 'DepartmentHead'), async (req, res) => {
  try {
    const courseId = req.params.id;
    const updates = req.body;

    const course = await db.get('SELECT id FROM courses WHERE id = ?', [courseId]);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Check if course code is being changed and conflicts
    if (updates.course_code) {
      const existing = await db.get('SELECT id FROM courses WHERE course_code = ? AND id != ?', [updates.course_code, courseId]);
      if (existing) {
        return res.status(400).json({ error: 'Course code already exists' });
      }
    }

    const allowedFields = ['course_code', 'title', 'description', 'instructor_id', 'mode',
      'materials', 'start_date', 'end_date', 'max_students', 'status'];
    const updateFields = [];
    const params = [];

    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        if (field === 'materials') {
          params.push(JSON.stringify(updates[field]));
        } else {
          params.push(updates[field]);
        }
      }
    });

    if (updateFields.length > 0) {
      params.push(courseId);
      await db.run(`UPDATE courses SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, params);
    }

    await logAction(req.user.id, 'update_course', 'academy', courseId, updates, req);

    res.json({ message: 'Course updated successfully' });
  } catch (error) {
    console.error('Update course error:', error);
    res.status(500).json({ error: 'Failed to update course' });
  }
});

// Delete course
router.delete('/courses/:id', authenticateToken, requireRole('Admin'), async (req, res) => {
  try {
    const courseId = req.params.id;

    const course = await db.get('SELECT id FROM courses WHERE id = ?', [courseId]);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Check if course has enrollments
    const enrollments = await db.get('SELECT COUNT(*) as count FROM enrollments WHERE course_id = ?', [courseId]);
    if (enrollments.count > 0) {
      return res.status(400).json({ error: 'Cannot delete course with enrolled students' });
    }

    await db.run('DELETE FROM courses WHERE id = ?', [courseId]);

    await logAction(req.user.id, 'delete_course', 'academy', courseId, {}, req);

    res.json({ message: 'Course deleted successfully' });
  } catch (error) {
    console.error('Delete course error:', error);
    res.status(500).json({ error: 'Failed to delete course' });
  }
});

// ========== ENROLLMENTS ==========

// Enroll student in course
router.post('/enrollments', authenticateToken, requireRole('Admin', 'Instructor'), [
  body('student_id').isInt(),
  body('course_id').isInt()
], async (req, res) => {
  try {
    const { student_id, course_id } = req.body;

    // Check if already enrolled
    const existing = await db.get(
      'SELECT id FROM enrollments WHERE student_id = ? AND course_id = ?',
      [student_id, course_id]
    );
    if (existing) {
      return res.status(400).json({ error: 'Student already enrolled in this course' });
    }

    const result = await db.run(
      `INSERT INTO enrollments (student_id, course_id, enrollment_date, status)
       VALUES (?, ?, CURRENT_DATE, 'Enrolled')`,
      [student_id, course_id]
    );

    await logAction(req.user.id, 'enroll_student', 'academy', result.lastID, { student_id, course_id }, req);

    res.status(201).json({ message: 'Student enrolled successfully', enrollmentId: result.lastID });
  } catch (error) {
    console.error('Enroll error:', error);
    res.status(500).json({ error: 'Failed to enroll student' });
  }
});

// Get enrollments for a student
router.get('/students/:id/enrollments', authenticateToken, async (req, res) => {
  try {
    const studentId = req.params.id;

    const enrollments = await db.all(
      `SELECT e.*, c.course_code, c.title, c.mode
       FROM enrollments e
       JOIN courses c ON e.course_id = c.id
       WHERE e.student_id = ?
       ORDER BY e.enrollment_date DESC`,
      [studentId]
    );

    res.json({ enrollments });
  } catch (error) {
    console.error('Get enrollments error:', error);
    res.status(500).json({ error: 'Failed to fetch enrollments' });
  }
});

// ========== CERTIFICATES ==========

// Create certificate
router.post('/certificates', authenticateToken, requireRole('Admin', 'Instructor'), [
  body('student_id').isInt(),
  body('course_id').isInt(),
  body('grade').trim().notEmpty()
], async (req, res) => {
  try {
    const { student_id, course_id, grade, issue_date } = req.body;

    // Check if enrollment exists and is completed
    const enrollment = await db.get(
      'SELECT id FROM enrollments WHERE student_id = ? AND course_id = ?',
      [student_id, course_id]
    );
    if (!enrollment) {
      return res.status(400).json({ error: 'Student not enrolled in this course' });
    }

    const certificateId = generateCertificateId();
    const verificationCode = crypto.randomBytes(16).toString('hex').toUpperCase();

    const result = await db.run(
      `INSERT INTO certificates (certificate_id, student_id, course_id, issue_date, grade, verification_code)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        certificateId, student_id, course_id,
        issue_date || new Date().toISOString().split('T')[0],
        grade, verificationCode
      ]
    );

    // Update enrollment status
    await db.run(
      'UPDATE enrollments SET status = ?, completion_date = CURRENT_DATE WHERE student_id = ? AND course_id = ?',
      ['Completed', student_id, course_id]
    );

    await logAction(req.user.id, 'create_certificate', 'academy', result.lastID, { certificateId }, req);

    res.status(201).json({
      message: 'Certificate created successfully',
      certificate: { id: result.lastID, certificate_id: certificateId, verification_code: verificationCode }
    });
  } catch (error) {
    console.error('Create certificate error:', error);
    res.status(500).json({ error: 'Failed to create certificate' });
  }
});

// Verify certificate (public endpoint - no auth required)
router.get('/certificates/verify/:code', async (req, res) => {
  try {
    const code = req.params.code;

    const certificate = await db.get(
      `SELECT c.*, s.student_id, u.name as student_name, co.course_code, co.title
       FROM certificates c
       JOIN students s ON c.student_id = s.id
       JOIN users u ON s.user_id = u.id
       JOIN courses co ON c.course_id = co.id
       WHERE c.verification_code = ?`,
      [code]
    );

    if (!certificate) {
      return res.status(404).json({ error: 'Certificate not found or invalid verification code' });
    }

    res.json({
      valid: true,
      certificate: {
        certificate_id: certificate.certificate_id,
        student_name: certificate.student_name,
        student_id: certificate.student_id,
        course_code: certificate.course_code,
        course_title: certificate.title,
        issue_date: certificate.issue_date,
        grade: certificate.grade
      }
    });
  } catch (error) {
    console.error('Verify certificate error:', error);
    res.status(500).json({ error: 'Failed to verify certificate' });
  }
});

// ========== ADMIN APPROVAL ENDPOINTS ==========

// Approve/reject course fee (Admin only)
router.put('/courses/:id/approve-fee', authenticateToken, requireRole('Admin'), [
  body('approved').isBoolean().withMessage('Approved status is required'),
  body('admin_notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { approved, admin_notes } = req.body;

    const course = await db.get('SELECT id, fee_approved FROM courses WHERE id = ?', [req.params.id]);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const feeApproved = approved ? 1 : 2; // 1 = Approved, 2 = Rejected
    
    await db.run(
      `UPDATE courses 
       SET fee_approved = ?, approved_by = ?, approved_at = CURRENT_TIMESTAMP, admin_notes = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [feeApproved, req.user.id, admin_notes || null, req.params.id]
    );

    await logAction(req.user.id, approved ? 'approve_course_fee' : 'reject_course_fee', 'academy', req.params.id, { approved }, req);

    res.json({ message: `Course fee ${approved ? 'approved' : 'rejected'} successfully` });
  } catch (error) {
    console.error('Approve course fee error:', error);
    res.status(500).json({ error: 'Failed to process approval' });
  }
});

// Approve/reject instructor (Admin only)
router.put('/instructors/:id/approve', authenticateToken, requireRole('Admin'), [
  body('approved').isBoolean().withMessage('Approved status is required'),
  body('admin_notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { approved, admin_notes } = req.body;

    const instructor = await db.get('SELECT id, user_id, approved FROM instructors WHERE id = ?', [req.params.id]);
    if (!instructor) {
      return res.status(404).json({ error: 'Instructor not found' });
    }

    const approvedStatus = approved ? 1 : 2; // 1 = Approved, 2 = Rejected
    
    await db.run(
      `UPDATE instructors 
       SET approved = ?, approved_by = ?, approved_at = CURRENT_TIMESTAMP, admin_notes = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [approvedStatus, req.user.id, admin_notes || null, req.params.id]
    );

    // Update user account to active if approved, inactive if rejected
    await db.run(
      `UPDATE users SET is_active = ? WHERE id = ?`,
      [approved ? 1 : 0, instructor.user_id]
    );

    await logAction(req.user.id, approved ? 'approve_instructor' : 'reject_instructor', 'academy', req.params.id, { approved }, req);

    res.json({ message: `Instructor ${approved ? 'approved' : 'rejected'} successfully` });
  } catch (error) {
    console.error('Approve instructor error:', error);
    res.status(500).json({ error: 'Failed to process approval' });
  }
});

module.exports = router;


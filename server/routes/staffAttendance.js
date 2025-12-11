const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken, requireRole } = require('../utils/auth');
const { sendNotificationToUser, sendNotificationToRole } = require('../utils/notifications');

// Get all attendance records (Admin sees all, users see their own)
router.get('/', authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT 
        sa.*,
        u.name as user_name,
        u.email as user_email,
        approver.name as approver_name
      FROM staff_attendance sa
      LEFT JOIN users u ON sa.user_id = u.id
      LEFT JOIN users approver ON sa.approved_by = approver.id
      WHERE 1=1
    `;
    
    const params = [];
    
    // Non-admin users only see their own attendance
    if (req.user.role !== 'Admin') {
      query += ' AND sa.user_id = ?';
      params.push(req.user.id);
    }
    
    query += ' ORDER BY sa.attendance_date DESC, sa.created_at DESC';
    
    const attendance = await db.all(query, params);
    res.json({ attendance });
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance: ' + error.message });
  }
});

// Get single attendance record
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT 
        sa.*,
        u.name as user_name,
        u.email as user_email,
        approver.name as approver_name
      FROM staff_attendance sa
      LEFT JOIN users u ON sa.user_id = u.id
      LEFT JOIN users approver ON sa.approved_by = approver.id
      WHERE sa.id = ?
    `;
    
    const params = [req.params.id];
    
    // Non-admin users can only see their own attendance
    if (req.user.role !== 'Admin') {
      query += ' AND sa.user_id = ?';
      params.push(req.user.id);
    }
    
    query += ' LIMIT 1';
    
    const attendance = await db.get(query, params);
    
    if (!attendance) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }
    
    res.json({ attendance });
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance: ' + error.message });
  }
});

// Sign in
router.post('/sign-in', authenticateToken, async (req, res) => {
  try {
    const { late_reason } = req.body;
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();
    
    // Check if already signed in today
    const existing = await db.get(
      'SELECT * FROM staff_attendance WHERE user_id = ? AND attendance_date = ?',
      [req.user.id, today]
    );
    
    if (existing && existing.sign_in_time) {
      return res.status(400).json({ error: 'You have already signed in today' });
    }
    
    // Determine if late (assuming 9:00 AM is standard start time)
    const signInTime = new Date(now);
    const standardStartTime = new Date(signInTime);
    standardStartTime.setHours(9, 0, 0, 0);
    const isLate = signInTime > standardStartTime;
    
    // Get user info
    const user = await db.get('SELECT name FROM users WHERE id = ?', [req.user.id]);
    const userName = user?.name || req.user.name || req.user.email;
    
    if (existing) {
      // Update existing record
      await db.run(`
        UPDATE staff_attendance SET
          sign_in_time = ?,
          sign_in_late = ?,
          sign_in_late_reason = ?,
          status = 'Pending',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [now, isLate ? 1 : 0, isLate ? (late_reason || null) : null, existing.id]);
      
      const updated = await db.get('SELECT * FROM staff_attendance WHERE id = ?', [existing.id]);
      
      // Notify admin
      try {
        await sendNotificationToRole('Admin', {
          title: 'Staff Sign-In',
          message: `${userName} has signed in${isLate ? ' (LATE)' : ''}${isLate && late_reason ? `: ${late_reason}` : ''}`,
          link: `/attendance`,
          type: isLate ? 'warning' : 'info',
          senderId: req.user.id
        });
      } catch (notifError) {
        console.error('Error sending notification:', notifError);
      }
      
      res.json({ 
        message: isLate ? 'Signed in (late). Reason recorded.' : 'Signed in successfully',
        attendance: updated 
      });
    } else {
      // Create new record
      const result = await db.run(`
        INSERT INTO staff_attendance (
          user_id, user_name, attendance_date, sign_in_time,
          sign_in_late, sign_in_late_reason, status
        ) VALUES (?, ?, ?, ?, ?, ?, 'Pending')
      `, [
        req.user.id, userName, today, now,
        isLate ? 1 : 0, isLate ? (late_reason || null) : null
      ]);
      
      const newAttendance = await db.get('SELECT * FROM staff_attendance WHERE id = ?', [result.lastID]);
      
      // Notify admin
      try {
        await sendNotificationToRole('Admin', {
          title: 'Staff Sign-In',
          message: `${userName} has signed in${isLate ? ' (LATE)' : ''}${isLate && late_reason ? `: ${late_reason}` : ''}`,
          link: `/attendance`,
          type: isLate ? 'warning' : 'info',
          senderId: req.user.id
        });
      } catch (notifError) {
        console.error('Error sending notification:', notifError);
      }
      
      res.status(201).json({ 
        message: isLate ? 'Signed in (late). Reason recorded.' : 'Signed in successfully',
        attendance: newAttendance 
      });
    }
  } catch (error) {
    console.error('Sign in error:', error);
    res.status(500).json({ error: 'Failed to sign in: ' + error.message });
  }
});

// Sign out
router.post('/sign-out', authenticateToken, async (req, res) => {
  try {
    const { early_reason } = req.body;
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();
    
    // Get today's attendance record
    const attendance = await db.get(
      'SELECT * FROM staff_attendance WHERE user_id = ? AND attendance_date = ?',
      [req.user.id, today]
    );
    
    if (!attendance) {
      return res.status(400).json({ error: 'You must sign in before signing out' });
    }
    
    if (attendance.sign_out_time) {
      return res.status(400).json({ error: 'You have already signed out today' });
    }
    
    // Determine if early (assuming 5:00 PM is standard end time)
    const signOutTime = new Date(now);
    const standardEndTime = new Date(signOutTime);
    standardEndTime.setHours(17, 0, 0, 0);
    const isEarly = signOutTime < standardEndTime;
    
    // Get user info
    const user = await db.get('SELECT name FROM users WHERE id = ?', [req.user.id]);
    const userName = user?.name || req.user.name || req.user.email;
    
    // Update attendance record
    await db.run(`
      UPDATE staff_attendance SET
        sign_out_time = ?,
        sign_out_early = ?,
        sign_out_early_reason = ?,
        status = 'Pending',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [now, isEarly ? 1 : 0, isEarly ? (early_reason || null) : null, attendance.id]);
    
    const updated = await db.get('SELECT * FROM staff_attendance WHERE id = ?', [attendance.id]);
    
    // Notify admin
    try {
      await sendNotificationToRole('Admin', {
        title: 'Staff Sign-Out',
        message: `${userName} has signed out${isEarly ? ' (EARLY)' : ''}${isEarly && early_reason ? `: ${early_reason}` : ''}`,
        link: `/attendance`,
        type: isEarly ? 'warning' : 'info',
        senderId: req.user.id
      });
    } catch (notifError) {
      console.error('Error sending notification:', notifError);
    }
    
    res.json({ 
      message: isEarly ? 'Signed out (early). Reason recorded.' : 'Signed out successfully',
      attendance: updated 
    });
  } catch (error) {
    console.error('Sign out error:', error);
    res.status(500).json({ error: 'Failed to sign out: ' + error.message });
  }
});

// Approve/Reject attendance (Admin only)
router.put('/:id/approve', authenticateToken, requireRole('Admin'), async (req, res) => {
  try {
    const { status, admin_notes } = req.body;
    
    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be Approved or Rejected' });
    }
    
    const attendance = await db.get('SELECT * FROM staff_attendance WHERE id = ?', [req.params.id]);
    if (!attendance) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }
    
    // Update attendance
    await db.run(`
      UPDATE staff_attendance SET
        status = ?,
        approved_by = ?,
        approved_at = CURRENT_TIMESTAMP,
        admin_notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [status, req.user.id, admin_notes || null, req.params.id]);
    
    const updated = await db.get('SELECT * FROM staff_attendance WHERE id = ?', [req.params.id]);
    
    // Notify user
    try {
      await sendNotificationToUser(attendance.user_id, {
        title: `Attendance ${status}`,
        message: `Your attendance for ${attendance.attendance_date} has been ${status.toLowerCase()}${admin_notes ? `: ${admin_notes}` : ''}`,
        link: `/attendance`,
        type: status === 'Approved' ? 'success' : 'warning',
        senderId: req.user.id
      });
    } catch (notifError) {
      console.error('Error sending notification:', notifError);
    }
    
    res.json({ 
      message: `Attendance ${status.toLowerCase()} successfully`,
      attendance: updated 
    });
  } catch (error) {
    console.error('Approve attendance error:', error);
    res.status(500).json({ error: 'Failed to approve attendance: ' + error.message });
  }
});

// Get today's attendance status for current user
router.get('/today/status', authenticateToken, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const attendance = await db.get(
      'SELECT * FROM staff_attendance WHERE user_id = ? AND attendance_date = ?',
      [req.user.id, today]
    );
    
    res.json({ 
      attendance: attendance || null,
      canSignIn: !attendance || !attendance.sign_in_time,
      canSignOut: attendance && attendance.sign_in_time && !attendance.sign_out_time
    });
  } catch (error) {
    console.error('Get today status error:', error);
    res.status(500).json({ error: 'Failed to fetch today status: ' + error.message });
  }
});

module.exports = router;


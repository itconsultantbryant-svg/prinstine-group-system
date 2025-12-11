const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../utils/auth');
const { createNotification, sendNotificationToUser } = require('../utils/notifications');

// Get all meetings (users see their own meetings, admin sees all)
router.get('/', authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT 
        m.*,
        u.name as creator_name,
        u.email as creator_email,
        COUNT(DISTINCT ma.user_id) as attendee_count,
        COUNT(DISTINCT CASE WHEN ma.response_status = 'accepted' THEN ma.user_id END) as accepted_count
      FROM meetings m
      LEFT JOIN users u ON m.created_by = u.id
      LEFT JOIN meeting_attendees ma ON m.id = ma.meeting_id
      WHERE 1=1
    `;
    
    const params = [];
    
    // Non-admin users only see meetings they're invited to or created
    if (req.user.role !== 'Admin') {
      query += ` AND (m.created_by = ? OR EXISTS (
        SELECT 1 FROM meeting_attendees ma2 
        WHERE ma2.meeting_id = m.id AND ma2.user_id = ?
      ))`;
      params.push(req.user.id, req.user.id);
    }
    
    query += ` GROUP BY m.id ORDER BY m.meeting_date DESC, m.start_time DESC`;
    
    const meetings = await db.all(query, params);
    
    // Get attendees for each meeting
    for (const meeting of meetings) {
      const attendees = await db.all(`
        SELECT 
          ma.*,
          u.name as user_name,
          u.email as user_email
        FROM meeting_attendees ma
        LEFT JOIN users u ON ma.user_id = u.id
        WHERE ma.meeting_id = ?
      `, [meeting.id]);
      meeting.attendees = attendees;
    }
    
    res.json({ meetings });
  } catch (error) {
    console.error('Get meetings error:', error);
    if (error.message && error.message.includes('no such table')) {
      console.warn('meetings table does not exist yet');
      return res.json({ meetings: [] });
    }
    res.status(500).json({ error: 'Failed to fetch meetings: ' + error.message });
  }
});

// Get single meeting
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const meeting = await db.get(`
      SELECT 
        m.*,
        u.name as creator_name,
        u.email as creator_email
      FROM meetings m
      LEFT JOIN users u ON m.created_by = u.id
      WHERE m.id = ?
    `, [req.params.id]);
    
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    
    // Check permissions
    if (req.user.role !== 'Admin' && meeting.created_by !== req.user.id) {
      const isAttendee = await db.get(
        'SELECT id FROM meeting_attendees WHERE meeting_id = ? AND user_id = ?',
        [req.params.id, req.user.id]
      );
      if (!isAttendee) {
        return res.status(403).json({ error: 'You are not authorized to view this meeting' });
      }
    }
    
    // Get attendees
    const attendees = await db.all(`
      SELECT 
        ma.*,
        u.name as user_name,
        u.email as user_email
      FROM meeting_attendees ma
      LEFT JOIN users u ON ma.user_id = u.id
      WHERE ma.meeting_id = ?
    `, [req.params.id]);
    meeting.attendees = attendees;
    
    // Get attendance log
    const attendanceLog = await db.all(`
      SELECT 
        mal.*,
        u.name as user_name,
        marked_by_user.name as marked_by_name
      FROM meeting_attendance_log mal
      LEFT JOIN users u ON mal.user_id = u.id
      LEFT JOIN users marked_by_user ON mal.marked_by = marked_by_user.id
      WHERE mal.meeting_id = ?
      ORDER BY mal.marked_at DESC
    `, [req.params.id]);
    meeting.attendance_log = attendanceLog;
    
    res.json({ meeting });
  } catch (error) {
    console.error('Get meeting error:', error);
    res.status(500).json({ error: 'Failed to fetch meeting: ' + error.message });
  }
});

// Create meeting
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      title,
      purpose,
      meeting_date,
      start_time,
      end_time,
      meeting_type,
      meeting_link,
      meeting_location,
      attendee_user_ids,
      attendee_roles,
      notes
    } = req.body;

    // Validation
    if (!title || !purpose || !meeting_date || !start_time || !end_time || !meeting_type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (meeting_type === 'online' && !meeting_link) {
      return res.status(400).json({ error: 'Meeting link is required for online meetings' });
    }

    if (meeting_type === 'in-person' && !meeting_location) {
      return res.status(400).json({ error: 'Meeting location is required for in-person meetings' });
    }

    if ((!attendee_user_ids || attendee_user_ids.length === 0) && (!attendee_roles || attendee_roles.length === 0)) {
      return res.status(400).json({ error: 'Please select at least one attendee or role' });
    }

    // Get user info
    const user = await db.get('SELECT name FROM users WHERE id = ?', [req.user.id]);
    const created_by_name = user?.name || req.user.name || req.user.email;

    // Create meeting
    const result = await db.run(`
      INSERT INTO meetings (
        title, purpose, meeting_date, start_time, end_time,
        meeting_type, meeting_link, meeting_location,
        created_by, created_by_name, notes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')
    `, [
      title, purpose, meeting_date, start_time, end_time,
      meeting_type, meeting_link || null, meeting_location || null,
      req.user.id, created_by_name, notes || null
    ]);

    const meetingId = result.lastID;

    // Get attendees based on user IDs and roles
    let allAttendeeIds = [];
    
    if (attendee_user_ids && attendee_user_ids.length > 0) {
      allAttendeeIds = [...attendee_user_ids];
    }
    
    if (attendee_roles && attendee_roles.length > 0) {
      const roleUsers = await db.all(
        'SELECT id FROM users WHERE role IN (' + attendee_roles.map(() => '?').join(',') + ') AND is_active = 1',
        attendee_roles
      );
      const roleUserIds = roleUsers.map(u => u.id);
      allAttendeeIds = [...new Set([...allAttendeeIds, ...roleUserIds])];
    }

    // Remove creator from attendees if they're in the list
    allAttendeeIds = allAttendeeIds.filter(id => id !== req.user.id);

    // Add attendees
    for (const userId of allAttendeeIds) {
      const attendeeUser = await db.get('SELECT name, email FROM users WHERE id = ?', [userId]);
      if (attendeeUser) {
        await db.run(`
          INSERT INTO meeting_attendees (
            meeting_id, user_id, user_name, user_email, invited_by
          ) VALUES (?, ?, ?, ?, ?)
        `, [meetingId, userId, attendeeUser.name, attendeeUser.email, req.user.id]);

        // Send real-time notification
        try {
          await sendNotificationToUser(userId, {
            title: 'Meeting Invitation',
            message: `You have been invited to a meeting: "${title}" on ${meeting_date} at ${start_time}`,
            link: `/meetings/${meetingId}`,
            type: 'info',
            senderId: req.user.id
          });
        } catch (notifError) {
          console.error('Error sending notification:', notifError);
        }
      }
    }

    // Notify creator about meeting creation
    try {
      await sendNotificationToUser(req.user.id, {
        title: 'Meeting Created',
        message: `Meeting "${title}" has been created and invitations sent to ${allAttendeeIds.length} attendee(s)`,
        link: `/meetings/${meetingId}`,
        type: 'success',
        senderId: req.user.id
      });
    } catch (notifError) {
      console.error('Error sending notification to creator:', notifError);
    }

    const newMeeting = await db.get('SELECT * FROM meetings WHERE id = ?', [meetingId]);
    
    res.status(201).json({ 
      message: 'Meeting created successfully',
      meeting: newMeeting 
    });
  } catch (error) {
    console.error('Create meeting error:', error);
    res.status(500).json({ error: 'Failed to create meeting: ' + error.message });
  }
});

// Update meeting
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const meeting = await db.get('SELECT * FROM meetings WHERE id = ?', [req.params.id]);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Only creator or admin can update
    if (meeting.created_by !== req.user.id && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'You can only update meetings you created' });
    }

    const {
      title,
      purpose,
      meeting_date,
      start_time,
      end_time,
      meeting_type,
      meeting_link,
      meeting_location,
      notes
    } = req.body;

    await db.run(`
      UPDATE meetings SET
        title = ?,
        purpose = ?,
        meeting_date = ?,
        start_time = ?,
        end_time = ?,
        meeting_type = ?,
        meeting_link = ?,
        meeting_location = ?,
        notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      title, purpose, meeting_date, start_time, end_time,
      meeting_type, meeting_link || null, meeting_location || null,
      notes || null, req.params.id
    ]);

    const updated = await db.get('SELECT * FROM meetings WHERE id = ?', [req.params.id]);
    
    res.json({ 
      message: 'Meeting updated successfully',
      meeting: updated 
    });
  } catch (error) {
    console.error('Update meeting error:', error);
    res.status(500).json({ error: 'Failed to update meeting: ' + error.message });
  }
});

// Respond to meeting invitation
router.put('/:id/respond', authenticateToken, async (req, res) => {
  try {
    const { response_status } = req.body;

    if (!['accepted', 'declined', 'maybe'].includes(response_status)) {
      return res.status(400).json({ error: 'Invalid response status' });
    }

    const attendee = await db.get(
      'SELECT * FROM meeting_attendees WHERE meeting_id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );

    if (!attendee) {
      return res.status(404).json({ error: 'You are not an attendee of this meeting' });
    }

    await db.run(`
      UPDATE meeting_attendees SET
        response_status = ?,
        responded_at = CURRENT_TIMESTAMP
      WHERE meeting_id = ? AND user_id = ?
    `, [response_status, req.params.id, req.user.id]);

    // Get meeting and attendee info for notification
    const meeting = await db.get('SELECT * FROM meetings WHERE id = ?', [req.params.id]);
    const attendeeInfo = await db.get('SELECT user_name FROM meeting_attendees WHERE meeting_id = ? AND user_id = ?', [req.params.id, req.user.id]);
    const creator = await db.get('SELECT created_by FROM meetings WHERE id = ?', [req.params.id]);

    // Notify meeting creator about the response
    if (creator && creator.created_by !== req.user.id) {
      try {
        await sendNotificationToUser(creator.created_by, {
          title: 'Meeting Response',
          message: `${attendeeInfo?.user_name || attendee?.user_name || 'An attendee'} ${response_status} your meeting: "${meeting?.title || 'Meeting'}"`,
          link: `/meetings/${req.params.id}`,
          type: response_status === 'accepted' ? 'success' : 'info',
          senderId: req.user.id
        });
      } catch (notifError) {
        console.error('Error sending notification:', notifError);
      }
    }

    res.json({ message: 'Response recorded successfully' });
  } catch (error) {
    console.error('Respond to meeting error:', error);
    res.status(500).json({ error: 'Failed to record response: ' + error.message });
  }
});

// Mark attendance
router.post('/:id/attendance', authenticateToken, async (req, res) => {
  try {
    const { user_id, attendance_status, notes } = req.body;

    if (!['present', 'absent', 'late', 'excused'].includes(attendance_status)) {
      return res.status(400).json({ error: 'Invalid attendance status' });
    }

    const meeting = await db.get('SELECT * FROM meetings WHERE id = ?', [req.params.id]);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Check if user is an attendee
    const attendee = await db.get(
      'SELECT * FROM meeting_attendees WHERE meeting_id = ? AND user_id = ?',
      [req.params.id, user_id]
    );

    if (!attendee) {
      return res.status(404).json({ error: 'User is not an attendee of this meeting' });
    }

    // Only creator, admin, or the user themselves can mark attendance
    if (meeting.created_by !== req.user.id && req.user.role !== 'Admin' && user_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only mark your own attendance or be the meeting creator/admin' });
    }

    // Update attendee record
    await db.run(`
      UPDATE meeting_attendees SET
        attendance_status = ?,
        attendance_marked_at = CURRENT_TIMESTAMP,
        notes = ?
      WHERE meeting_id = ? AND user_id = ?
    `, [attendance_status, notes || null, req.params.id, user_id]);

    // Add to attendance log
    await db.run(`
      INSERT INTO meeting_attendance_log (
        meeting_id, user_id, marked_by, attendance_status, notes
      ) VALUES (?, ?, ?, ?, ?)
    `, [req.params.id, user_id, req.user.id, attendance_status, notes || null]);

    // Get meeting and user info for notification
    const meetingInfo = await db.get('SELECT title, created_by FROM meetings WHERE id = ?', [req.params.id]);
    const markedUser = await db.get('SELECT name FROM users WHERE id = ?', [user_id]);

    // Notify the user whose attendance was marked (if not self-marked)
    if (user_id !== req.user.id) {
      try {
        await sendNotificationToUser(user_id, {
          title: 'Attendance Marked',
          message: `Your attendance for meeting "${meetingInfo?.title || 'Meeting'}" has been marked as ${attendance_status}`,
          link: `/meetings/${req.params.id}`,
          type: attendance_status === 'present' ? 'success' : 'info',
          senderId: req.user.id
        });
      } catch (notifError) {
        console.error('Error sending notification:', notifError);
      }
    }

    // Notify meeting creator if different from marker
    if (meetingInfo && meetingInfo.created_by !== req.user.id) {
      try {
        await sendNotificationToUser(meetingInfo.created_by, {
          title: 'Attendance Updated',
          message: `${markedUser?.name || 'An attendee'}'s attendance for "${meetingInfo.title}" has been marked as ${attendance_status}`,
          link: `/meetings/${req.params.id}`,
          type: 'info',
          senderId: req.user.id
        });
      } catch (notifError) {
        console.error('Error sending notification:', notifError);
      }
    }

    res.json({ message: 'Attendance marked successfully' });
  } catch (error) {
    console.error('Mark attendance error:', error);
    res.status(500).json({ error: 'Failed to mark attendance: ' + error.message });
  }
});

// Delete meeting
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const meeting = await db.get('SELECT * FROM meetings WHERE id = ?', [req.params.id]);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Only creator or admin can delete
    if (meeting.created_by !== req.user.id && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'You can only delete meetings you created' });
    }

    await db.run('DELETE FROM meetings WHERE id = ?', [req.params.id]);
    
    res.json({ message: 'Meeting deleted successfully' });
  } catch (error) {
    console.error('Delete meeting error:', error);
    res.status(500).json({ error: 'Failed to delete meeting: ' + error.message });
  }
});

// Get calendar events (for calendar component)
router.get('/calendar/events', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    let query = `
      SELECT 
        m.id,
        m.title,
        m.purpose,
        m.meeting_date as start,
        m.start_time,
        m.end_time,
        m.meeting_type,
        m.meeting_link,
        m.meeting_location,
        m.status,
        m.created_by,
        u.name as creator_name
      FROM meetings m
      LEFT JOIN users u ON m.created_by = u.id
      LEFT JOIN meeting_attendees ma ON m.id = ma.meeting_id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (start_date) {
      query += ' AND m.meeting_date >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      query += ' AND m.meeting_date <= ?';
      params.push(end_date);
    }
    
    // Non-admin users only see their meetings
    if (req.user.role !== 'Admin') {
      query += ` AND (m.created_by = ? OR ma.user_id = ?)`;
      params.push(req.user.id, req.user.id);
    }
    
    query += ' GROUP BY m.id ORDER BY m.meeting_date, m.start_time';
    
    const meetings = await db.all(query, params);
    
    // Format for calendar
    const events = meetings.map(meeting => {
      const startDateTime = `${meeting.start} ${meeting.start_time}`;
      const endDateTime = `${meeting.start} ${meeting.end_time}`;
      
      return {
        id: meeting.id,
        title: meeting.title,
        description: meeting.purpose,
        start: new Date(startDateTime).toISOString(),
        end: new Date(endDateTime).toISOString(),
        type: 'meeting',
        meeting_type: meeting.meeting_type,
        meeting_link: meeting.meeting_link,
        meeting_location: meeting.meeting_location,
        status: meeting.status,
        creator: meeting.creator_name,
        color: meeting.status === 'completed' ? '#6c757d' : 
               meeting.status === 'cancelled' ? '#dc3545' : '#007bff'
      };
    });
    
    res.json({ events });
  } catch (error) {
    console.error('Get calendar events error:', error);
    res.status(500).json({ error: 'Failed to fetch calendar events: ' + error.message });
  }
});

module.exports = router;


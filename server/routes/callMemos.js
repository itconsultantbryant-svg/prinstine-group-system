const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../utils/auth');
const { sendNotificationToAll } = require('../utils/notifications');

// Get all call memos (accessible to all authenticated users)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const callMemos = await db.all(`
      SELECT 
        cm.*,
        cu.email as client_email,
        cu.phone as client_phone,
        u.name as creator_name,
        u.email as creator_email
      FROM call_memos cm
      LEFT JOIN clients c ON cm.client_id = c.id
      LEFT JOIN users cu ON c.user_id = cu.id
      LEFT JOIN users u ON cm.created_by = u.id
      ORDER BY cm.call_date DESC, cm.created_at DESC
    `);
    
    res.json({ callMemos });
  } catch (error) {
    console.error('Get call memos error:', error);
    res.status(500).json({ error: 'Failed to fetch call memos: ' + error.message });
  }
});

// Get single call memo
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const callMemo = await db.get(`
      SELECT 
        cm.*,
        cu.email as client_email,
        cu.phone as client_phone,
        u.name as creator_name,
        u.email as creator_email
      FROM call_memos cm
      LEFT JOIN clients c ON cm.client_id = c.id
      LEFT JOIN users cu ON c.user_id = cu.id
      LEFT JOIN users u ON cm.created_by = u.id
      WHERE cm.id = ?
    `, [req.params.id]);
    
    if (!callMemo) {
      return res.status(404).json({ error: 'Call memo not found' });
    }
    
    res.json({ callMemo });
  } catch (error) {
    console.error('Get call memo error:', error);
    res.status(500).json({ error: 'Failed to fetch call memo: ' + error.message });
  }
});

// Create call memo
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      client_id,
      client_name,
      participants,
      subject,
      call_date,
      discussion,
      service_needed,
      service_other,
      department_needed,
      next_visitation_date
    } = req.body;

    // Validation
    if (!client_id || !client_name || !participants || !subject || !call_date || !discussion || !service_needed) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get user info
    const user = await db.get('SELECT name FROM users WHERE id = ?', [req.user.id]);
    const created_by_name = user?.name || req.user.name || req.user.email;

    const result = await db.run(`
      INSERT INTO call_memos (
        client_id, client_name, participants, subject, call_date, discussion,
        service_needed, service_other, department_needed, next_visitation_date,
        created_by, created_by_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      client_id, client_name, participants, subject, call_date, discussion,
      service_needed, service_other || null, department_needed || null, next_visitation_date || null,
      req.user.id, created_by_name
    ]);

    const newCallMemo = await db.get('SELECT * FROM call_memos WHERE id = ?', [result.lastID]);
    
    // Send real-time notification to all users about new call memo
    try {
      await sendNotificationToAll(
        'New Call Memo Added',
        `A new call memo "${subject}" has been added to the system`,
        'info',
        `/call-memos/${result.lastID}`,
        req.user.id
      );
    } catch (notifError) {
      console.error('Error sending notification:', notifError);
    }
    
    res.status(201).json({ 
      message: 'Call memo created successfully',
      callMemo: newCallMemo 
    });
  } catch (error) {
    console.error('Create call memo error:', error);
    res.status(500).json({ error: 'Failed to create call memo' });
  }
});

// Update call memo
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const {
      client_id,
      client_name,
      participants,
      subject,
      call_date,
      discussion,
      service_needed,
      service_other,
      department_needed,
      next_visitation_date
    } = req.body;

    // Check if call memo exists
    const existing = await db.get('SELECT * FROM call_memos WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Call memo not found' });
    }

    // Only creator can update
    if (existing.created_by !== req.user.id && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'You can only update your own call memos' });
    }

    await db.run(`
      UPDATE call_memos SET
        client_id = ?,
        client_name = ?,
        participants = ?,
        subject = ?,
        call_date = ?,
        discussion = ?,
        service_needed = ?,
        service_other = ?,
        department_needed = ?,
        next_visitation_date = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      client_id, client_name, participants, subject, call_date, discussion,
      service_needed, service_other || null, department_needed || null, next_visitation_date || null,
      req.params.id
    ]);

    const updated = await db.get('SELECT * FROM call_memos WHERE id = ?', [req.params.id]);
    
    res.json({ 
      message: 'Call memo updated successfully',
      callMemo: updated 
    });
  } catch (error) {
    console.error('Update call memo error:', error);
    res.status(500).json({ error: 'Failed to update call memo' });
  }
});

// Delete call memo
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const existing = await db.get('SELECT * FROM call_memos WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Call memo not found' });
    }

    // Only creator or admin can delete
    if (existing.created_by !== req.user.id && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'You can only delete your own call memos' });
    }

    await db.run('DELETE FROM call_memos WHERE id = ?', [req.params.id]);
    
    res.json({ message: 'Call memo deleted successfully' });
  } catch (error) {
    console.error('Delete call memo error:', error);
    res.status(500).json({ error: 'Failed to delete call memo' });
  }
});

module.exports = router;


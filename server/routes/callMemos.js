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

    // Validation - client_name is required, client_id can be null if creating new client
    if (!client_name || !participants || !subject || !call_date || !discussion || !service_needed) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get user info
    const user = await db.get('SELECT name FROM users WHERE id = ?', [req.user.id]);
    const created_by_name = user?.name || req.user.name || req.user.email;

    // Auto-create client if client_id is not provided but client_name is
    let finalClientId = client_id;
    if (!client_id && client_name) {
      try {
        // Generate a temporary email for the client
        const tempEmail = `${client_name.toLowerCase().replace(/[^a-z0-9]/g, '.')}@client.prinstinegroup.org`;
        
        // Check if client already exists by name
        const existingClientByName = await db.get(`
          SELECT c.id 
          FROM clients c
          LEFT JOIN users u ON c.user_id = u.id
          WHERE u.name = ? OR c.company_name = ?
          LIMIT 1
        `, [client_name, client_name]);
        
        if (existingClientByName) {
          finalClientId = existingClientByName.id;
        } else {
          // Create new client - generate client ID
          const crypto = require('crypto');
          const generateClientId = () => {
            return 'CLT-' + Date.now().toString().slice(-8) + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();
          };
          const clientId = generateClientId();
          
          // Check if user exists
          let userId = null;
          const existingUser = await db.get('SELECT id FROM users WHERE email = ?', [tempEmail]);
          
          if (!existingUser) {
            const { hashPassword } = require('../utils/auth');
            const passwordHash = await hashPassword('Client@123');
            const userResult = await db.run(
              `INSERT INTO users (email, username, password_hash, role, name, is_active, email_verified)
               VALUES (?, ?, ?, ?, ?, 1, 1)`,
              [tempEmail, tempEmail.split('@')[0], passwordHash, 'Client', client_name]
            );
            userId = userResult.lastID;
          } else {
            userId = existingUser.id;
          }
          
          // Check columns in clients table
          const clientsTableInfo = await db.all("PRAGMA table_info(clients)");
          const clientsColumnNames = clientsTableInfo.map(col => col.name);
          const hasCategory = clientsColumnNames.includes('category');
          const hasProgressStatus = clientsColumnNames.includes('progress_status');
          const hasCreatedBy = clientsColumnNames.includes('created_by');
          
          let insertColumns = ['user_id', 'client_id', 'company_name', 'status'];
          let insertValues = [userId, clientId, client_name, 'Active'];
          
          if (hasCategory) {
            insertColumns.push('category');
            insertValues.push('others');
          }
          if (hasProgressStatus) {
            insertColumns.push('progress_status');
            insertValues.push('pipeline client');
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
          
          finalClientId = clientResult.lastID;
          
          // Emit client_created event
          if (global.io) {
            global.io.emit('client_created', {
              id: finalClientId,
              client_id: clientId,
              name: client_name,
              company_name: client_name,
              email: tempEmail,
              status: 'Active',
              created_by: req.user.id,
              created_by_name: created_by_name
            });
          }
        }
      } catch (clientError) {
        console.error('Error auto-creating client from call memo:', clientError);
        // Continue without client_id if creation fails
      }
    }

    const result = await db.run(`
      INSERT INTO call_memos (
        client_id, client_name, participants, subject, call_date, discussion,
        service_needed, service_other, department_needed, next_visitation_date,
        created_by, created_by_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      finalClientId || null, client_name, participants, subject, call_date, discussion,
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


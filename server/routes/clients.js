const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, requireRole } = require('../utils/auth');
const { logAction } = require('../utils/audit');
const crypto = require('crypto');

// Generate unique client ID
function generateClientId() {
  return 'CLT-' + Date.now().toString().slice(-8) + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();
}

// Get all clients
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, service, search, category, progress_status, from_date, to_date } = req.query;
    let query = `
      SELECT c.*, u.name, u.email, u.phone, u.profile_image,
             creator.name as created_by_name, creator.email as created_by_email
      FROM clients c
      LEFT JOIN users u ON c.user_id = u.id
      LEFT JOIN users creator ON c.created_by = creator.id
      WHERE 1=1
    `;
    const params = [];

    // Role-based filtering
    if (req.user.role === 'Client') {
      query += ' AND c.user_id = ?';
      params.push(req.user.id);
    }

    if (status) {
      query += ' AND c.status = ?';
      params.push(status);
    }
    if (service) {
      query += ' AND c.services_availed LIKE ?';
      params.push(`%${service}%`);
    }
    if (category) {
      query += ' AND c.category = ?';
      params.push(category);
    }
    if (progress_status) {
      query += ' AND c.progress_status = ?';
      params.push(progress_status);
    }
    if (from_date) {
      query += ' AND DATE(c.created_at) >= ?';
      params.push(from_date);
    }
    if (to_date) {
      query += ' AND DATE(c.created_at) <= ?';
      params.push(to_date);
    }
    if (search) {
      query += ' AND (u.name LIKE ? OR u.email LIKE ? OR c.client_id LIKE ? OR c.company_name LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    query += ' ORDER BY c.created_at DESC';

    const clients = await db.all(query, params);
    res.json({ clients });
  } catch (error) {
    console.error('Get clients error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sql: query.substring(0, 200)
    });
    // Handle missing table/column gracefully
    if (error.message && (error.message.includes('no such table') || error.message.includes('no such column'))) {
      console.warn('clients table or column does not exist yet');
      return res.json({ clients: [] });
    }
    res.status(500).json({ 
      error: 'Failed to fetch clients: ' + error.message,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get single client
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const clientId = req.params.id;

    const client = await db.get(
      `SELECT c.*, u.name, u.email, u.phone, u.profile_image
       FROM clients c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.id = ? OR c.client_id = ?`,
      [clientId, clientId]
    );

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Check permissions
    if (req.user.role === 'Client' && client.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    res.json({ client });
  } catch (error) {
    console.error('Get client error:', error);
    // Handle missing table gracefully
    if (error.message && error.message.includes('no such table')) {
      console.warn('clients table does not exist yet');
      return res.status(404).json({ error: 'Client not found' });
    }
    res.status(500).json({ error: 'Failed to fetch client' });
  }
});

// Create client
router.post('/', authenticateToken, requireRole('Admin', 'Staff', 'DepartmentHead'), [
  body('name').trim().notEmpty(),
  body('email').isEmail().normalizeEmail(),
  body('services_availed').optional().isArray()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      name, email, phone, company_name, services_availed,
      loan_amount, loan_interest_rate, loan_repayment_schedule, status,
      category, progress_status
    } = req.body;

    // Check if user exists
    let userId = null;
    const existingUser = await db.get('SELECT id FROM users WHERE email = ?', [email]);
    
    if (!existingUser) {
      // Create user for client
      const { hashPassword } = require('../utils/auth');
      const passwordHash = await hashPassword('Client@123'); // Default password
      
      const userResult = await db.run(
        `INSERT INTO users (email, username, password_hash, role, name, phone, profile_image, is_active, email_verified)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1)`,
        [email, email.split('@')[0], passwordHash, 'Client', name, phone || null, req.body.profile_image || null]
      );
      userId = userResult.lastID;
    } else {
      userId = existingUser.id;
    }

    // Check if client already exists
    const existingClient = await db.get('SELECT id FROM clients WHERE user_id = ?', [userId]);
    if (existingClient) {
      return res.status(400).json({ error: 'Client with this email already exists' });
    }

    const clientId = generateClientId();

    // Check which columns exist in clients table
    const clientsTableInfo = await db.all("PRAGMA table_info(clients)");
    const clientsColumnNames = clientsTableInfo.map(col => col.name);
    const hasCategory = clientsColumnNames.includes('category');
    const hasProgressStatus = clientsColumnNames.includes('progress_status');
    const hasCreatedBy = clientsColumnNames.includes('created_by');
    
    // Build INSERT query based on available columns
    let insertColumns = ['user_id', 'client_id', 'company_name', 'services_availed', 'loan_amount',
      'loan_interest_rate', 'loan_repayment_schedule', 'status'];
    let insertValues = [
      userId, clientId, company_name || null,
      services_availed && services_availed.length > 0 ? JSON.stringify(services_availed) : null,
      loan_amount || 0, loan_interest_rate || 0,
      loan_repayment_schedule ? JSON.stringify(loan_repayment_schedule) : null,
      status || 'Active'
    ];
    
    if (hasCategory) {
      insertColumns.push('category');
      insertValues.push(category || null);
    }
    if (hasProgressStatus) {
      insertColumns.push('progress_status');
      insertValues.push(progress_status || null);
    }
    if (hasCreatedBy) {
      insertColumns.push('created_by');
      insertValues.push(req.user.id);
    }
    
    const placeholders = insertColumns.map(() => '?').join(', ');
    const result = await db.run(
      `INSERT INTO clients (${insertColumns.join(', ')})
       VALUES (${placeholders})`,
      insertValues
    );

    await logAction(req.user.id, 'create_client', 'clients', result.lastID, { clientId, email }, req);

    res.status(201).json({
      message: 'Client created successfully',
      client: { id: result.lastID, client_id: clientId }
    });
  } catch (error) {
    console.error('Create client error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sql: error.sql
    });
    
    // Handle specific database errors
    let errorMessage = 'Failed to create client';
    if (error.message && error.message.includes('FOREIGN KEY constraint')) {
      errorMessage = 'Foreign key constraint failed. Please ensure user exists.';
    } else if (error.message && error.message.includes('NOT NULL constraint')) {
      errorMessage = 'Required fields are missing.';
    } else if (error.message && error.message.includes('UNIQUE constraint')) {
      errorMessage = 'Client with this information already exists.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    res.status(500).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update client
router.put('/:id', authenticateToken, requireRole('Admin', 'Staff'), async (req, res) => {
  try {
    const clientId = req.params.id;
    const updates = req.body;

    const client = await db.get('SELECT id, user_id FROM clients WHERE id = ?', [clientId]);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Update user info if provided
    if (updates.name || updates.phone || updates.profile_image) {
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
        userParams.push(client.user_id);
        await db.run(`UPDATE users SET ${userUpdates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, userParams);
      }
    }

    // Check which columns exist in clients table
    const clientsTableInfo = await db.all("PRAGMA table_info(clients)");
    const clientsColumnNames = clientsTableInfo.map(col => col.name);
    
    const allowedFields = ['company_name', 'services_availed', 'loan_amount', 'loan_interest_rate',
      'loan_repayment_schedule', 'status', 'category', 'progress_status'];
    const updateFields = [];
    const params = [];

    allowedFields.forEach(field => {
      // Skip field if column doesn't exist
      if (!clientsColumnNames.includes(field)) {
        return;
      }
      if (updates[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        if (field === 'services_availed' || field === 'loan_repayment_schedule') {
          params.push(JSON.stringify(updates[field]));
        } else {
          params.push(updates[field]);
        }
      }
    });

    if (updateFields.length > 0) {
      params.push(clientId);
      await db.run(`UPDATE clients SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, params);
    }

    await logAction(req.user.id, 'update_client', 'clients', clientId, updates, req);

    res.json({ message: 'Client updated successfully' });
  } catch (error) {
    console.error('Update client error:', error);
    res.status(500).json({ error: 'Failed to update client' });
  }
});

// Get consultation history
router.get('/:id/consultations', authenticateToken, async (req, res) => {
  try {
    const clientId = req.params.id;

    const consultations = await db.all(
      `SELECT c.*, u.name as consultant_name
       FROM consultations c
       LEFT JOIN users u ON c.consultant_id = u.id
       WHERE c.client_id = ?
       ORDER BY c.consultation_date DESC`,
      [clientId]
    );

    res.json({ consultations });
  } catch (error) {
    console.error('Get consultations error:', error);
    res.status(500).json({ error: 'Failed to fetch consultations' });
  }
});

// Add consultation
router.post('/:id/consultations', authenticateToken, requireRole('Admin', 'Staff'), [
  body('notes').trim().notEmpty()
], async (req, res) => {
  try {
    const { notes, follow_up_date } = req.body;
    const clientId = req.params.id;

    // Get consultant ID from staff
    const staff = await db.get('SELECT id FROM staff WHERE user_id = ?', [req.user.id]);
    const consultantId = staff ? staff.id : null;

    const result = await db.run(
      `INSERT INTO consultations (client_id, consultant_id, notes, follow_up_date)
       VALUES (?, ?, ?, ?)`,
      [clientId, consultantId, notes, follow_up_date || null]
    );

    // Update consultation count
    await db.run('UPDATE clients SET total_consultations = total_consultations + 1 WHERE id = ?', [clientId]);

    await logAction(req.user.id, 'add_consultation', 'clients', clientId, {}, req);

    res.status(201).json({ message: 'Consultation added', consultationId: result.lastID });
  } catch (error) {
    console.error('Add consultation error:', error);
    res.status(500).json({ error: 'Failed to add consultation' });
  }
});

// Delete client
router.delete('/:id', authenticateToken, requireRole('Admin', 'Staff'), async (req, res) => {
  try {
    const clientId = req.params.id;

    const client = await db.get('SELECT id FROM clients WHERE id = ?', [clientId]);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    await db.run('DELETE FROM clients WHERE id = ?', [clientId]);

    await logAction(req.user.id, 'delete_client', 'clients', clientId, {}, req);

    res.json({ message: 'Client deleted successfully' });
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

module.exports = router;


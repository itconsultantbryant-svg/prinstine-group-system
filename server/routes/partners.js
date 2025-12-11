const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, requireRole } = require('../utils/auth');
const { logAction } = require('../utils/audit');
const crypto = require('crypto');

// Generate unique partner ID
function generatePartnerId() {
  return 'PTR-' + Date.now().toString().slice(-8) + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();
}

// Get all partners
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, partnership_type, search } = req.query;
    let query = `
      SELECT p.*, u.name, u.email, u.phone, u.profile_image
      FROM partners p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (req.user.role === 'Partner') {
      query += ' AND p.user_id = ?';
      params.push(req.user.id);
    }

    if (status) {
      query += ' AND p.status = ?';
      params.push(status);
    }
    if (partnership_type) {
      query += ' AND p.partnership_type = ?';
      params.push(partnership_type);
    }
    if (search) {
      query += ' AND (p.company_name LIKE ? OR p.contact_person LIKE ? OR p.partner_id LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ' ORDER BY p.created_at DESC';

    const partners = await db.all(query, params);
    res.json({ partners });
  } catch (error) {
    console.error('Get partners error:', error);
    res.status(500).json({ error: 'Failed to fetch partners' });
  }
});

// Get single partner
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const partnerId = req.params.id;

    const partner = await db.get(
      `SELECT p.*, u.name, u.email, u.phone, u.profile_image
       FROM partners p
       LEFT JOIN users u ON p.user_id = u.id
       WHERE p.id = ? OR p.partner_id = ?`,
      [partnerId, partnerId]
    );

    if (!partner) {
      return res.status(404).json({ error: 'Partner not found' });
    }

    if (req.user.role === 'Partner' && partner.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    res.json({ partner });
  } catch (error) {
    console.error('Get partner error:', error);
    res.status(500).json({ error: 'Failed to fetch partner' });
  }
});

// Create partner
router.post('/', authenticateToken, requireRole('Admin'), [
  body('company_name').trim().notEmpty(),
  body('partnership_type').isIn(['Affiliate', 'Sponsor', 'Collaborator', 'Vendor'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      company_name, contact_person, partnership_type, agreement_document,
      status, notes, email, phone, name, profile_image
    } = req.body;

    let userId = null;
    if (email) {
      const existingUser = await db.get('SELECT id FROM users WHERE email = ?', [email]);
      if (existingUser) {
        userId = existingUser.id;
        // Update user profile image if provided
        if (profile_image || name || phone) {
          const userUpdates = [];
          const userParams = [];
          if (profile_image) {
            userUpdates.push('profile_image = ?');
            userParams.push(profile_image);
          }
          if (name) {
            userUpdates.push('name = ?');
            userParams.push(name);
          }
          if (phone) {
            userUpdates.push('phone = ?');
            userParams.push(phone);
          }
          if (userUpdates.length > 0) {
            userParams.push(existingUser.id);
            await db.run(`UPDATE users SET ${userUpdates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, userParams);
          }
        }
      } else {
        // Create user for partner
        const { hashPassword } = require('../utils/auth');
        const passwordHash = await hashPassword('Partner@123'); // Default password
        
        const userResult = await db.run(
          `INSERT INTO users (email, username, password_hash, role, name, phone, profile_image, is_active, email_verified)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1)`,
          [email, email.split('@')[0], passwordHash, 'Partner', name || contact_person || company_name, phone || null, profile_image || null]
        );
        userId = userResult.lastID;
      }
    }

    const partnerId = generatePartnerId();

    const result = await db.run(
      `INSERT INTO partners (user_id, partner_id, company_name, contact_person, partnership_type,
        agreement_document, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId, partnerId, company_name, contact_person || null,
        partnership_type, agreement_document || null,
        status || 'Active', notes || null
      ]
    );

    await logAction(req.user.id, 'create_partner', 'partners', result.lastID, { partnerId }, req);

    res.status(201).json({
      message: 'Partner created successfully',
      partner: { id: result.lastID, partner_id: partnerId }
    });
  } catch (error) {
    console.error('Create partner error:', error);
    res.status(500).json({ error: 'Failed to create partner' });
  }
});

// Update partner
router.put('/:id', authenticateToken, requireRole('Admin'), async (req, res) => {
  try {
    const partnerId = req.params.id;
    const updates = req.body;

    const partner = await db.get('SELECT id, user_id FROM partners WHERE id = ?', [partnerId]);
    if (!partner) {
      return res.status(404).json({ error: 'Partner not found' });
    }

    // Update user info if provided
    if (updates.name || updates.phone || updates.profile_image) {
      if (partner.user_id) {
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
          userParams.push(partner.user_id);
          await db.run(`UPDATE users SET ${userUpdates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, userParams);
        }
      }
    }

    const allowedFields = ['company_name', 'contact_person', 'partnership_type',
      'agreement_document', 'status', 'notes'];
    const updateFields = [];
    const params = [];

    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        params.push(updates[field]);
      }
    });

    if (updateFields.length > 0) {
      params.push(partnerId);
      await db.run(`UPDATE partners SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, params);
    }

    await logAction(req.user.id, 'update_partner', 'partners', partnerId, updates, req);

    res.json({ message: 'Partner updated successfully' });
  } catch (error) {
    console.error('Update partner error:', error);
    res.status(500).json({ error: 'Failed to update partner' });
  }
});

// Delete partner
router.delete('/:id', authenticateToken, requireRole('Admin'), async (req, res) => {
  try {
    const partnerId = req.params.id;

    const partner = await db.get('SELECT id FROM partners WHERE id = ?', [partnerId]);
    if (!partner) {
      return res.status(404).json({ error: 'Partner not found' });
    }

    await db.run('DELETE FROM partners WHERE id = ?', [partnerId]);

    await logAction(req.user.id, 'delete_partner', 'partners', partnerId, {}, req);

    res.json({ message: 'Partner deleted successfully' });
  } catch (error) {
    console.error('Delete partner error:', error);
    res.status(500).json({ error: 'Failed to delete partner' });
  }
});

module.exports = router;


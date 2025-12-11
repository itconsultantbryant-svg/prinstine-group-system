const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, requireRole } = require('../utils/auth');
const { logAction } = require('../utils/audit');

// Get all marketing plans
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, search } = req.query;
    let query = `
      SELECT mp.*, u.name as created_by_name
      FROM marketing_plans mp
      LEFT JOIN users u ON mp.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ' AND mp.status = ?';
      params.push(status);
    }
    if (search) {
      query += ' AND (mp.title LIKE ? OR mp.description LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    query += ' ORDER BY mp.created_at DESC';

    const plans = await db.all(query, params);
    res.json({ plans });
  } catch (error) {
    console.error('Get marketing plans error:', error);
    res.status(500).json({ error: 'Failed to fetch marketing plans' });
  }
});

// Get single marketing plan
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const planId = req.params.id;

    const plan = await db.get(
      `SELECT mp.*, u.name as created_by_name
       FROM marketing_plans mp
       LEFT JOIN users u ON mp.created_by = u.id
       WHERE mp.id = ?`,
      [planId]
    );

    if (!plan) {
      return res.status(404).json({ error: 'Marketing plan not found' });
    }

    res.json({ plan });
  } catch (error) {
    console.error('Get marketing plan error:', error);
    res.status(500).json({ error: 'Failed to fetch marketing plan' });
  }
});

// Create marketing plan
router.post('/', authenticateToken, requireRole('Admin', 'Staff'), [
  body('title').trim().notEmpty(),
  body('goals').optional().isArray(),
  body('budget').optional().isFloat({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      title, description, goals, budget, start_date, end_date, status
    } = req.body;

    const result = await db.run(
      `INSERT INTO marketing_plans (title, description, goals, budget, start_date, end_date, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        description || null,
        goals ? JSON.stringify(goals) : null,
        budget || null,
        start_date || null,
        end_date || null,
        status || 'Draft',
        req.user.id
      ]
    );

    await logAction(req.user.id, 'create_marketing_plan', 'marketing', result.lastID, { title }, req);

    res.status(201).json({
      message: 'Marketing plan created successfully',
      plan: { id: result.lastID }
    });
  } catch (error) {
    console.error('Create marketing plan error:', error);
    res.status(500).json({ error: 'Failed to create marketing plan' });
  }
});

// Update marketing plan
router.put('/:id', authenticateToken, requireRole('Admin', 'Staff'), async (req, res) => {
  try {
    const planId = req.params.id;
    const updates = req.body;

    const plan = await db.get('SELECT created_by FROM marketing_plans WHERE id = ?', [planId]);
    if (!plan) {
      return res.status(404).json({ error: 'Marketing plan not found' });
    }

    // Check permissions
    if (req.user.role !== 'Admin' && plan.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const allowedFields = ['title', 'description', 'goals', 'budget', 'start_date', 'end_date', 'status'];
    const updateFields = [];
    const params = [];

    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        if (field === 'goals') {
          params.push(JSON.stringify(updates[field]));
        } else {
          params.push(updates[field]);
        }
      }
    });

    if (updateFields.length > 0) {
      params.push(planId);
      await db.run(`UPDATE marketing_plans SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, params);
    }

    await logAction(req.user.id, 'update_marketing_plan', 'marketing', planId, updates, req);

    res.json({ message: 'Marketing plan updated successfully' });
  } catch (error) {
    console.error('Update marketing plan error:', error);
    res.status(500).json({ error: 'Failed to update marketing plan' });
  }
});

// Delete marketing plan
router.delete('/:id', authenticateToken, requireRole('Admin', 'Staff'), async (req, res) => {
  try {
    const planId = req.params.id;

    const plan = await db.get('SELECT created_by FROM marketing_plans WHERE id = ?', [planId]);
    if (!plan) {
      return res.status(404).json({ error: 'Marketing plan not found' });
    }

    // Check permissions
    if (req.user.role !== 'Admin' && plan.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    await db.run('DELETE FROM marketing_plans WHERE id = ?', [planId]);

    await logAction(req.user.id, 'delete_marketing_plan', 'marketing', planId, {}, req);

    res.json({ message: 'Marketing plan deleted successfully' });
  } catch (error) {
    console.error('Delete marketing plan error:', error);
    res.status(500).json({ error: 'Failed to delete marketing plan' });
  }
});

module.exports = router;


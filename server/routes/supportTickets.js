const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, requireRole } = require('../utils/auth');
const { logAction } = require('../utils/audit');

// Generate ticket ID
function generateTicketId() {
  const year = new Date().getFullYear();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `ICT-${year}-${random}`;
}

// Get all tickets (with filters)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, priority, category, assigned_to, search } = req.query;
    let query = `
      SELECT st.*, 
             u1.name as reported_by_name, u1.email as reported_by_email,
             u2.name as assigned_to_name
      FROM support_tickets st
      LEFT JOIN users u1 ON st.reported_by = u1.id
      LEFT JOIN users u2 ON st.assigned_to = u2.id
      WHERE 1=1
    `;
    const params = [];

    // Role-based filtering
    if (req.user.role === 'DepartmentHead' && req.user.role !== 'Admin') {
      // Department heads can see all tickets but may filter by their department
      // For now, show all tickets
    }

    if (status) {
      query += ' AND st.status = ?';
      params.push(status);
    }
    if (priority) {
      query += ' AND st.priority = ?';
      params.push(priority);
    }
    if (category) {
      query += ' AND st.category = ?';
      params.push(category);
    }
    if (assigned_to) {
      query += ' AND st.assigned_to = ?';
      params.push(assigned_to);
    }
    if (search) {
      query += ' AND (st.ticket_id LIKE ? OR st.subject LIKE ? OR st.description LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ' ORDER BY st.date_reported DESC';

    const tickets = await db.all(query, params);
    res.json({ tickets });
  } catch (error) {
    console.error('Get tickets error:', error);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// Get single ticket
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const ticket = await db.get(
      `SELECT st.*, 
              u1.name as reported_by_name, u1.email as reported_by_email,
              u2.name as assigned_to_name
       FROM support_tickets st
       LEFT JOIN users u1 ON st.reported_by = u1.id
       LEFT JOIN users u2 ON st.assigned_to = u2.id
       WHERE st.id = ? OR st.ticket_id = ?`,
      [req.params.id, req.params.id]
    );

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json({ ticket });
  } catch (error) {
    console.error('Get ticket error:', error);
    res.status(500).json({ error: 'Failed to fetch ticket' });
  }
});

// Create ticket
router.post('/', authenticateToken, [
  body('category').isIn(['Hardware', 'Software', 'Access', 'Network', 'Website', 'LMS', 'Security', 'Other']),
  body('priority').isIn(['Low', 'Medium', 'High', 'Critical']),
  body('subject').trim().notEmpty(),
  body('description').trim().notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      category, priority, subject, description, root_cause,
      client_impact, client_impact_description,
      student_impact, student_impact_description,
      assigned_to, attachments
    } = req.body;

    const ticketId = generateTicketId();

    const result = await db.run(
      `INSERT INTO support_tickets (
        ticket_id, reported_by, reported_by_name, reported_by_email,
        category, priority, status, subject, description, root_cause,
        client_impact, client_impact_description,
        student_impact, student_impact_description,
        assigned_to, attachments
      ) VALUES (?, ?, ?, ?, ?, ?, 'New', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ticketId, req.user.id, req.user.name, req.user.email,
        category, priority, subject, description, root_cause || null,
        client_impact ? 1 : 0, client_impact_description || null,
        student_impact ? 1 : 0, student_impact_description || null,
        assigned_to || null,
        attachments ? JSON.stringify(attachments) : null
      ]
    );

    await logAction(req.user.id, 'create_ticket', 'support_tickets', result.lastID, { ticketId, subject }, req);

    res.status(201).json({
      message: 'Ticket created successfully',
      ticket: { id: result.lastID, ticket_id: ticketId }
    });
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

// Update ticket
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const ticketId = req.params.id;
    const {
      status, priority, assigned_to, subject, description, root_cause,
      client_impact, client_impact_description,
      student_impact, student_impact_description,
      attachments
    } = req.body;

    // Get current ticket
    const ticket = await db.get('SELECT * FROM support_tickets WHERE id = ? OR ticket_id = ?', [ticketId, ticketId]);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Calculate resolution time if status changed to Resolved
    let resolutionTime = ticket.resolution_time;
    let resolvedAt = ticket.resolved_at;
    let closedAt = ticket.closed_at;

    if (status === 'Resolved' && ticket.status !== 'Resolved') {
      resolvedAt = new Date().toISOString();
      const reportedDate = new Date(ticket.date_reported);
      const resolvedDate = new Date(resolvedAt);
      resolutionTime = Math.floor((resolvedDate - reportedDate) / (1000 * 60)); // minutes
    }

    if (status === 'Closed' && ticket.status !== 'Closed') {
      closedAt = new Date().toISOString();
    }

    // Check SLA compliance (4 hours = 240 minutes for High/Critical, 8 hours = 480 minutes for others)
    const slaThreshold = (priority === 'High' || priority === 'Critical') ? 240 : 480;
    const slaCompliance = resolutionTime && resolutionTime <= slaThreshold ? 1 : 0;

    await db.run(
      `UPDATE support_tickets SET
        status = COALESCE(?, status),
        priority = COALESCE(?, priority),
        assigned_to = COALESCE(?, assigned_to),
        subject = COALESCE(?, subject),
        description = COALESCE(?, description),
        root_cause = COALESCE(?, root_cause),
        client_impact = COALESCE(?, client_impact),
        client_impact_description = COALESCE(?, client_impact_description),
        student_impact = COALESCE(?, student_impact),
        student_impact_description = COALESCE(?, student_impact_description),
        attachments = COALESCE(?, attachments),
        resolution_time = ?,
        resolved_at = COALESCE(?, resolved_at),
        closed_at = COALESCE(?, closed_at),
        sla_compliance = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ? OR ticket_id = ?`,
      [
        status, priority, assigned_to, subject, description, root_cause,
        client_impact !== undefined ? (client_impact ? 1 : 0) : null,
        client_impact_description,
        student_impact !== undefined ? (student_impact ? 1 : 0) : null,
        student_impact_description,
        attachments ? JSON.stringify(attachments) : null,
        resolutionTime,
        resolvedAt,
        closedAt,
        slaCompliance,
        ticketId, ticketId
      ]
    );

    await logAction(req.user.id, 'update_ticket', 'support_tickets', ticket.id, { status, priority }, req);

    const updatedTicket = await db.get(
      `SELECT st.*, 
              u1.name as reported_by_name, u1.email as reported_by_email,
              u2.name as assigned_to_name
       FROM support_tickets st
       LEFT JOIN users u1 ON st.reported_by = u1.id
       LEFT JOIN users u2 ON st.assigned_to = u2.id
       WHERE st.id = ?`,
      [ticket.id]
    );

    res.json({
      message: 'Ticket updated successfully',
      ticket: updatedTicket
    });
  } catch (error) {
    console.error('Update ticket error:', error);
    res.status(500).json({ error: 'Failed to update ticket' });
  }
});

// Delete ticket (Admin only)
router.delete('/:id', authenticateToken, requireRole('Admin'), async (req, res) => {
  try {
    const ticketId = req.params.id;
    const ticket = await db.get('SELECT id FROM support_tickets WHERE id = ? OR ticket_id = ?', [ticketId, ticketId]);
    
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    await db.run('DELETE FROM support_tickets WHERE id = ?', [ticket.id]);
    await logAction(req.user.id, 'delete_ticket', 'support_tickets', ticket.id, {}, req);

    res.json({ message: 'Ticket deleted successfully' });
  } catch (error) {
    console.error('Delete ticket error:', error);
    res.status(500).json({ error: 'Failed to delete ticket' });
  }
});

// Get ticket statistics
router.get('/stats/summary', authenticateToken, async (req, res) => {
  try {
    const [
      total,
      newTickets,
      inProgress,
      resolved,
      closed,
      critical,
      high,
      slaCompliant
    ] = await Promise.all([
      db.get('SELECT COUNT(*) as count FROM support_tickets'),
      db.get("SELECT COUNT(*) as count FROM support_tickets WHERE status = 'New'"),
      db.get("SELECT COUNT(*) as count FROM support_tickets WHERE status = 'In Progress'"),
      db.get("SELECT COUNT(*) as count FROM support_tickets WHERE status = 'Resolved'"),
      db.get("SELECT COUNT(*) as count FROM support_tickets WHERE status = 'Closed'"),
      db.get("SELECT COUNT(*) as count FROM support_tickets WHERE priority = 'Critical'"),
      db.get("SELECT COUNT(*) as count FROM support_tickets WHERE priority = 'High'"),
      db.get("SELECT COUNT(*) as count FROM support_tickets WHERE sla_compliance = 1")
    ]);

    res.json({
      stats: {
        total: total?.count || 0,
        new: newTickets?.count || 0,
        inProgress: inProgress?.count || 0,
        resolved: resolved?.count || 0,
        closed: closed?.count || 0,
        critical: critical?.count || 0,
        high: high?.count || 0,
        slaCompliant: slaCompliant?.count || 0
      }
    });
  } catch (error) {
    console.error('Get ticket stats error:', error);
    res.status(500).json({ error: 'Failed to fetch ticket statistics' });
  }
});

module.exports = router;


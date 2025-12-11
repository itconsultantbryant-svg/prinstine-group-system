const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, requireRole } = require('../utils/auth');
const { logAction } = require('../utils/audit');
const { createNotification, sendReportNotification } = require('../utils/notifications');
const { sendReportNotification: sendEmailNotification } = require('../utils/email');

// Get all reports
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { report_type, department, status, search, category } = req.query;
    let query = `
      SELECT r.*, u1.name as submitted_by_name, u2.name as reviewed_by_name
      FROM reports r
      LEFT JOIN users u1 ON r.submitted_by = u1.id
      LEFT JOIN users u2 ON r.reviewed_by = u2.id
      WHERE 1=1
    `;
    const params = [];

    // Role-based filtering
    if (req.user.role === 'Staff') {
      query += ' AND r.submitted_by = ?';
      params.push(req.user.id);
    }

    // Category filtering
    if (category && category !== 'all') {
      switch (category) {
        case 'departments':
          query += ' AND r.department IS NOT NULL AND r.department != ""';
          break;
        case 'clients':
          query += ' AND (r.title LIKE ? OR r.content LIKE ?)';
          const clientTerm = '%client%';
          params.push(clientTerm, clientTerm);
          break;
        case 'partners':
          query += ' AND (r.title LIKE ? OR r.content LIKE ?)';
          const partnerTerm = '%partner%';
          params.push(partnerTerm, partnerTerm);
          break;
        case 'academy':
          query += ' AND (r.title LIKE ? OR r.content LIKE ? OR r.title LIKE ? OR r.content LIKE ? OR r.title LIKE ? OR r.content LIKE ?)';
          const academyTerm = '%academy%';
          const studentTerm = '%student%';
          const courseTerm = '%course%';
          params.push(academyTerm, academyTerm, studentTerm, studentTerm, courseTerm, courseTerm);
          break;
        case 'staff':
          query += ' AND (r.title LIKE ? OR r.content LIKE ?)';
          const staffTerm = '%staff%';
          params.push(staffTerm, staffTerm);
          break;
      }
    }

    if (report_type) {
      query += ' AND r.report_type = ?';
      params.push(report_type);
    }
    if (department && department !== 'all') {
      query += ' AND r.department = ?';
      params.push(department);
    }
    if (status) {
      query += ' AND r.status = ?';
      params.push(status);
    }
    if (search) {
      query += ' AND (r.title LIKE ? OR r.content LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    query += ' ORDER BY r.created_at DESC';

    const reports = await db.all(query, params);
    res.json({ reports });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// Get single report
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const reportId = req.params.id;

    const report = await db.get(
      `SELECT r.*, u1.name as submitted_by_name, u2.name as reviewed_by_name
       FROM reports r
       LEFT JOIN users u1 ON r.submitted_by = u1.id
       LEFT JOIN users u2 ON r.reviewed_by = u2.id
       WHERE r.id = ?`,
      [reportId]
    );

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Check permissions
    if (req.user.role === 'Staff' && report.submitted_by !== req.user.id) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    res.json({ report });
  } catch (error) {
    console.error('Get report error:', error);
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

// Create report
router.post('/', authenticateToken, requireRole('Admin', 'Staff'), [
  body('report_type').isIn(['Weekly', 'Bi-weekly', 'Monthly', 'Custom']),
  body('title').trim().notEmpty(),
  body('content').trim().notEmpty(),
  body('department').trim().notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      report_type, department, title, content, attachments, due_date, status
    } = req.body;

    const result = await db.run(
      `INSERT INTO reports (report_type, department, title, content, attachments, submitted_by, due_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        report_type, department, title, content,
        attachments ? JSON.stringify(attachments) : null,
        req.user.id, due_date || null, status || 'Pending'
      ]
    );

    // Notify admin
    const admins = await db.all('SELECT id, email FROM users WHERE role = ?', ['Admin']);
    for (const admin of admins) {
      await createNotification(
        admin.id,
        'New Report Submitted',
        `A new ${report_type} report has been submitted by ${req.user.name}`,
        'info',
        `/reports/${result.lastID}`
      );
    }

    await logAction(req.user.id, 'create_report', 'reports', result.lastID, { title }, req);

    res.status(201).json({
      message: 'Report submitted successfully',
      report: { id: result.lastID }
    });
  } catch (error) {
    console.error('Create report error:', error);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

// Update report
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const reportId = req.params.id;
    const updates = req.body;

    const report = await db.get('SELECT submitted_by FROM reports WHERE id = ?', [reportId]);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Check permissions
    if (req.user.role === 'Staff' && report.submitted_by !== req.user.id) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const allowedFields = ['title', 'content', 'attachments', 'due_date'];
    const updateFields = [];
    const params = [];

    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        if (field === 'attachments') {
          params.push(JSON.stringify(updates[field]));
        } else {
          params.push(updates[field]);
        }
      }
    });

    if (updateFields.length > 0) {
      params.push(reportId);
      await db.run(`UPDATE reports SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, params);
    }

    await logAction(req.user.id, 'update_report', 'reports', reportId, updates, req);

    res.json({ message: 'Report updated successfully' });
  } catch (error) {
    console.error('Update report error:', error);
    res.status(500).json({ error: 'Failed to update report' });
  }
});

// Approve/reject report (Admin only)
router.put('/:id/review', authenticateToken, requireRole('Admin'), [
  body('status').isIn(['Approved', 'Rejected']),
  body('review_comments').optional().trim()
], async (req, res) => {
  try {
    const { status, review_comments } = req.body;
    const reportId = req.params.id;

    const report = await db.get('SELECT submitted_by, title FROM reports WHERE id = ?', [reportId]);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    await db.run(
      `UPDATE reports 
       SET status = ?, reviewed_by = ?, review_comments = ?, review_date = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [status, req.user.id, review_comments || null, reportId]
    );

    // Notify submitter
    const submitter = await db.get('SELECT id, email FROM users WHERE id = ?', [report.submitted_by]);
    if (submitter) {
      await createNotification(
        submitter.id,
        `Report ${status}`,
        `Your report "${report.title}" has been ${status.toLowerCase()}`,
        status === 'Approved' ? 'success' : 'warning',
        `/reports/${reportId}`
      );

      // Send email notification
      if (submitter.email) {
        await sendEmailNotification(submitter.email, report.title, status, review_comments);
      }
    }

    await logAction(req.user.id, 'review_report', 'reports', reportId, { status }, req);

    res.json({ message: `Report ${status.toLowerCase()} successfully` });
  } catch (error) {
    console.error('Review report error:', error);
    res.status(500).json({ error: 'Failed to review report' });
  }
});

// Delete report
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const reportId = req.params.id;

    const report = await db.get('SELECT submitted_by FROM reports WHERE id = ?', [reportId]);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Only admin or submitter can delete
    if (req.user.role !== 'Admin' && report.submitted_by !== req.user.id) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    await db.run('DELETE FROM reports WHERE id = ?', [reportId]);

    await logAction(req.user.id, 'delete_report', 'reports', reportId, {}, req);

    res.json({ message: 'Report deleted successfully' });
  } catch (error) {
    console.error('Delete report error:', error);
    res.status(500).json({ error: 'Failed to delete report' });
  }
});

module.exports = router;


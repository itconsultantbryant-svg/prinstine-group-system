const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../utils/auth');
const { createBackup, restoreBackup, listBackups, cleanupBackups } = require('../utils/backup');
const { logAction } = require('../utils/audit');

// Create backup (Admin only)
router.post('/create', authenticateToken, requireRole('Admin'), async (req, res) => {
  try {
    const backupPath = await createBackup();
    
    // Cleanup old backups (keep last 10)
    cleanupBackups(10);

    await logAction(req.user.id, 'create_backup', 'system', null, { backupPath }, req);

    res.json({
      message: 'Backup created successfully',
      backupPath: backupPath
    });
  } catch (error) {
    console.error('Create backup error:', error);
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

// List backups (Admin only)
router.get('/list', authenticateToken, requireRole('Admin'), async (req, res) => {
  try {
    const backups = listBackups();
    res.json({ backups });
  } catch (error) {
    console.error('List backups error:', error);
    res.status(500).json({ error: 'Failed to list backups' });
  }
});

// Restore backup (Admin only)
router.post('/restore', authenticateToken, requireRole('Admin'), async (req, res) => {
  try {
    const { backupPath } = req.body;
    
    if (!backupPath) {
      return res.status(400).json({ error: 'Backup path is required' });
    }

    await restoreBackup(backupPath);

    await logAction(req.user.id, 'restore_backup', 'system', null, { backupPath }, req);

    res.json({ message: 'Backup restored successfully' });
  } catch (error) {
    console.error('Restore backup error:', error);
    res.status(500).json({ error: 'Failed to restore backup' });
  }
});

module.exports = router;


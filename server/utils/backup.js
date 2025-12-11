const fs = require('fs');
const path = require('path');
const db = require('../config/database');
require('dotenv').config();

/**
 * Create a backup of the database
 */
async function createBackup() {
  try {
    const dbPath = path.resolve(__dirname, process.env.DB_PATH || '../database/pms.db');
    const backupDir = path.resolve(__dirname, '../database/backups');
    
    // Ensure backup directory exists
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Create backup filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `pms-backup-${timestamp}.db`);

    // Copy database file
    fs.copyFileSync(dbPath, backupPath);

    console.log(`Database backup created: ${backupPath}`);
    return backupPath;
  } catch (error) {
    console.error('Error creating backup:', error);
    throw error;
  }
}

/**
 * Restore database from backup
 */
async function restoreBackup(backupPath) {
  try {
    const dbPath = path.resolve(__dirname, process.env.DB_PATH || '../database/pms.db');
    
    if (!fs.existsSync(backupPath)) {
      throw new Error('Backup file not found');
    }

    // Close current database connection
    await db.close();

    // Copy backup to database location
    fs.copyFileSync(backupPath, dbPath);

    // Reconnect to database
    await db.connect();

    console.log(`Database restored from: ${backupPath}`);
    return true;
  } catch (error) {
    console.error('Error restoring backup:', error);
    throw error;
  }
}

/**
 * List all available backups
 */
function listBackups() {
  try {
    const backupDir = path.resolve(__dirname, '../database/backups');
    
    if (!fs.existsSync(backupDir)) {
      return [];
    }

    const files = fs.readdirSync(backupDir)
      .filter(file => file.endsWith('.db'))
      .map(file => {
        const filePath = path.join(backupDir, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          path: filePath,
          size: stats.size,
          created: stats.birthtime
        };
      })
      .sort((a, b) => b.created - a.created); // Newest first

    return files;
  } catch (error) {
    console.error('Error listing backups:', error);
    return [];
  }
}

/**
 * Delete old backups (keep only last N backups)
 */
function cleanupBackups(keepCount = 10) {
  try {
    const backups = listBackups();
    
    if (backups.length <= keepCount) {
      return;
    }

    const toDelete = backups.slice(keepCount);
    toDelete.forEach(backup => {
      fs.unlinkSync(backup.path);
      console.log(`Deleted old backup: ${backup.filename}`);
    });
  } catch (error) {
    console.error('Error cleaning up backups:', error);
  }
}

module.exports = {
  createBackup,
  restoreBackup,
  listBackups,
  cleanupBackups
};


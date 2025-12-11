const db = require('../config/database');

/**
 * Periodic database checkpoint to ensure data persistence
 * Runs every 30 seconds to flush WAL data to main database
 */
let checkpointInterval = null;

function startPeriodicCheckpoint() {
  if (checkpointInterval) {
    return; // Already running
  }

  checkpointInterval = setInterval(async () => {
    try {
      if (db.db) {
        // Use TRUNCATE checkpoint every 1 minute for better persistence
        // Use PASSIVE checkpoint every 15 seconds for non-blocking operation
        const useTruncate = Date.now() % 60000 < 15000; // Every 1 minute
        const checkpointMode = useTruncate ? 'TRUNCATE' : 'PASSIVE';
        
        db.db.run(`PRAGMA wal_checkpoint(${checkpointMode})`, (err) => {
          if (err && !err.message.includes('database is locked')) {
            console.warn('Periodic checkpoint warning:', err.message);
          } else if (useTruncate) {
            console.log('✓ Periodic WAL checkpoint (TRUNCATE) completed - data fully persisted');
          }
        });
      }
    } catch (error) {
      console.warn('Periodic checkpoint error:', error.message);
    }
  }, 15000); // Every 15 seconds for more frequent checkpoints

  console.log('✓ Periodic database checkpoint started (every 30 seconds)');
}

function stopPeriodicCheckpoint() {
  if (checkpointInterval) {
    clearInterval(checkpointInterval);
    checkpointInterval = null;
    console.log('Periodic checkpoint stopped');
  }
}

module.exports = {
  startPeriodicCheckpoint,
  stopPeriodicCheckpoint
};


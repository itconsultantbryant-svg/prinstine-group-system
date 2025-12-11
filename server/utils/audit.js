const db = require('../config/database');

/**
 * Log an action to audit logs
 */
async function logAction(userId, action, module, recordId = null, details = null, req = null) {
  try {
    const ipAddress = req ? req.ip || req.connection.remoteAddress : null;
    const userAgent = req ? req.get('user-agent') : null;

    await db.run(
      `INSERT INTO audit_logs (user_id, action, module, record_id, details, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        action,
        module,
        recordId,
        details ? JSON.stringify(details) : null,
        ipAddress,
        userAgent
      ]
    );
  } catch (error) {
    console.error('Error logging audit action:', error);
    // Don't throw - audit logging shouldn't break the main flow
  }
}

module.exports = { logAction };


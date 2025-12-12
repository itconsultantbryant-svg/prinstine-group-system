const db = require('../config/database');

/**
 * Create a notification for a user
 */
async function createNotification(userId, title, message, type = 'info', link = null, senderId = null, parentId = null, attachments = null) {
  try {
    const attachmentsJson = attachments ? JSON.stringify(attachments) : null;
    const result = await db.run(
      `INSERT INTO notifications (user_id, sender_id, parent_id, title, message, type, link, attachments)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, senderId, parentId, title, message, type, link, attachmentsJson]
    );

    // Get the created notification with sender info
    const notification = await db.get(
      `SELECT n.*, u.name as sender_name, u.email as sender_email, u.role as sender_role
       FROM notifications n
       LEFT JOIN users u ON n.sender_id = u.id
       WHERE n.id = ?`,
      [result.lastID]
    );

    // Emit real-time notification via WebSocket
    // io is set globally in server.js
    if (global.io) {
      const notificationData = {
        id: notification.id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        link: notification.link,
        senderId: notification.sender_id,
        senderName: notification.sender_name,
        senderEmail: notification.sender_email,
        senderRole: notification.sender_role,
        parentId: notification.parent_id,
        attachments: notification.attachments ? JSON.parse(notification.attachments) : [],
        createdAt: notification.created_at
      };
      
      global.io.to(`user_${userId}`).emit('notification', notificationData);
      
      // Also emit to sender if different from recipient
      if (senderId && senderId !== userId) {
        global.io.to(`user_${senderId}`).emit('notification_sent', {
          ...notificationData,
          recipientId: userId
        });
      }
    }

    return result.lastID;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
}

/**
 * Get notifications for a user (including sender info and replies)
 */
async function getUserNotifications(userId, limit = 50, offset = 0, includeReplies = true) {
  try {
    let query = `
      SELECT n.*, 
             u.name as sender_name, u.email as sender_email, u.role as sender_role,
             (SELECT COUNT(*) FROM notifications WHERE parent_id = n.id) as reply_count
      FROM notifications n
      LEFT JOIN users u ON n.sender_id = u.id
      WHERE n.user_id = ? AND n.parent_id IS NULL
      ORDER BY n.created_at DESC 
      LIMIT ? OFFSET ?
    `;
    
    const notifications = await db.all(query, [userId, limit, offset]);
    
    // If includeReplies, fetch replies for each notification
    if (includeReplies) {
      for (const notification of notifications) {
        const replies = await db.all(
          `SELECT n.*, u.name as sender_name, u.email as sender_email, u.role as sender_role
           FROM notifications n
           LEFT JOIN users u ON n.sender_id = u.id
           WHERE n.parent_id = ?
           ORDER BY n.created_at ASC`,
          [notification.id]
        );
        notification.replies = replies.map(r => ({
          ...r,
          attachments: r.attachments ? JSON.parse(r.attachments) : []
        }));
        notification.attachments = notification.attachments ? JSON.parse(notification.attachments) : [];
      }
    } else {
      notifications.forEach(n => {
        n.attachments = n.attachments ? JSON.parse(n.attachments) : [];
      });
    }
    
    return notifications;
  } catch (error) {
    console.error('Error fetching notifications:', error);
    throw error;
  }
}

/**
 * Mark notification as read
 */
async function markAsRead(notificationId, userId) {
  try {
    await db.run(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      [notificationId, userId]
    );
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
}

/**
 * Mark all notifications as read for a user
 */
async function markAllAsRead(userId) {
  try {
    await db.run(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ?',
      [userId]
    );
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
}

/**
 * Get unread notification count
 */
async function getUnreadCount(userId) {
  try {
    const result = await db.get(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
      [userId]
    );
    return result ? result.count : 0;
  } catch (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }
}

/**
 * Send notification to multiple users (bulk)
 */
async function sendBulkNotifications(userIds, title, message, type = 'info', link = null, senderId = null, attachments = null) {
  try {
    const notificationIds = [];
    const attachmentsJson = attachments ? JSON.stringify(attachments) : null;
    
    // Get sender info
    let senderName = null, senderEmail = null;
    if (senderId) {
      const sender = await db.get('SELECT name, email FROM users WHERE id = ?', [senderId]);
      if (sender) {
        senderName = sender.name;
        senderEmail = sender.email;
      }
    }
    
    // Create notifications for all users
    for (const userId of userIds) {
      const result = await db.run(
        `INSERT INTO notifications (user_id, sender_id, title, message, type, link, attachments)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, senderId, title, message, type, link, attachmentsJson]
      );
      notificationIds.push(result.lastID);
      
      // Emit real-time notification via WebSocket
      if (global.io) {
        global.io.to(`user_${userId}`).emit('notification', {
          id: result.lastID,
          title,
          message,
          type,
          link,
          senderId,
          senderName,
          senderEmail,
          attachments: attachments || [],
          createdAt: new Date().toISOString()
        });
      }
    }
    
    return notificationIds;
  } catch (error) {
    console.error('Error sending bulk notifications:', error);
    throw error;
  }
}

/**
 * Send notification to all users with a specific role
 * Supports both old signature: sendNotificationToRole(role, title, message, type, link, senderId, attachments)
 * and new signature: sendNotificationToRole(role, { title, message, type, link, senderId, attachments })
 */
async function sendNotificationToRole(role, titleOrOptions, message, type = 'info', link = null, senderId = null, attachments = null) {
  try {
    let title, notificationMessage, notificationType, notificationLink, notificationSenderId, notificationAttachments;
    
    // Check if second parameter is an options object (new signature)
    if (typeof titleOrOptions === 'object' && titleOrOptions !== null && !Array.isArray(titleOrOptions)) {
      title = titleOrOptions.title;
      notificationMessage = titleOrOptions.message;
      notificationType = titleOrOptions.type || 'info';
      notificationLink = titleOrOptions.link || null;
      notificationSenderId = titleOrOptions.senderId || null;
      notificationAttachments = titleOrOptions.attachments || null;
    } else {
      // Old signature
      title = titleOrOptions;
      notificationMessage = message;
      notificationType = type;
      notificationLink = link;
      notificationSenderId = senderId;
      notificationAttachments = attachments;
    }
    
    // Ensure message is a string, not an object
    if (typeof notificationMessage !== 'string') {
      notificationMessage = JSON.stringify(notificationMessage);
    }
    
    // Get all users with the specified role
    const users = await db.all(
      'SELECT id FROM users WHERE role = ? AND is_active = 1',
      [role]
    );
    
    if (users.length === 0) {
      return [];
    }
    
    const userIds = users.map(u => u.id);
    return await sendBulkNotifications(userIds, title, notificationMessage, notificationType, notificationLink, notificationSenderId, notificationAttachments);
  } catch (error) {
    console.error('Error sending notification to role:', error);
    throw error;
  }
}

/**
 * Send notification to all active users
 */
async function sendNotificationToAll(title, message, type = 'info', link = null, senderId = null, attachments = null) {
  try {
    // Get all active users
    const users = await db.all(
      'SELECT id FROM users WHERE is_active = 1',
      []
    );
    
    if (users.length === 0) {
      return [];
    }
    
    const userIds = users.map(u => u.id);
    return await sendBulkNotifications(userIds, title, message, type, link, senderId, attachments);
  } catch (error) {
    console.error('Error sending notification to all:', error);
    throw error;
  }
}

/**
 * Acknowledge a notification
 */
async function acknowledgeNotification(notificationId, userId) {
  try {
    await db.run(
      'UPDATE notifications SET is_acknowledged = 1, acknowledged_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
      [notificationId, userId]
    );
    
    // Notify sender if notification has a sender
    const notification = await db.get('SELECT sender_id FROM notifications WHERE id = ?', [notificationId]);
    if (notification && notification.sender_id && global.io) {
      global.io.to(`user_${notification.sender_id}`).emit('notification_acknowledged', {
        notificationId,
        acknowledgedBy: userId,
        acknowledgedAt: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error acknowledging notification:', error);
    throw error;
  }
}

/**
 * Get notification thread (parent + all replies)
 */
async function getNotificationThread(notificationId) {
  try {
    // Get parent notification
    const parent = await db.get(
      `SELECT n.*, u1.name as sender_name, u1.email as sender_email, u2.name as recipient_name, u2.email as recipient_email
       FROM notifications n
       LEFT JOIN users u1 ON n.sender_id = u1.id
       LEFT JOIN users u2 ON n.user_id = u2.id
       WHERE n.id = ?`,
      [notificationId]
    );
    
    if (!parent) {
      return null;
    }
    
    // Get all replies
    const replies = await db.all(
      `SELECT n.*, u.name as sender_name, u.email as sender_email
       FROM notifications n
       LEFT JOIN users u ON n.sender_id = u.id
       WHERE n.parent_id = ?
       ORDER BY n.created_at ASC`,
      [notificationId]
    );
    
    return {
      ...parent,
      attachments: parent.attachments ? JSON.parse(parent.attachments) : [],
      replies: replies.map(r => ({
        ...r,
        attachments: r.attachments ? JSON.parse(r.attachments) : []
      }))
    };
  } catch (error) {
    console.error('Error fetching notification thread:', error);
    throw error;
  }
}

/**
 * Send notification to a single user (wrapper for createNotification with real-time emit)
 */
async function sendNotificationToUser(userId, notificationData) {
  try {
    const {
      title,
      message,
      type = 'info',
      link = null,
      senderId = null,
      attachments = null
    } = notificationData;

    return await createNotification(userId, title, message, type, link, senderId, null, attachments);
  } catch (error) {
    console.error('Error sending notification to user:', error);
    throw error;
  }
}

module.exports = {
  createNotification,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  sendBulkNotifications,
  sendNotificationToRole,
  sendNotificationToAll,
  sendNotificationToUser,
  acknowledgeNotification,
  getNotificationThread
};


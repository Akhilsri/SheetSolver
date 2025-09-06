const pool = require('../../config/db');

async function getNotificationsForUser(userId) {
  const sql = `
    SELECT id, title, body, is_read, created_at 
    FROM notifications 
    WHERE recipient_user_id = ? 
    ORDER BY created_at DESC
  `;
  const [notifications] = await pool.query(sql, [userId]);
  return notifications;
}

async function markNotificationAsRead(notificationId, userId) {
  // The "recipient_user_id = ?" clause is a security check to ensure
  // users can only mark their OWN notifications as read.
  const sql = 'UPDATE notifications SET is_read = TRUE WHERE id = ? AND recipient_user_id = ?';
  const [result] = await pool.query(sql, [notificationId, userId]);
  return result;
}

async function getUnreadCount(userId) {
  const sql = 'SELECT COUNT(*) as unreadCount FROM notifications WHERE recipient_user_id = ? AND is_read = FALSE';
  const [[{ unreadCount }]] = await pool.query(sql, [userId]);
  return { count: unreadCount };
}

async function markAllNotificationsAsRead(userId) {
  const sql = 'UPDATE notifications SET is_read = TRUE WHERE recipient_user_id = ? AND is_read = FALSE';
  await pool.query(sql, [userId]);
  return { message: 'All notifications marked as read.' };
}


module.exports = { getNotificationsForUser, markNotificationAsRead, getUnreadCount,markAllNotificationsAsRead };
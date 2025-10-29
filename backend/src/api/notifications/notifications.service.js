const pool = require('../../config/db');

async function getNotificationsForUser(userId, limit = 20, offset = 0) {
  const sql = `
    SELECT 
      n.id, 
      n.title, 
      n.body, 
      n.is_read, 
      n.created_at AS timestamp, 
      n.type, 
      n.related_room_id, 
      n.related_submission_id,
      r.name AS related_room_name -- Get room name for activity notifications
    FROM notifications n
    LEFT JOIN rooms r ON n.related_room_id = r.id
    WHERE n.recipient_user_id = ? 
    ORDER BY n.created_at DESC
    LIMIT ? OFFSET ?
  `;
  const [notifications] = await pool.query(sql, [userId,limit,offset]);
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
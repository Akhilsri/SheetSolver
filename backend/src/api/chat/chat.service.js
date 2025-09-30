const pool = require('../../config/db');

async function getChatHistory(roomId) {
  // This query gets the last 50 messages for a room and joins with the users
  // table to get the sender's details, formatted for react-native-gifted-chat.
  const sql = `
    SELECT 
      m.id as _id,
      m.message_text as text,
      m.created_at as createdAt,
      JSON_OBJECT(
        '_id', u.id, 
        'name', u.username,
        'avatar_url', u.avatar_url
      ) as user
    FROM chat_messages m
    JOIN users u ON m.sender_id = u.id
    WHERE m.room_id = ?
    ORDER BY m.created_at DESC
    LIMIT 50;
  `;
  const [messages] = await pool.query(sql, [roomId]);
  return messages;
}

async function getDirectMessageHistory(userId1, userId2) {
  const sql = `
    SELECT 
      dm.id as _id,
      dm.message_text as text,
      dm.created_at as createdAt,
      JSON_OBJECT('_id', u.id, 'name', u.username) as user
    FROM direct_messages dm
    JOIN users u ON dm.sender_id = u.id
    WHERE (dm.sender_id = ? AND dm.recipient_id = ?) OR (dm.sender_id = ? AND dm.recipient_id = ?)
    ORDER BY dm.created_at DESC
    LIMIT 50;
  `;
  const [messages] = await pool.query(sql, [userId1, userId2, userId2, userId1]);
  return messages;
}

async function getUnreadDirectMessageCount(userId) {
  const sql = 'SELECT COUNT(*) as unreadCount FROM direct_messages WHERE recipient_id = ? AND is_read = FALSE';
  const [[{ unreadCount }]] = await pool.query(sql, [userId]);
  return { count: unreadCount };
}

async function markDirectMessagesAsRead(currentUserId, otherUserId) {
  const sql = 'UPDATE direct_messages SET is_read = TRUE WHERE recipient_id = ? AND sender_id = ? AND is_read = FALSE';
  await pool.query(sql, [currentUserId, otherUserId]);
  return { message: 'Messages marked as read.' };
}

module.exports = { getChatHistory,getDirectMessageHistory,getUnreadDirectMessageCount,markDirectMessagesAsRead };
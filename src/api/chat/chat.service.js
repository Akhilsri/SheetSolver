const pool = require('../../config/db');

async function getChatHistory(roomId) {
  // This query gets the last 50 messages for a room and joins with the users
  // table to get the sender's details, formatted for react-native-gifted-chat.
  const sql = `
    SELECT 
      cm.id as _id,
      cm.message_text as text,
      cm.created_at as createdAt,
      JSON_OBJECT('_id', u.id, 'name', u.username) as user
    FROM chat_messages cm
    JOIN users u ON cm.sender_id = u.id
    WHERE cm.room_id = ?
    ORDER BY cm.created_at DESC
    LIMIT 50;
  `;
  const [messages] = await pool.query(sql, [roomId]);
  return messages;
}

module.exports = { getChatHistory };
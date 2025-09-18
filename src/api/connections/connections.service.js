const pool = require('../../config/db');

// Creates a new 'pending' connection request
// in connections.service.js
async function sendConnectionRequest(senderId, recipientId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // Ensure user IDs are sorted to prevent duplicate rows like (1, 2) and (2, 1)
    const [user_one_id, user_two_id] = [senderId, recipientId].sort((a, b) => a - b);

    // 1. Insert the connection request
    const sql = 'INSERT INTO connections (user_one_id, user_two_id, status, action_user_id) VALUES (?, ?, "pending", ?)';
    await connection.query(sql, [user_one_id, user_two_id, senderId]);
    
    // --- THIS IS THE NEW, FIXED LOGIC ---
    // 2. Create an in-app notification for the recipient
    const [sender] = await connection.query('SELECT username FROM users WHERE id = ?', [senderId]);
    const notificationTitle = 'New Connection Request! 👋';
    const notificationBody = `${sender[0].username} wants to connect with you.`;
    await connection.query(
      'INSERT INTO notifications (recipient_user_id, title, body, type) VALUES (?, ?, ?, ?)',
      [recipientId, notificationTitle, notificationBody, 'GENERAL'] // You can define a new 'CONNECTION' type if you wish
    );
    // ------------------------------------

    await connection.commit();
    
    // 3. Send a push notification (outside the transaction)
    try {
        const [recipient] = await pool.query('SELECT fcm_token FROM users WHERE id = ? AND fcm_token IS NOT NULL', [recipientId]);
        if (recipient.length > 0) {
            const message = {
                notification: { title: notificationTitle, body: notificationBody },
                token: recipient[0].fcm_token
            };
            await admin.messaging().send(message); // Using send for a single device is efficient
        }
    } catch(e) {
        console.error("Failed to send connection request push notification:", e);
    }

    return { message: 'Connection request sent.' };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// Gets pending requests SENT TO the current user
async function getPendingRequests(userId) {
    const sql = `
        SELECT c.id, u.username as senderName 
        FROM connections c
        JOIN users u ON c.action_user_id = u.id
        WHERE (c.user_one_id = ? OR c.user_two_id = ?) 
        AND c.status = 'pending' AND c.action_user_id != ?
    `;
    const [requests] = await pool.query(sql, [userId, userId, userId]);
    return requests;
}

// Accepts a connection request
async function acceptConnectionRequest(requestId, currentUserId) {
    const sql = `
        UPDATE connections 
        SET status = 'accepted', action_user_id = ? 
        WHERE id = ? AND (user_one_id = ? OR user_two_id = ?) AND status = 'pending'
    `;
    await pool.query(sql, [currentUserId, requestId, currentUserId, currentUserId]);
    // TODO: Notify the original sender their request was accepted
    return { message: 'Connection accepted.' };
}

// Declines or cancels a connection request by deleting it
async function declineConnectionRequest(requestId, currentUserId) {
    // Security check ensures a user can only decline requests sent to them
    const sql = `
        DELETE FROM connections 
        WHERE id = ? AND (user_one_id = ? OR user_two_id = ?) AND status = 'pending'
    `;
    await pool.query(sql, [requestId, currentUserId, currentUserId]);
    return { message: 'Connection request declined.' };
}

async function getConnectionStatus(userOneId, userTwoId) {
  // Sort the IDs to match how they are stored in the database
  const [id1, id2] = [userOneId, userTwoId].sort((a, b) => a - b);
  
  const sql = 'SELECT status, action_user_id FROM connections WHERE user_one_id = ? AND user_two_id = ?';
  const [results] = await pool.query(sql, [id1, id2]);

  if (results.length === 0) {
    return { status: 'not_connected' };
  }
  // Also return who made the last action, so a pending request can be cancelled
  return { status: results[0].status, action_user_id: results[0].action_user_id };
}

async function getConnections(userId) {
  const sql = `
    SELECT 
      CASE
        WHEN c.user_one_id = ? THEN u2.id
        ELSE u1.id
      END as friend_id,
      CASE
        WHEN c.user_one_id = ? THEN u2.username
        ELSE u1.username
      END as friend_username,
      CASE
        WHEN c.user_one_id = ? THEN u2.avatar_url
        ELSE u1.avatar_url
      END as friend_avatar_url,
      (SELECT COUNT(*) FROM direct_messages WHERE sender_id = (CASE WHEN c.user_one_id = ? THEN u2.id ELSE u1.id END) AND recipient_id = ? AND is_read = FALSE) as unread_messages,
      (SELECT message_text FROM direct_messages WHERE (sender_id = c.user_one_id AND recipient_id = c.user_two_id) OR (sender_id = c.user_two_id AND recipient_id = c.user_one_id) ORDER BY created_at DESC LIMIT 1) as last_message
    FROM connections c
    JOIN users u1 ON c.user_one_id = u1.id
    JOIN users u2 ON c.user_two_id = u2.id
    WHERE (c.user_one_id = ? OR c.user_two_id = ?) AND c.status = 'accepted'
  `;
  const [connections] = await pool.query(sql, [userId, userId, userId, userId, userId, userId, userId]);

  // --- ADD THIS CONSOLE.LOG ---
  // console.log('Connections API Response:', connections); 
  // ----------------------------

  return connections;
}

async function removeConnection(userId1, userId2) {
  // Sort IDs to match how they are stored in the database
  const [user_one_id, user_two_id] = [userId1, userId2].sort((a, b) => a - b);

  const sql = "DELETE FROM connections WHERE user_one_id = ? AND user_two_id = ? AND status = 'accepted'";
  const [result] = await pool.query(sql, [user_one_id, user_two_id]);
  return result;
}

module.exports = { sendConnectionRequest, getPendingRequests, acceptConnectionRequest, declineConnectionRequest,getConnectionStatus,getConnections,removeConnection };
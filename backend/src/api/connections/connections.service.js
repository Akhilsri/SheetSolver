const pool = require('../../config/db');
const { sendNotificationToUser } = require('../utils/socket-utils.js');
const admin = require('firebase-admin'); // Assuming 'admin' is globally available or imported elsewhere

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
    
    // 2. Create an in-app notification for the recipient
    const [sender] = await connection.query('SELECT username FROM users WHERE id = ?', [senderId]);
    const notificationTitle = 'New Connection Request! 👋';
    const notificationBody = `${sender[0].username} wants to connect with you.`;
    await connection.query(
      'INSERT INTO notifications (recipient_user_id, title, body, type) VALUES (?, ?, ?, ?)',
      [recipientId, notificationTitle, notificationBody, 'GENERAL']
    );
    
    await connection.commit();

    // 👇 NEW: INSTANTLY NOTIFY THE RECIPIENT VIA SOCKET
    // This ensures the red dot appears immediately on their screen.
    sendNotificationToUser(recipientId);
    
    // 3. Send a push notification (outside the transaction)
    try {
        const [recipient] = await pool.query('SELECT fcm_token FROM users WHERE id = ? AND fcm_token IS NOT NULL', [recipientId]);
        if (recipient.length > 0) {
            const message = {
                notification: { title: notificationTitle, body: notificationBody },
                token: recipient[0].fcm_token
            };
            await admin.messaging().send(message); 
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
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Retrieve the request to get the original sender ID (action_user_id)
        // This query also verifies that the request exists and is still pending.
        const [requests] = await connection.query(
            'SELECT user_one_id, user_two_id, action_user_id FROM connections WHERE id = ? AND (user_one_id = ? OR user_two_id = ?) AND status = "pending"', 
            [requestId, currentUserId, currentUserId]
        );

        if (requests.length === 0) {
             await connection.rollback();
             // Throwing an error ensures the controller returns a 404/409
             throw new Error('CONNECTION_REQUEST_NOT_FOUND');
        }
        
        const request = requests[0];
        // The sender is the user who initiated the request. We need to notify them.
        const senderId = request.action_user_id; 

        // 2. Update the request status to 'accepted'
        // This is the core fix to ensure the status changes and connection is established.
        const [updateResult] = await connection.query(
            `UPDATE connections 
             SET status = 'accepted', action_user_id = ? 
             WHERE id = ? AND (user_one_id = ? OR user_two_id = ?) AND status = 'pending'`, 
            [currentUserId, requestId, currentUserId, currentUserId]
        );
        
        if (updateResult.affectedRows === 0) {
            await connection.rollback();
            throw new Error('CONNECTION_UPDATE_FAILED');
        }

        // 3. Create an in-app notification for the original sender (connection accepted)
        const [acceptor] = await connection.query('SELECT username FROM users WHERE id = ?', [currentUserId]);
        const notificationTitle = 'Connection Accepted! 🎉';
        const notificationBody = `${acceptor[0].username} is now connected with you.`;
        
        await connection.query(
            'INSERT INTO notifications (recipient_user_id, title, body, type) VALUES (?, ?, ?, ?)',
            [senderId, notificationTitle, notificationBody, 'GENERAL']
        );

        await connection.commit();

        // 4. INSTANTLY NOTIFY THE ORIGINAL SENDER VIA SOCKET
        // This makes the 'Request Sent' button on their profile instantly change to 'Connected'
        sendNotificationToUser(senderId);

        return { message: 'Connection accepted.', accepted: true };

    } catch (error) {
        await connection.rollback();
        // Log the error so you can see why the transaction failed
        console.error('Error accepting connection (rolled back):', error.message);
        throw error;
    } finally {
        connection.release();
    }
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
    const connection = await pool.getConnection(); // Get a connection for transaction

    try {
        await connection.beginTransaction(); // Start a transaction

        // Sort IDs to match how they are stored in the database for 'connections' table
        const [user_one_id, user_two_id] = [userId1, userId2].sort((a, b) => a - b);

        // 1. Delete the connection record
        const deleteConnectionSql = "DELETE FROM connections WHERE user_one_id = ? AND user_two_id = ? AND status = 'accepted'";
        const [connectionResult] = await connection.query(deleteConnectionSql, [user_one_id, user_two_id]);

        // --- FIX: Corrected column name from 'receiver_id' to 'recipient_id' ---
        const deleteDirectMessagesSql = `
            DELETE FROM direct_messages
            WHERE (sender_id = ? AND recipient_id = ?)
               OR (sender_id = ? AND recipient_id = ?)
        `;
        const [messageResult] = await connection.query(deleteDirectMessagesSql, [userId1, userId2, userId2, userId1]);

        // Optional: 3. Delete any related notifications about messages (as discussed previously)
        // If your notifications 'type' includes 'MESSAGE' and has 'related_user_id' for the other party:
        // const deleteMessageNotificationsSql = `
        //     DELETE FROM notifications
        //     WHERE (recipient_user_id = ? AND related_user_id = ? AND type = 'MESSAGE')
        //        OR (recipient_user_id = ? AND related_user_id = ? AND type = 'MESSAGE')
        // `;
        // const [notificationResult] = await connection.query(deleteMessageNotificationsSql, [userId1, userId2, userId2, userId1]);


        await connection.commit(); // Commit the transaction if all operations are successful
        connection.release(); // Release the connection back to the pool

        console.log(`Connection between ${userId1} and ${userId2} removed.`);
        console.log(`${connectionResult.affectedRows} connection rows deleted.`);
        console.log(`${messageResult.affectedRows} direct_messages rows deleted.`);
        // if (notificationResult) console.log(`${notificationResult.affectedRows} message notification rows deleted.`);


        return {
            connectionRemoved: connectionResult.affectedRows > 0,
            messagesRemoved: messageResult.affectedRows > 0,
            // notificationsRemoved: notificationResult ? notificationResult.affectedRows > 0 : false,
            success: true,
            message: 'Connection and associated data removed successfully.'
        };

    } catch (error) {
        // Rollback the transaction if any error occurs
        if (connection) {
            await connection.rollback();
            connection.release();
        }
        console.error("Error removing connection and direct messages:", error);
        throw error; // Re-throw the error for upstream error handling
    }
}

module.exports = { sendConnectionRequest, getPendingRequests, acceptConnectionRequest, declineConnectionRequest,getConnectionStatus,getConnections,removeConnection };
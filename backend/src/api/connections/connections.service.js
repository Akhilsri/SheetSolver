const pool = require('../../config/db');
const { sendNotificationToUser } = require('../utils/socket-utils.js');
const admin = require('firebase-admin');

async function sendConnectionRequest(senderId, recipientId) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        
        const [user_one_id, user_two_id] = [senderId, recipientId].sort((a, b) => a - b);

        const sql = 'INSERT INTO connections (user_one_id, user_two_id, status, action_user_id) VALUES (?, ?, "pending", ?)';
        await connection.query(sql, [user_one_id, user_two_id, senderId]);
        
        const [sender] = await connection.query('SELECT username FROM users WHERE id = ?', [senderId]);
        const notificationTitle = 'New Connection Request! 👋';
        const notificationBody = `${sender[0].username} wants to connect with you.`;
        await connection.query(
            'INSERT INTO notifications (recipient_user_id, title, body, type) VALUES (?, ?, ?, ?)',
            [recipientId, notificationTitle, notificationBody, 'GENERAL']
        );
        
        await connection.commit();

        sendNotificationToUser(recipientId);
        
        try {
            console.log(`Sending connection request from ${senderId} to recipient ${recipientId}`);
            // Fetch recipient ID along with token to ensure we have it for cleanup
            const [recipientRows] = await pool.query('SELECT id, fcm_token FROM users WHERE id = ? AND fcm_token IS NOT NULL', [recipientId]);

            console.log(`Query for recipient ${recipientId} FCM token returned:`, recipientRows);
            // This console.log will now ONLY appear if recipientRows.length is 0
            if (recipientRows.length === 0) {
                 console.log('no add connection via fcm'); 
                 console.log(`Recipient ${recipientId} does not have a valid FCM token.`);
            }

            if (recipientRows.length > 0) {
                const recipientUser = recipientRows[0]; // Get the whole user object
                console.log('Attempting to send add connection via fcm');
                console.log(`FCM Token for recipient ${recipientUser.id}:`, recipientUser.fcm_token);

                const message = {
                    notification: { title: notificationTitle, body: notificationBody },
                    token: recipientUser.fcm_token,
                    data: { // Add data payload for better client-side handling
                        type: 'connection_request',
                        senderId: String(senderId), // Stringify numerical IDs for data payload
                        recipientId: String(recipientUser.id),
                        title: notificationTitle,
                        body: notificationBody,
                    },
                };

                try {
                    await admin.messaging().send(message);
                    console.log(`Successfully sent connection request push notification to ${recipientUser.id}`);
                } catch (sendError) {
                    console.error("Failed to send connection request push notification:", sendError);
                    // Handle specific FCM errors for token cleanup
                    if (sendError.code === 'messaging/registration-token-not-registered' ||
                        (sendError.errorInfo && sendError.errorInfo.code === 'messaging/registration-token-not-registered')) { // Added robust check for errorInfo
                        
                        console.log(`Cleaning up invalid FCM token for user ${recipientUser.id} from connection service.`);
                        // Use pool directly as connection is already released
                        await pool.query('UPDATE users SET fcm_token = NULL WHERE id = ?', [recipientUser.id]);
                    }
                    // Re-throw if it's another critical error (not token related)
                    if (sendError.code !== 'messaging/registration-token-not-registered' && 
                        (!sendError.errorInfo || sendError.errorInfo.code !== 'messaging/registration-token-not-registered')) {
                        throw sendError; 
                    }
                }
            } 
        } catch(e) { // This catch now primarily for initial query or unexpected errors
            console.error("Failed to send connection request push notification (outer catch):", e);
        }

        return { message: 'Connection request sent.' };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

// ... (rest of connections.service.js remains the same) ...
async function getPendingRequests(userId) {
  const sql = `
    SELECT 
      c.id, 
      c.created_at AS timestamp, -- ✅ ADDED: timestamp for connection requests
      u.username as senderName 
    FROM connections c
    JOIN users u ON c.action_user_id = u.id
    WHERE (c.user_one_id = ? OR c.user_two_id = ?) 
    AND c.status = 'pending' AND c.action_user_id != ?
    ORDER BY c.created_at DESC -- ✅ Good practice to order by time
  `;
  const [requests] = await pool.query(sql, [userId, userId, userId]);
  return requests;
}


// Accepts a connection request
async function acceptConnectionRequest(requestId, currentUserId) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [requests] = await connection.query(
            'SELECT user_one_id, user_two_id, action_user_id FROM connections WHERE id = ? AND (user_one_id = ? OR user_two_id = ?) AND status = "pending"', 
            [requestId, currentUserId, currentUserId]
        );

        if (requests.length === 0) {
            await connection.rollback();
            throw new Error('CONNECTION_REQUEST_NOT_FOUND');
        }
        
        const request = requests[0];
        const senderId = request.action_user_id; 

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

        const [acceptor] = await connection.query('SELECT username FROM users WHERE id = ?', [currentUserId]);
        const notificationTitle = 'Connection Accepted! 🎉';
        const notificationBody = `${acceptor[0].username} is now connected with you.`;
        
        await connection.query(
            'INSERT INTO notifications (recipient_user_id, title, body, type) VALUES (?, ?, ?, ?)',
            [senderId, notificationTitle, notificationBody, 'GENERAL']
        );

        await connection.commit();

        sendNotificationToUser(senderId);

        return { message: 'Connection accepted.', accepted: true };

    } catch (error) {
        await connection.rollback();
        console.error('Error accepting connection (rolled back):', error.message);
        throw error;
    } finally {
        connection.release();
    }
}

async function declineConnectionRequest(requestId, currentUserId) {
    const sql = `
        DELETE FROM connections 
        WHERE id = ? AND (user_one_id = ? OR user_two_id = ?) AND status = 'pending'
    `;
    await pool.query(sql, [requestId, currentUserId, currentUserId]);
    return { message: 'Connection request declined.' };
}

async function getConnectionStatus(userOneId, userTwoId) {
    const [id1, id2] = [userOneId, userTwoId].sort((a, b) => a - b);
    
    const sql = 'SELECT status, action_user_id FROM connections WHERE user_one_id = ? AND user_two_id = ?';
    const [results] = await pool.query(sql, [id1, id2]);

    if (results.length === 0) {
        return { status: 'not_connected' };
    }
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
    return connections;
}

async function removeConnection(userId1, userId2) {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const [user_one_id, user_two_id] = [userId1, userId2].sort((a, b) => a - b);

        const deleteConnectionSql = "DELETE FROM connections WHERE user_one_id = ? AND user_two_id = ? AND status = 'accepted'";
        const [connectionResult] = await connection.query(deleteConnectionSql, [user_one_id, user_two_id]);

        const deleteDirectMessagesSql = `
            DELETE FROM direct_messages
            WHERE (sender_id = ? AND recipient_id = ?)
               OR (sender_id = ? AND recipient_id = ?)
        `;
        const [messageResult] = await connection.query(deleteDirectMessagesSql, [userId1, userId2, userId2, userId1]);

        await connection.commit();
        connection.release();

        // console.log(`Connection between ${userId1} and ${userId2} removed.`);
        // console.log(`${connectionResult.affectedRows} connection rows deleted.`);
        // console.log(`${messageResult.affectedRows} direct_messages rows deleted.`);

        return {
            connectionRemoved: connectionResult.affectedRows > 0,
            messagesRemoved: messageResult.affectedRows > 0,
            success: true,
            message: 'Connection and associated data removed successfully.'
        };

    } catch (error) {
        if (connection) {
            await connection.rollback();
            connection.release();
        }
        console.error("Error removing connection and direct messages:", error);
        throw error;
    }
}

module.exports = { sendConnectionRequest, getPendingRequests, acceptConnectionRequest, declineConnectionRequest,getConnectionStatus,getConnections,removeConnection };
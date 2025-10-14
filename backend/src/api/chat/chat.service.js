const pool = require('../../config/db');

/**
 * Fetches paginated chat history for a room.
 * @param {number} roomId - The ID of the room.
 * @param {number} limit - The maximum number of messages to return.
 * @param {string | null} beforeId - The ID of the oldest message currently on the client (cursor).
 * @returns {{messages: Array, hasMore: boolean}}
 */
async function getChatHistory(roomId, limit = 50, beforeId = null) {
    let baseSql = `
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
    `;
    const params = [roomId];

    if (beforeId) {
        // Use the timestamp of the oldest message as the cursor
        const [oldestMessageResult] = await pool.query('SELECT created_at FROM chat_messages WHERE id = ? AND room_id = ?', [beforeId, roomId]);
        
        if (oldestMessageResult.length > 0) {
            const oldestTimestamp = oldestMessageResult[0].created_at;
            baseSql += ` AND m.created_at < ? `;
            params.push(oldestTimestamp);
        }
    }

    baseSql += `
        ORDER BY m.created_at DESC
        LIMIT ?
    `;
    // We fetch one more than the limit to determine the 'hasMore' status efficiently.
    params.push(limit + 1); 

    const [rawMessages] = await pool.query(baseSql, params);
    
    const messages = rawMessages.slice(0, limit);
    const hasMore = rawMessages.length > limit;

    return { messages, hasMore };
}


/**
 * Fetches paginated direct message history between two users.
 * @param {number} currentUserId - The ID of the logged-in user.
 * @param {number} otherUserId - The ID of the conversation partner.
 * @param {number} limit - The maximum number of messages to return.
 * @param {string | null} beforeId - The ID of the oldest message (cursor).
 * @returns {{messages: Array, hasMore: boolean}}
 */
async function getDirectMessageHistory(currentUserId, otherUserId, limit = 50, beforeId = null) {
    let baseSql = `
        SELECT 
            dm.id as _id,
            dm.message_text as text,
            dm.created_at as createdAt,
            JSON_OBJECT('_id', u.id, 'name', u.username) as user
        FROM direct_messages dm
        JOIN users u ON dm.sender_id = u.id
        WHERE (
            (dm.sender_id = ? AND dm.recipient_id = ?) OR 
            (dm.sender_id = ? AND dm.recipient_id = ?)
        )
    `;
    const params = [currentUserId, otherUserId, otherUserId, currentUserId];

    if (beforeId) {
        // Use the timestamp of the oldest message as the cursor
        const [oldestMessageResult] = await pool.query('SELECT created_at FROM direct_messages WHERE id = ?', [beforeId]);
        
        if (oldestMessageResult.length > 0) {
            const oldestTimestamp = oldestMessageResult[0].created_at;
            baseSql += ` AND dm.created_at < ? `;
            params.push(oldestTimestamp);
        }
    }

    baseSql += `
        ORDER BY dm.created_at DESC
        LIMIT ?
    `;
    params.push(limit + 1); 

    const [rawMessages] = await pool.query(baseSql, params);
    
    const messages = rawMessages.slice(0, limit);
    const hasMore = rawMessages.length > limit;

    return { messages, hasMore };
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

module.exports = { getChatHistory, getDirectMessageHistory, getUnreadDirectMessageCount, markDirectMessagesAsRead };

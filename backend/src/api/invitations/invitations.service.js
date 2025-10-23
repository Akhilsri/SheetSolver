const pool = require('../../config/db');
const admin = require('firebase-admin');

// Assuming the socket utility is imported here
const { sendNotificationToUser } = require('../utils/socket-utils'); 

async function createInvitation(senderId, recipientId, roomId) {
  const [sender] = await pool.query('SELECT username FROM users WHERE id = ?', [senderId]);
  const [room] = await pool.query('SELECT name FROM rooms WHERE id = ?', [roomId]);

  const notificationTitle = 'New Room Invitation! 📬';
  const notificationBody = `${sender[0].username} has invited you to join the room "${room[0].name}".`;

  // Use a transaction to ensure both the invitation and notification are created
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 🌟 CRITICAL FIX: Delete any previously DECLINED invitation for this recipient/room pair.
    // This frees the unique key for a new 'pending' invite, allowing resend flow.
    const deleteDeclinedSql = 'DELETE FROM room_invitations WHERE recipient_id = ? AND room_id = ? AND status = "declined"';
    await connection.query(deleteDeclinedSql, [recipientId, roomId]);

    // 🌟 Ensure old 'accepted' invites are treated as non-existent to allow a new one.
    // If the user has left, the record should have been deleted by rooms.service.leaveRoom.
    // However, if a user tries to invite another who hasn't accepted yet, we check if a 'pending' one exists:
    const [existingPending] = await connection.query(
        'SELECT id FROM room_invitations WHERE recipient_id = ? AND room_id = ? AND status = "pending"',
        [recipientId, roomId]
    );
    if (existingPending.length > 0) {
        throw new Error('An invitation to this room already exists for this user.');
    }
    
    // FIX: Added status='pending' to the INSERT to ensure correct state tracking
    const sql = 'INSERT INTO room_invitations (sender_id, recipient_id, room_id, status) VALUES (?, ?, ?, "pending")';
    const [result] = await connection.query(sql, [senderId, recipientId, roomId]);
    
    await connection.query(
    'INSERT INTO notifications (recipient_user_id, title, body, type, related_room_id) VALUES (?, ?, ?, ?, ?)',
    [recipientId, notificationTitle, notificationBody, 'INVITATION', roomId]
  );

    await connection.commit();
    
    sendNotificationToUser(recipientId);

    // 🚀 NEW: Send a push notification (outside the transaction)
    try {
        const [recipient] = await pool.query('SELECT fcm_token FROM users WHERE id = ? AND fcm_token IS NOT NULL', [recipientId]);
        if (recipient.length > 0) {
            const message = {
                notification: { title: notificationTitle, body: notificationBody },
                token: recipient[0].fcm_token
            };
            // Assuming 'admin' is a globally available Firebase Admin object
            await admin.messaging().send(message); 
            console.log('Successfully send the invite via push notification');
            
        }
    } catch(e) {
        console.error("Failed to send room invitation push notification:", e);
    }
    
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getPendingInvitations(recipientId) {
  // PERMANENT FIX: Rewritten as a clean, single-line SQL string.
  // ✅ ADDED: inv.created_at AS timestamp
  const sql = 'SELECT inv.id, inv.status, inv.created_at AS timestamp, sender.username AS senderName, room.name AS roomName, room.id AS roomId FROM room_invitations inv JOIN users sender ON inv.sender_id = sender.id JOIN rooms room ON inv.room_id = room.id WHERE inv.recipient_id = ? AND inv.status = "pending" ORDER BY inv.created_at DESC';

  const [invitations] = await pool.query(sql, [recipientId]);
  return invitations;
}

async function acceptInvitation(invitationId, recipientId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [invitations] = await connection.query('SELECT * FROM room_invitations WHERE id = ? AND recipient_id = ?', [invitationId, recipientId]);
    if (invitations.length === 0) {
      throw new Error('INVITATION_NOT_FOUND');
    }
    const invitation = invitations[0];
    
    // Mark status as accepted (should be deleted when user leaves)
    await connection.query('UPDATE room_invitations SET status = ? WHERE id = ?', ['accepted', invitationId]);
    await connection.query('INSERT INTO room_members (room_id, user_id) VALUES (?, ?)', [invitation.room_id, recipientId]);

    await connection.commit();
    return { message: 'Invitation accepted.' };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function declineInvitation(invitationId, recipientId) {
  const sql = 'UPDATE room_invitations SET status = ? WHERE id = ? AND recipient_id = ?';
  await pool.query(sql, ['declined', invitationId, recipientId]);
  return { message: 'Invitation declined.' };
}

async function getSentInviteStatus(senderId, recipientId) {
  // Fetches all invitation statuses (pending, accepted, declined) between the two users
  const sql = 'SELECT room_id, status FROM room_invitations WHERE sender_id = ? AND recipient_id = ?';
  const [invitations] = await pool.query(sql, [senderId, recipientId]);
  // Return a map { 'roomId': 'status' } for easy frontend lookup
  return invitations.reduce((acc, inv) => {
    acc[inv.room_id] = inv.status;
    return acc;
  }, {});
}

module.exports = { createInvitation, getPendingInvitations, acceptInvitation, declineInvitation, getSentInviteStatus };
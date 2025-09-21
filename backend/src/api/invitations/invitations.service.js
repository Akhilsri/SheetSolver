const pool = require('../../config/db');

async function createInvitation(senderId, recipientId, roomId) {
  const [sender] = await pool.query('SELECT username FROM users WHERE id = ?', [senderId]);
  const [room] = await pool.query('SELECT name FROM rooms WHERE id = ?', [roomId]);

  const notificationTitle = 'New Room Invitation! 📬';
  const notificationBody = `${sender[0].username} has invited you to join the room "${room[0].name}".`;

  // Use a transaction to ensure both the invitation and notification are created
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const sql = 'INSERT INTO room_invitations (sender_id, recipient_id, room_id) VALUES (?, ?, ?)';
    const [result] = await connection.query(sql, [senderId, recipientId, roomId]);
    
    await pool.query(
    'INSERT INTO notifications (recipient_user_id, title, body, type, related_room_id) VALUES (?, ?, ?, ?, ?)',
    [recipientId, notificationTitle, notificationBody, 'INVITATION', roomId]
  );

    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getPendingInvitations(recipientId) {
  const sql = `
    SELECT
        inv.id, inv.status,
        sender.username as senderName,
        room.name as roomName,
        room.id as roomId
    FROM room_invitations inv
    JOIN users sender ON inv.sender_id = sender.id
    JOIN rooms room ON inv.room_id = room.id
    WHERE inv.recipient_id = ? AND inv.status = 'pending'
    ORDER BY inv.created_at DESC;
  `;
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

async function getSentPendingInvites(senderId, recipientId) {
  const sql = 'SELECT room_id FROM room_invitations WHERE sender_id = ? AND recipient_id = ? AND status = "pending"';
  const [invitations] = await pool.query(sql, [senderId, recipientId]);
  // Return just an array of room IDs
  return invitations.map(inv => inv.room_id);
}

module.exports = { createInvitation, getPendingInvitations, acceptInvitation, declineInvitation,getSentPendingInvites };
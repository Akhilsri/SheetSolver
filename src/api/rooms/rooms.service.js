const pool = require('../../config/db');
const { customAlphabet } = require('nanoid');

// Helper to generate a unique 6-character invite code
const generateInviteCode = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 6);

async function createRoom(name, adminId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const inviteCode = generateInviteCode();
    const [roomResult] = await connection.query(
      'INSERT INTO rooms (name, admin_id, invite_code) VALUES (?, ?, ?)',
      [name, adminId, inviteCode]
    );
    const newRoomId = roomResult.insertId;
    await connection.query(
      'INSERT INTO room_members (room_id, user_id) VALUES (?, ?)',
      [newRoomId, adminId]
    );
    await connection.commit();
    return { id: newRoomId, name, invite_code: inviteCode };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getRoomsForUser(userId) {
  const sql = `
    SELECT r.id, r.name, r.invite_code, r.created_at
    FROM rooms r
    JOIN room_members rm ON r.id = rm.room_id
    WHERE rm.user_id = ?
    ORDER BY r.created_at DESC;
  `;
  const [rooms] = await pool.query(sql, [userId]);
  return rooms;
}

async function joinRoomByInviteCode(inviteCode, userId) {
  const connection = await pool.getConnection();
  try {
    const [rooms] = await connection.query('SELECT id FROM rooms WHERE invite_code = ?', [inviteCode]);
    if (rooms.length === 0) {
      throw new Error('ROOM_NOT_FOUND');
    }
    const roomId = rooms[0].id;
    await connection.query('INSERT INTO room_members (room_id, user_id) VALUES (?, ?)', [roomId, userId]);
    return { message: 'Successfully joined room.' };
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw new Error('ALREADY_IN_ROOM');
    }
    throw error;
  } finally {
    connection.release();
  }
}

async function getRoomMembers(roomId) {
  const sql = `
    SELECT u.id, u.username
    FROM users u
    JOIN room_members rm ON u.id = rm.user_id
    WHERE rm.room_id = ?
  `;
  const [members] = await pool.query(sql, [roomId]);
  return members;
}

async function getRoomById(roomId) {
  const [rows] = await pool.query('SELECT * FROM rooms WHERE id = ?', [roomId]);
  return rows[0];
}

async function startJourney(roomId, sheetId, durationInDays) {
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(startDate.getDate() + parseInt(durationInDays, 10));

  const sql = 'UPDATE rooms SET sheet_id = ?, start_date = ?, end_date = ?, status = ? WHERE id = ?';
  await pool.query(sql, [sheetId, startDate, endDate, 'active', roomId]);
  
  return { message: 'Journey started successfully!' };
}

async function getDailyProblems(roomId) {
  const [rooms] = await pool.query('SELECT * FROM rooms WHERE id = ?', [roomId]);
  if (rooms.length === 0 || rooms[0].status !== 'active') {
    return [];
  }
  const room = rooms[0];

  const [[{ total_problems }]] = await pool.query('SELECT COUNT(*) as total_problems FROM problems WHERE sheet_id = ?', [room.sheet_id]);

  const totalDuration = (new Date(room.end_date) - new Date(room.start_date)) / (1000 * 60 * 60 * 24) + 1;
  const problemsPerDay = Math.ceil(total_problems / totalDuration);
  
  const today = new Date();
  const daysSinceStart = Math.floor((today - new Date(room.start_date)) / (1000 * 60 * 60 * 24));
  
  if (daysSinceStart < 0 || today > new Date(room.end_date)) {
    return []; 
  }

  const offset = daysSinceStart * problemsPerDay;

  const sql = 'SELECT * FROM problems WHERE sheet_id = ? ORDER BY problem_order LIMIT ? OFFSET ?';
  const [problems] = await pool.query(sql, [room.sheet_id, problemsPerDay, offset]);

  return problems;
}

async function getLeaderboard(roomId) {
  const sql = `
    SELECT
        u.id as userId,
        u.username,
        u.current_streak as currentStreak, -- <-- Add this line
        COALESCE(SUM(s.points_awarded), 0) as totalScore
    FROM
        room_members rm
    JOIN
        users u ON rm.user_id = u.id
    LEFT JOIN
        submissions s ON rm.user_id = s.user_id AND rm.room_id = s.room_id
    WHERE
        rm.room_id = ?
    GROUP BY
        u.id, u.username
    ORDER BY
        totalScore DESC, u.username ASC;
  `;
  const [leaderboard] = await pool.query(sql, [roomId]);
  return leaderboard;
}

async function getFullSheetForUser(roomId, userId) {
  // First, get the sheet_id for the given room.
  const [rooms] = await pool.query('SELECT sheet_id FROM rooms WHERE id = ?', [roomId]);
  if (rooms.length === 0 || !rooms[0].sheet_id) {
    throw new Error('Room has not started or sheet not selected.');
  }
  const sheetId = rooms[0].sheet_id;

  // This powerful query does two things:
  // 1. It gets ALL problems for the given sheet.
  // 2. It LEFT JOINs the submissions table for the CURRENT USER ONLY.
  //    - If a user has a submission, `submissionId` will be a number.
  //    - If a user has NOT submitted, `submissionId` will be NULL.
  const sql = `
    SELECT
        p.id, p.title, p.topic, p.url, p.difficulty, p.problem_order,
        s.id as submissionId
    FROM
        problems p
    LEFT JOIN
        submissions s ON p.id = s.problem_id AND s.user_id = ? AND s.room_id = ?
    WHERE
        p.sheet_id = ?
    ORDER BY
        p.problem_order ASC;
  `;

  const [problems] = await pool.query(sql, [userId, roomId, sheetId]);
  return problems;
}

async function removeMember(roomId, memberIdToRemove, adminId) {
  // Security check: An admin cannot remove themselves from the room.
  if (Number(memberIdToRemove) === Number(adminId)) {
    throw new Error('ADMIN_CANNOT_REMOVE_SELF');
  }

  const sql = 'DELETE FROM room_members WHERE room_id = ? AND user_id = ?';
  const [result] = await pool.query(sql, [roomId, memberIdToRemove]);
  
  // The result.affectedRows will be 1 if a user was deleted, 0 if not.
  return result;
}


module.exports = {
  createRoom,
  getRoomsForUser,
  joinRoomByInviteCode,
  getRoomMembers,
  getRoomById,
  startJourney,
  getDailyProblems,
  getLeaderboard,
  getFullSheetForUser,
  removeMember
};
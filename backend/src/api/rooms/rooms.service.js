const pool = require('../../config/db');
const redisClient = require('../../config/redis');

// Declare customAlphabet globally but without immediate assignment
let customAlphabet;
let generateInviteCodeFunc; // Declare the generator function variable

// Asynchronously load nanoid and initialize customAlphabet and generateInviteCodeFunc
(async () => {
  const nanoid = await import('nanoid');
  customAlphabet = nanoid.customAlphabet;
  // Initialize the actual generator function once customAlphabet is loaded
  generateInviteCodeFunc = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 6);
})();

// Helper function to get the invite code generator
// This ensures generateInviteCodeFunc is always initialized before use
function getInviteCodeGenerator() {
  if (!generateInviteCodeFunc) {
    throw new Error("Invite code generator not initialized. nanoid import might have failed or not completed.");
  }
  return generateInviteCodeFunc;
}


async function createRoom(name, adminId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const inviteCode = getInviteCodeGenerator()(); // Call the helper to get the generator, then call the generator
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
        await connection.beginTransaction();
        
        // 1. Find the room ID from the invite code
        const [rooms] = await connection.query('SELECT id, admin_id FROM rooms WHERE invite_code = ?', [inviteCode]);
        if (rooms.length === 0) {
            throw new Error('ROOM_NOT_FOUND');
        }
        const roomId = rooms[0].id;
        const adminId = rooms[0].admin_id;

        // Check if user is already a member
        const [memberCheck] = await connection.query('SELECT 1 FROM room_members WHERE user_id = ? AND room_id = ?', [userId, roomId]);
        if (memberCheck.length > 0) {
            throw new Error('ALREADY_IN_ROOM');
        }
        
        // 2. 🌟 CRITICAL FIX: Delete any existing join request (pending, approved, or denied)
        // This resolves the "Duplicate entry" error when resending.
        await connection.query('DELETE FROM join_requests WHERE user_id = ? AND room_id = ?', [userId, roomId]);


        // 3. Create a new join request
        const sql = 'INSERT INTO join_requests (user_id, room_id, status) VALUES (?, ?, "pending")';
        await connection.query(sql, [userId, roomId]);

        await connection.commit();
        
        // TODO: We will add a notification for the admin here later.
        
        return { message: 'Request to join sent successfully.' };

    } catch (error) {
        await connection.rollback();
        // If the error is not ALREADY_IN_ROOM, throw the original error
        if (error.message !== 'ALREADY_IN_ROOM') {
             throw error;
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
  
  // After updating, fetch the updated room details and return them
  const [updatedRooms] = await pool.query('SELECT * FROM rooms WHERE id = ?', [roomId]);
  return updatedRooms[0];
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
  // 1. Define a unique key for this specific leaderboard in the cache
  const cacheKey = `leaderboard:${roomId}`;

  try {
    // 2. First, try to get the leaderboard from the Redis cache
    const cachedLeaderboard = await redisClient.get(cacheKey);

    if (cachedLeaderboard) {
      console.log(`Serving leaderboard for room ${roomId} from CACHE.`);
      return JSON.parse(cachedLeaderboard); // Return the cached data
    }
  } catch (error) {
    console.error("Redis GET error:", error);
    // If Redis fails, we'll just continue and get data from the DB
  }

  // 3. If it's not in the cache (a "cache miss"), get it from the database
  console.log(`Serving leaderboard for room ${roomId} from DATABASE.`);
  const sql = `
    SELECT
        u.id as userId, u.username, u.current_streak as currentStreak,
        COALESCE(SUM(s.points_awarded), 0) as totalScore
    FROM room_members rm
    JOIN users u ON rm.user_id = u.id
    LEFT JOIN submissions s ON rm.user_id = s.user_id AND rm.room_id = s.room_id
    WHERE rm.room_id = ?
    GROUP BY u.id, u.username
    ORDER BY totalScore DESC, u.username ASC;
  `;
  const [leaderboard] = await pool.query(sql, [roomId]);

  try {
    // 4. Save the fresh data to the cache for next time
    // We'll set it to expire in 5 minutes (300 seconds)
    await redisClient.set(cacheKey, JSON.stringify(leaderboard), { EX: 300 });
  } catch (error) {
    console.error("Redis SET error:", error);
  }

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
    // ... (logic to check if admin, prevent admin from removing self, etc.) ...
    
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Delete the user from the room_members table
        const memberDeleteSql = 'DELETE FROM room_members WHERE room_id = ? AND user_id = ?';
        const [result] = await connection.query(memberDeleteSql, [roomId, memberIdToRemove]);

        // 🌟 CRITICAL FIX: Delete the associated invitation record.
        // This ensures the historical 'accepted' status is cleared, allowing the admin to re-invite the user.
        const inviteDeleteSql = 'DELETE FROM room_invitations WHERE recipient_id = ? AND room_id = ?';
        await connection.query(inviteDeleteSql, [memberIdToRemove, roomId]);
        
        await connection.commit();

        return result; // Return the result of the member deletion

    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

async function getPendingJoinRequests(roomId) {
  const sql = `
    SELECT jr.id, jr.user_id, u.username 
    FROM join_requests jr
    JOIN users u ON jr.user_id = u.id
    WHERE jr.room_id = ? AND jr.status = 'pending'
  `;
  const [requests] = await pool.query(sql, [roomId]);
  return requests;
}

async function approveJoinRequest(requestId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Get the request details
    const [requests] = await connection.query('SELECT user_id, room_id FROM join_requests WHERE id = ?', [requestId]);
    if (requests.length === 0) throw new Error('Request not found.');
    const { user_id, room_id } = requests[0];
    
    // 2. Add the user to the room
    await connection.query('INSERT INTO room_members (room_id, user_id) VALUES (?, ?)', [room_id, user_id]);
    
    // 3. Update the request status to 'approved'
    await connection.query('UPDATE join_requests SET status = "approved" WHERE id = ?', [requestId]);

    await connection.commit();
    return { message: 'Join request approved.' };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function denyJoinRequest(requestId) {
  const sql = 'UPDATE join_requests SET status = "denied" WHERE id = ?';
  await pool.query(sql, [requestId]);
  return { message: 'Join request denied.' };
}

async function leaveRoom(roomId, userId) {
  // 1. First, check if the user is the admin (logic remains the same)
  const [rooms] = await pool.query('SELECT admin_id FROM rooms WHERE id = ?', [roomId]);
  if (rooms.length > 0 && rooms[0].admin_id === userId) {
    throw new Error('ADMIN_CANNOT_LEAVE');
  }

  // Use a transaction to ensure both member removal and invite cleanup succeed
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // A. Delete the user from the room_members table
    const memberDeleteSql = 'DELETE FROM room_members WHERE room_id = ? AND user_id = ?';
    const [result] = await connection.query(memberDeleteSql, [roomId, userId]);
    
    // 🌟 CRITICAL FIX: Delete the associated invitation record.
    // This ensures the 'accepted' status is removed, allowing the original sender to invite them again.
    const inviteDeleteSql = 'DELETE FROM room_invitations WHERE recipient_id = ? AND room_id = ?';
    await connection.query(inviteDeleteSql, [userId, roomId]);

    await connection.commit();

    if (result.affectedRows === 0) {
      // If the user wasn't a member, the member DELETE will return 0.
      return { affectedRows: 0 }; 
    }

    return { affectedRows: 1 };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function deleteRoom(roomId, adminId) {
  // The WHERE clause ensures that only the admin of the room can delete it.
  const sql = 'DELETE FROM rooms WHERE id = ? AND admin_id = ?';
  const [result] = await pool.query(sql, [roomId, adminId]);
  return result;
}

async function getJourneyDashboard(roomId, userId) {
  // 1. Get Room Details and Sheet ID
  const [roomInfoRows] = await pool.query('SELECT sheet_id, name FROM rooms WHERE id = ?', [roomId]);
  if (!roomInfoRows || roomInfoRows.length === 0) {
    throw new Error('Room not found');
  }
  const roomInfo = roomInfoRows[0];
  const sheetId = roomInfo.sheet_id;

  // Get total problems in the sheet
  const [totalProblemsInSheetResult] = await pool.query(
    'SELECT COUNT(id) as total FROM problems WHERE sheet_id = ?',
    [sheetId]
  );
  const totalProblemsInSheet = totalProblemsInSheetResult[0].total;


  // 2. Get Topic-wise Progress (You vs The Room)
  // Removed 's.status = 'approved'' from LEFT JOIN condition
  const [topicProgress] = await pool.query(`
    SELECT
      p.topic,
      COUNT(p.id) AS total_in_topic,
      SUM(CASE WHEN s.user_id = ? THEN 1 ELSE 0 END) AS user_solved,
      (SELECT COUNT(DISTINCT user_id) FROM room_members WHERE room_id = ?) AS member_count
    FROM problems p
    LEFT JOIN submissions s ON p.id = s.problem_id AND s.room_id = ? /* Removed AND s.status = 'approved' */
    JOIN rooms r ON r.id = ?
    WHERE p.sheet_id = r.sheet_id
    GROUP BY p.topic
    ORDER BY p.topic ASC
  `, [userId, roomId, roomId, roomId]);

  // Calculate room average for each topic and fetch solved by any member
  for (const topic of topicProgress) {
    // Removed 's.status = 'approved''
    const [roomSolves] = await pool.query(`
      SELECT COUNT(DISTINCT s.problem_id) as room_solved_in_topic
      FROM submissions s
      JOIN problems p ON s.problem_id = p.id
      WHERE s.room_id = ? AND p.topic = ? /* Removed AND s.status = 'approved' */
    `, [roomId, topic.topic]);
    topic.room_total_solved_by_any_member = roomSolves[0].room_solved_in_topic; // Total unique problems solved in topic by ANY member
  }

  // 3. Get data for the Interactive Problem Grid
  // Removed 'status = 'approved'' from subqueries
  const [problemGrid] = await pool.query(`
    SELECT
      p.id, p.title, p.problem_order, p.url, p.difficulty, p.topic,
      (SELECT COUNT(*) > 0 FROM submissions WHERE problem_id = p.id AND user_id = ? AND room_id = ?) as solved_by_user, /* Removed AND status = 'approved' */
      (SELECT COUNT(*) > 0 FROM submissions WHERE problem_id = p.id AND room_id = ? AND user_id != ?) as solved_by_teammate /* Removed AND status = 'approved' */
    FROM problems p
    JOIN rooms r ON p.sheet_id = r.sheet_id
    WHERE r.id = ?
    ORDER BY p.problem_order ASC
  `, [userId, roomId, roomId, userId, roomId]);

  // 4. Get data for the Burndown Chart
  // Removed 'AND status = 'approved''
  const [burndownDataRaw] = await pool.query(`
    SELECT
      DATE(submitted_at) as date,
      COUNT(DISTINCT problem_id) as problems_solved_on_date
    FROM submissions
    WHERE user_id = ? AND room_id = ?
    GROUP BY DATE(submitted_at)
    ORDER BY date ASC
  `, [userId, roomId]);

  // 5. Get Top Solvers (Leaderboard snippet)
  // Removed 'AND s.status = 'approved''
  const [topSolvers] = await pool.query(`
    SELECT
      u.username,
      COUNT(DISTINCT s.problem_id) as solved_count
    FROM users u
    JOIN submissions s ON u.id = s.user_id
    WHERE s.room_id = ?
    GROUP BY u.id, u.username
    ORDER BY solved_count DESC
    LIMIT 5
  `, [roomId]);

  // Calculate room's average solved problems
  // Removed 'AND status = 'approved''
  const [roomAvgSolvedResult] = await pool.query(`
    SELECT
      AVG(solved_count) as avg_solved
    FROM (
      SELECT
        user_id,
        COUNT(DISTINCT problem_id) as solved_count
      FROM submissions
      WHERE room_id = ?
      GROUP BY user_id
    ) as user_solved_counts;
  `, [roomId]);
  const roomAverageSolved = roomAvgSolvedResult[0]?.avg_solved !== null 
                            ? parseFloat(roomAvgSolvedResult[0].avg_solved) 
                            : 0;

  return {
    roomName: roomInfo.name,
    totalProblemsInSheet,
    userTotalSolved: problemGrid.filter(p => p.solved_by_user).length, // Recalculate based on grid, which is accurate now
    roomAverageSolved,
    topicProgress,
    problemGrid,
    burndownData: burndownDataRaw,
    topSolvers,
  };
}

async function getDailyRoomProgress(roomId, userId) {
  // 1. Get today's problems for the room
  const dailyProblems = await getDailyProblems(roomId); // We can reuse our existing function
  if (dailyProblems.length === 0) {
    return { dailyProblems: [], membersProgress: [] };
  }
  const problemIds = dailyProblems.map(p => p.id);

  // 2. Get all room members
  const members = await getRoomMembers(roomId);
  
  // 3. Get all of today's submissions for this room
  const [todaysSubmissions] = await pool.query(
    'SELECT user_id, problem_id FROM submissions WHERE room_id = ? AND DATE(submitted_at) = CURDATE() AND problem_id IN (?)',
    [roomId, problemIds]
  );

  // 4. Process the data to create a progress map for each member
  const membersProgress = members.map(member => {
    const solved = todaysSubmissions.filter(s => s.user_id === member.id);
    return {
      userId: member.id,
      username: member.username,
      solvedCount: solved.length,
      totalCount: dailyProblems.length,
    };
  });

  return { dailyProblems, membersProgress };
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
  removeMember,
  getPendingJoinRequests, approveJoinRequest, denyJoinRequest,
  leaveRoom,
  deleteRoom,
  getJourneyDashboard,
  getDailyRoomProgress
};
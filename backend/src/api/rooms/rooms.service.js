const pool = require('../../config/db');
const redisClient = require('../../config/redis');
const admin = require('firebase-admin');
const moment = require('moment');

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
        const [rooms] = await connection.query('SELECT id, admin_id, name FROM rooms WHERE invite_code = ?', [inviteCode]);
        if (rooms.length === 0) {
            throw new Error('ROOM_NOT_FOUND');
        }
        const roomId = rooms[0].id;
        const adminId = rooms[0].admin_id; // Correctly get the admin_id
        const roomName = rooms[0].name; // Get room name for notification

        // Check if user is already a member
        const [memberCheck] = await connection.query('SELECT 1 FROM room_members WHERE user_id = ? AND room_id = ?', [userId, roomId]);
        if (memberCheck.length > 0) {
            throw new Error('ALREADY_IN_ROOM');
        }
        
        // 2. Delete any existing join request (pending, approved, or denied)
        await connection.query('DELETE FROM join_requests WHERE user_id = ? AND room_id = ?', [userId, roomId]);

        // 3. Create a new join request
        const sql = 'INSERT INTO join_requests (user_id, room_id, status) VALUES (?, ?, "pending")';
        await connection.query(sql, [userId, roomId]);

        await connection.commit();
        
        // --- NEW/FIXED: Send a push notification (outside the transaction) ---
        // Get the username of the user who sent the join request
        const [userRequesting] = await pool.query('SELECT username FROM users WHERE id = ?', [userId]);
        const requestingUsername = userRequesting.length > 0 ? userRequesting[0].username : 'A user';

        try {
            // Find the admin's FCM token using the adminId
            const [recipient] = await pool.query('SELECT fcm_token FROM users WHERE id = ? AND fcm_token IS NOT NULL', [adminId]); // Use adminId here
            
            if (recipient.length > 0) {
                const notificationTitle = `New Join Request for "${roomName}"`;
                const notificationBody = `${requestingUsername} wants to join your room.`;
                
                const message = {
                    notification: { title: notificationTitle, body: notificationBody },
                    data: { // Optional: send custom data to handle navigation on app side
                      type: 'room_join_request',
                      roomId: String(roomId), // FCM data values must be strings
                      userId: String(userId),
                    },
                    token: recipient[0].fcm_token
                };
                
                await admin.messaging().send(message); 
                console.log(`Successfully sent new join request notification to admin ${adminId} for room ${roomId}`);
            } else {
                console.log(`Admin ${adminId} does not have an FCM token for notifications.`);
            }
        } catch(e) {
            console.error("Failed to send room invitation push notification:", e);
        }
        // --- END NEW/FIXED ---
        
        return { message: 'Request to join sent successfully.' };

    } catch (error) {
        await connection.rollback();
        // If the error is not ALREADY_IN_ROOM, throw the original error
        if (error.message !== 'ALREADY_IN_ROOM') {
            throw error;
        }
        throw error; // Re-throw ALREADY_IN_ROOM error
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
  const room = rows[0];

  if (room) {
    // If the room is active and the end_date has passed, we'll mark it as 'completed'
    // This is a good place to update the status in the DB if it's not already 'completed'
    if (room.status === 'active' && room.end_date) {
      const endDate = moment(room.end_date);
      const today = moment();

      if (today.isAfter(endDate, 'day')) {
        // The journey's end date has passed. Check if all problems have been assigned.
        // We can enhance this check, but for now, we'll assume if end_date has passed, it's completed.
        // A more robust check might involve comparing assigned problems count to total problems in sheet.
        // For now, we'll update the status to 'completed'.
        await pool.query('UPDATE rooms SET status = ? WHERE id = ?', ['completed', roomId]);
        room.status = 'completed'; // Update the returned object as well
        console.log(`Room ${roomId} status updated to 'completed' as end_date passed.`);
      }
    }
  }
  return room; // Returns the room with potentially updated status
}

async function startJourney(roomId, sheetId, durationInDays) {
  const startDate = moment(); // Use moment for easier date handling
  const endDate = moment().add(parseInt(durationInDays, 10), 'days'); // Add duration

  const sql = 'UPDATE rooms SET sheet_id = ?, start_date = ?, end_date = ?, status = ? WHERE id = ?';
  await pool.query(sql, [sheetId, startDate.format('YYYY-MM-DD HH:mm:ss'), endDate.format('YYYY-MM-DD HH:mm:ss'), 'active', roomId]);
  
  // After updating, fetch the updated room details and return them
  const [updatedRooms] = await pool.query('SELECT * FROM rooms WHERE id = ?', [roomId]);
  return updatedRooms[0];
}

async function getDailyProblems(roomId) {
  const [rooms] = await pool.query('SELECT * FROM rooms WHERE id = ?', [roomId]);
  if (rooms.length === 0) {
    return [];
  }
  const room = rooms[0];

  // NEW: If room status is 'completed', return no daily problems
  if (room.status === 'completed') {
    return [];
  }

  if (room.status !== 'active' || !room.start_date || !room.end_date || !room.sheet_id) {
    // If not active, or essential dates/sheet are missing, no daily problems
    return [];
  }

  const [[{ total_problems }]] = await pool.query('SELECT COUNT(*) as total_problems FROM problems WHERE sheet_id = ?', [room.sheet_id]);

  const startDate = moment(room.start_date);
  const endDate = moment(room.end_date);
  const today = moment();

  // Check if today is before the start date or after the end date
  // Use 'day' for comparison to ignore time
  if (today.isBefore(startDate, 'day') || today.isAfter(endDate, 'day')) {
    return []; 
  }

  // Calculate total duration including start and end day
  // +1 because duration is inclusive (e.g., if start=1st, end=1st, duration is 1 day)
  const totalDuration = endDate.diff(startDate, 'days') + 1; 
  const problemsPerDay = Math.ceil(total_problems / totalDuration);
  
  const daysSinceStart = today.diff(startDate, 'days'); // Days from start_date to today
  
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

// Assuming 'pool' (MySQL connection) and 'redisClient' are imported globally/locally
const CACHE_TTL_SECONDS = 300; // 5 minutes cache duration

/**
 * Retrieves the journey dashboard data with maximum optimization.
 * * Optimization techniques used:
 * 1. Redis Caching: Highest priority defense.
 * 2. Query Consolidation: Reduces round trips to the database.
 * 3. Conditional Aggregation (MAX(CASE...) and COUNT(DISTINCT...)): Eliminates N+1 loops.
 * 4. In-Memory Calculation: Averages and leaderboards are processed in Node.js.
 */
async function getJourneyDashboard(roomId, userId) {
    const cacheKey = `journey_dashboard:room:${roomId}:user:${userId}`;
    
    // --- 1. Check Cache (Highest Cost Saving) ---
    try {
        if (typeof redisClient !== 'undefined' && redisClient) {
            const cachedData = await redisClient.get(cacheKey);
            if (cachedData) {
                console.log(`Cache Hit for Room ${roomId}`);
                return JSON.parse(cachedData); 
            }
        }
    } catch (e) {
        console.error("Redis read error, fetching from DB:", e);
    }
    
    // --- 2. Cache Miss: Run Queries (MAXIMUM CONSOLIDATION) ---
    
    // 2.1. Query 1: Room Info, Total Problems, and Member Count (1 Query)
    const [roomData] = await pool.query(`
        SELECT 
            r.name, 
            r.sheet_id, 
            (SELECT COUNT(id) FROM problems WHERE sheet_id = r.sheet_id) AS total_problems,
            (SELECT COUNT(DISTINCT user_id) FROM room_members WHERE room_id = r.id) AS member_count
        FROM rooms r
        WHERE r.id = ?
    `, [roomId]);

    if (!roomData || roomData.length === 0) {
        throw new Error('Room not found');
    }
    const { 
        name: roomName, 
        sheet_id: sheetId, 
        total_problems: totalProblemsInSheet, 
        member_count: memberCount 
    } = roomData[0];

    // 2.2. Query 2: Topic Progress (USER Solves, ROOM Solves, Total in Topic) (1 Query)
    const [topicProgress] = await pool.query(`
        SELECT
            p.topic,
            COUNT(p.id) AS total_in_topic,
            
            -- User Solves: Count unique problems solved by the specific user
            COUNT(DISTINCT CASE WHEN s_user.problem_id IS NOT NULL THEN s_user.problem_id ELSE NULL END) AS user_solved, 
            
            -- Room Solves: Count unique problems solved by ANY user in this room for this topic
            COUNT(DISTINCT s_room.problem_id) AS room_total_solved_by_any_member
        FROM problems p
        JOIN rooms r ON p.sheet_id = r.sheet_id AND r.id = ?
        
        -- Left join for this specific user's submissions
        LEFT JOIN submissions s_user ON p.id = s_user.problem_id AND s_user.room_id = ? AND s_user.user_id = ?
        
        -- Left join for ALL room members' submissions
        LEFT JOIN submissions s_room ON p.id = s_room.problem_id AND s_room.room_id = ?
        
        WHERE r.id = ?
        GROUP BY p.topic
        ORDER BY p.topic ASC
    `, [roomId, roomId, userId, roomId, roomId]);

    // Add memberCount to each topic (since it was calculated separately)
    const topicProgressFinal = topicProgress.map(topic => ({
        ...topic,
        member_count: memberCount
    }));

    // 2.3. Query 3: Problem Grid Status (1 Query)
    const [problemGrid] = await pool.query(`
        SELECT
            p.id, p.title, p.problem_order, p.url AS link, p.difficulty, p.topic,
            -- solved_by_user: 1 if this user has any submission, 0 otherwise
            MAX(CASE WHEN s.user_id = ? THEN 1 ELSE 0 END) AS solved_by_user,
            -- solved_by_teammate: 1 if ANY other user has a submission, 0 otherwise
            MAX(CASE WHEN s.user_id != ? THEN 1 ELSE 0 END) AS solved_by_teammate
        FROM problems p
        JOIN rooms r ON p.sheet_id = r.sheet_id
        LEFT JOIN submissions s ON p.id = s.problem_id AND s.room_id = ?
        WHERE r.id = ?
        GROUP BY p.id, p.title, p.problem_order, p.url, p.difficulty, p.topic
        ORDER BY p.problem_order ASC
    `, [userId, userId, roomId, roomId]);
    
    // 2.4. Query 4: Burndown and Leaderboard Data (2 separate execution blocks for clarity)
    const [leaderboardData] = await pool.query(`
        SELECT 
            u.username,
            COUNT(DISTINCT s.problem_id) as solved_count
        FROM users u
        JOIN submissions s ON u.id = s.user_id
        WHERE s.room_id = ?
        GROUP BY u.id, u.username
        ORDER BY solved_count DESC
    `, [roomId]);
    
    const [burndownDataRaw] = await pool.query(`
        SELECT
          DATE(submitted_at) as date,
          COUNT(DISTINCT problem_id) as problems_solved_on_date
        FROM submissions
        WHERE user_id = ? AND room_id = ?
        GROUP BY DATE(submitted_at)
        ORDER BY date ASC
    `, [userId, roomId]);

    // --- 3. In-Memory Processing (Fastest Calculation) ---
    
    const topSolvers = leaderboardData.slice(0, 5); 
    const totalSolvedByAllUsers = leaderboardData.reduce((sum, user) => sum + user.solved_count, 0);
    const roomAverageSolved = leaderboardData.length > 0 
        ? parseFloat((totalSolvedByAllUsers / leaderboardData.length).toFixed(1)) 
        : 0;
    
    const userTotalSolved = problemGrid.filter(p => p.solved_by_user).length;

    // --- 4. Final Data Structure and Caching ---
    const result = {
        roomName,
        totalProblemsInSheet,
        userTotalSolved,
        roomAverageSolved,
        topicProgress: topicProgressFinal,
        problemGrid,
        burndownData: burndownDataRaw,
        topSolvers,
    };
    
    try {
        if (typeof redisClient !== 'undefined' && redisClient) {
            // Cache the final result with an expiration time
            await redisClient.set(cacheKey, JSON.stringify(result), {
                EX: CACHE_TTL_SECONDS,
                NX: true, // Only set if key does not exist
            });
        }
    } catch (e) {
        console.error("Redis write error:", e);
    }

    return result;
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
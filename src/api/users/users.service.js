const pool = require('../../config/db');

async function updateFcmToken(userId, fcmToken) {
  const connection = await pool.getConnection();
  try {
    // We use a transaction to ensure both steps succeed or fail together.
    await connection.beginTransaction();

    // Step 1: Find any OTHER user who has this token and set their token to NULL.
    // This de-registers the device from the old user.
    const clearOldTokenSql = 'UPDATE users SET fcm_token = NULL WHERE fcm_token = ? AND id != ?';
    await connection.query(clearOldTokenSql, [fcmToken, userId]);

    // Step 2: Set the token for the CURRENT user.
    const setNewTokenSql = 'UPDATE users SET fcm_token = ? WHERE id = ?';
    await connection.query(setNewTokenSql, [fcmToken, userId]);

    await connection.commit();
    return { message: 'FCM token updated successfully.' };
  } catch (error) {
    await connection.rollback();
    throw error; // Re-throw the error to be handled by the controller
  } finally {
    connection.release();
  }
}

async function getUserProfile(userId) {
  const sql = 'SELECT id, username, email, full_name, college_name, course, graduation_year, branch FROM users WHERE id = ?';
  const [users] = await pool.query(sql, [userId]);
  return users[0];
}

async function updateUserProfile(userId, profileData) {
  const { fullName, collegeName, course, graduationYear, branch } = profileData;
  const sql = `
    UPDATE users 
    SET full_name = ?, college_name = ?, course = ?, graduation_year = ?, branch = ?
    WHERE id = ?
  `;
  await pool.query(sql, [fullName, collegeName, course, graduationYear, branch, userId]);
  return { message: 'Profile updated successfully.' };
}

async function searchUsers(query, currentUserId) {
  const searchQuery = `%${query}%`; // Add wildcards for a partial match
  
  // This query searches across three columns for the query text.
  // It also excludes the current user from their own search results.
  const sql = `
    SELECT id, username, full_name, college_name 
    FROM users 
    WHERE (username LIKE ? OR full_name LIKE ? OR college_name LIKE ?)
    AND id != ?
    LIMIT 20; 
  `;
  
  const [users] = await pool.query(sql, [searchQuery, searchQuery, searchQuery, currentUserId]);
  return users;
}

async function getPublicUserProfile(userId) {
  const sql = 'SELECT id, username, full_name, college_name FROM users WHERE id = ?';
  const [users] = await pool.query(sql, [userId]);
  return users[0];
}

// async function getProgressDashboard(userId) {
//   // 1. Get Streak Info
//   const [[streaks]] = await pool.query('SELECT current_streak, max_streak FROM users WHERE id = ?', [userId]);

//   // 2. Get Contribution Dates for the calendar heatmap
//   const [submissions] = await pool.query(
//     'SELECT DISTINCT DATE(submitted_at) as date FROM submissions WHERE user_id = ? AND submitted_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)', 
//     [userId]
//   );
//   const contributionData = submissions.map(s => ({ date: s.date, count: 1 })); // Format for the calendar

//   // 3. Get Active Journey Info & Progress
//   const [activeRooms] = await pool.query(`
//     SELECT r.id, r.name, r.start_date, r.end_date, s.name as sheet_name, 
//     (SELECT COUNT(*) FROM problems WHERE sheet_id = r.sheet_id) as total_problems,
//     (SELECT COUNT(DISTINCT problem_id) FROM submissions WHERE user_id = ? AND room_id = r.id) as solved_problems
//     FROM rooms r 
//     JOIN room_members rm ON r.id = rm.room_id 
//     JOIN sheets s ON r.sheet_id = s.id
//     WHERE rm.user_id = ? AND r.status = 'active'
//     LIMIT 1;
//   `, [userId, userId]);

//   return {
//     streaks,
//     contributionData,
//     activeJourney: activeRooms.length > 0 ? activeRooms[0] : null,
//   };
// }

async function getProgressDashboard(userId) {
  // 1. Get User Info & Global Streaks
  const [[userInfo]] = await pool.query(
    'SELECT username, full_name, college_name, course, graduation_year, branch, current_streak, max_streak FROM users WHERE id = ?', 
    [userId]
  );

  // 2. Get Contribution Dates for the calendar
  const [submissions] = await pool.query(
    'SELECT DISTINCT DATE(submitted_at) as date FROM submissions WHERE user_id = ? AND submitted_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)', 
    [userId]
  );
  const contributionData = submissions.map(s => ({ date: s.date.toISOString().split('T')[0], count: 1 }));

  // 3. Get ALL Active Journeys & Progress (LIMIT 1 is removed)
  const [activeJourneys] = await pool.query(`
    SELECT r.id, r.name, r.start_date, r.end_date, s.name as sheet_name, 
    (SELECT COUNT(*) FROM problems WHERE sheet_id = r.sheet_id) as total_problems,
    (SELECT COUNT(DISTINCT problem_id) FROM submissions WHERE user_id = ? AND room_id = r.id) as solved_problems
    FROM rooms r 
    JOIN room_members rm ON r.id = rm.room_id 
    JOIN sheets s ON r.sheet_id = s.id
    WHERE rm.user_id = ? AND r.status = 'active'
    ORDER BY r.start_date DESC;
  `, [userId, userId]);

  return {
    userInfo,
    contributionData,
    activeJourneys: activeJourneys, // Changed from activeJourney to activeJourneys
  };
}

// Update the exports
module.exports = { updateFcmToken, getUserProfile, updateUserProfile,searchUsers,getPublicUserProfile,getProgressDashboard   };
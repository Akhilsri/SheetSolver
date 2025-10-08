const pool = require('../../config/db');
const cloudinary = require('../../config/cloudinary');
const DatauriParser = require('datauri/parser');
const path = require('path');
const parser = new DatauriParser();
const redisClient = require('../../config/redis');

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
  const { 
    full_name, // Changed from fullName
    college_name, // Changed from collegeName
    course, 
    graduation_year, // Changed from graduationYear
    branch, 
    linkedin_url, 
    github_url, 
    twitter_url 
  } = profileData;

  const sql = `
    UPDATE users 
    SET full_name = ?, college_name = ?, course = ?, graduation_year = ?, branch = ?,
        linkedin_url = ?, github_url = ?, twitter_url = ?
    WHERE id = ?
  `;
  await pool.query(sql, [
    full_name,       // Use consistent variable names
    college_name,    // Use consistent variable names
    course,
    graduation_year, // Use consistent variable names
    branch,
    linkedin_url,
    github_url,
    twitter_url,
    userId
  ]);
  await redisClient.del(`dashboard:${userId}`);
  return { message: 'Profile updated successfully.' };
}


async function searchUsers(query, userId) { // <-- ADD userId HERE
  const searchQuery = `%${query}%`;
  const sql = `
    SELECT id, username, full_name, college_name, avatar_url 
    FROM users 
    WHERE (username LIKE ? OR full_name LIKE ? OR college_name LIKE ?)
    AND id != ?`; // <-- ADD THIS LINE TO EXCLUDE SELF

  const [users] = await pool.query(sql, [searchQuery, searchQuery, searchQuery, userId]); // <-- PASS userId HERE
  return users;
}

async function getPublicUserProfile(userId) {
  // 1. Get the user's public profile info, now including social links
  const profileSql = `
    SELECT 
      id, username, full_name, college_name,bio, avatar_url,  
      linkedin_url, github_url, twitter_url 
    FROM users 
    WHERE id = ?
  `;
  const [users] = await pool.query(profileSql, [userId]);

  if (users.length === 0) {
    return null; // User not found
  }
  const profile = users[0];

  // 2. Get the list of room IDs this user is a member of (this part is the same)
  const roomsSql = 'SELECT room_id FROM room_members WHERE user_id = ?';
  const [memberOfRooms] = await pool.query(roomsSql, [userId]);
  const memberOfRoomIds = memberOfRooms.map(r => r.room_id);

  // 3. Return both pieces of information
  return {
    profile,
    memberOfRoomIds,
  };
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
  // 1. Define a unique key for this user's dashboard in the cache
  const cacheKey = `dashboard:${userId}`;

  try {
    // 2. First, try to get the dashboard data from the Redis cache
    const cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
      console.log(`Serving dashboard for user ${userId} from CACHE.`);
      return JSON.parse(cachedData); // Return the cached data
    }
  } catch (error) {
    console.error("Redis GET error for dashboard:", error);
    // If Redis fails, we'll just continue and get data from the DB
  }

  // 3. If it's not in the cache, get it from the database
  console.log(`Serving dashboard for user ${userId} from DATABASE.`);
  
  // This is your existing, correct database logic
  const [[userInfo]] = await pool.query(
    'SELECT username, full_name, college_name, course, graduation_year, branch, current_streak, max_streak, linkedin_url, github_url, twitter_url, avatar_url, bio FROM users WHERE id = ?', 
    [userId]
  );
  const [submissions] = await pool.query(
    'SELECT DISTINCT DATE(submitted_at) as date FROM submissions WHERE user_id = ? AND submitted_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)', 
    [userId]
  );
  const contributionData = submissions.map(s => ({ date: s.date.toISOString().split('T')[0], count: 1 }));
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

  const dashboardData = {
    userInfo,
    contributionData,
    activeJourneys: activeJourneys,
  };

  try {
    // 4. Save the fresh data to the cache for next time
    // We'll set it to expire in 10 minutes (600 seconds)
    await redisClient.set(cacheKey, JSON.stringify(dashboardData), { EX: 600 });
  } catch (error) {
    console.error("Redis SET error for dashboard:", error);
  }

  return dashboardData;
}

async function updateAvatar(userId, file) {
  // 1. Process and upload the file to Cloudinary
  const fileExtension = path.extname(file.originalname).toString();
  const fileContent = parser.format(fileExtension, file.buffer).content;
  const result = await cloudinary.uploader.upload(fileContent, {
    folder: 'sheet-solver-avatars',
    // This transformation creates a perfectly square 400x400 image focusing on the user's face
    transformation: [{ width: 400, height: 400, crop: "fill", gravity: "face" }]
  });
  const avatarUrl = result.secure_url;

  // --- THIS IS THE CRUCIAL STEP THAT WAS LIKELY MISSING OR INCORRECT ---
  // 2. Save the new Cloudinary URL to your database for the correct user
  await pool.query(
    'UPDATE users SET avatar_url = ? WHERE id = ?', 
    [avatarUrl, userId]
  );
  // -----------------------------------------------------------------
  await redisClient.del(`dashboard:${userId}`);
  // 3. Return the new URL to the frontend for an instant UI update
  return { avatar_url: avatarUrl };
}

// Update the exports
module.exports = { updateFcmToken, getUserProfile, updateUserProfile,searchUsers,getPublicUserProfile,getProgressDashboard,updateAvatar  };
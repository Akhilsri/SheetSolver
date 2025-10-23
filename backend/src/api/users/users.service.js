const pool = require('../../config/db');
const cloudinary = require('../../config/cloudinary');
const DatauriParser = require('datauri/parser');
const path = require('path');
const parser = new DatauriParser();
const redisClient = require('../../config/redis');

async function updateFcmToken(userId, fcmToken) { // MODIFIED: Explicitly named fcmToken
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Step 1: Find any OTHER user who has this token and set their token to NULL.
    // This de-registers the device from the old user, preventing "token hijacked" issues.
    const clearOldTokenSql = 'UPDATE users SET fcm_token = NULL WHERE fcm_token = ? AND id != ?';
    await connection.query(clearOldTokenSql, [fcmToken, userId]);

    // Step 2: Set the token for the CURRENT user.
    const setNewTokenSql = 'UPDATE users SET fcm_token = ? WHERE id = ?';
    await connection.query(setNewTokenSql, [fcmToken, userId]);

    await connection.commit();
    return { message: 'FCM token updated successfully.' };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// NEW: Function to set FCM token to NULL (for logout or cleanup)
async function removeFCMToken(userId) {
  const sql = 'UPDATE users SET fcm_token = NULL WHERE id = ?';
  await pool.query(sql, [userId]);
  return { message: 'FCM token removed successfully.' };
}


async function getUserProfile(userId) {
  const sql = 'SELECT id, username, email, full_name, college_name, course, graduation_year, branch FROM users WHERE id = ?';
  const [users] = await pool.query(sql, [userId]);
  return users[0];
}

async function updateUserProfile(userId, profileData) {
  const { 
    full_name,
    college_name,
    course, 
    graduation_year,
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
    full_name,
    college_name,
    course,
    graduation_year,
    branch,
    linkedin_url,
    github_url,
    twitter_url,
    userId
  ]);
  await redisClient.del(`dashboard:${userId}`);
  return { message: 'Profile updated successfully.' };
}


async function searchUsers(query, userId) {
  const searchQuery = `%${query}%`;
  // Cleaned and properly indented SQL string
  const sql = `
    SELECT id, username, full_name, college_name, avatar_url 
    FROM users 
    WHERE (username LIKE ? OR full_name LIKE ? OR college_name LIKE ?)
    AND id != ?
    LIMIT 20
  `; 

  const [users] = await pool.query(sql, [searchQuery, searchQuery, searchQuery, userId]);
  return users;
}

async function getPublicUserProfile(userId) {
  const profileSql = `
    SELECT 
      id, username, full_name, college_name,bio, avatar_url, 
      linkedin_url, github_url, twitter_url 
    FROM users 
    WHERE id = ?
  `;
  const [users] = await pool.query(profileSql, [userId]);

  if (users.length === 0) {
    return null;
  }
  const profile = users[0];

  const roomsSql = 'SELECT room_id FROM room_members WHERE user_id = ?';
  const [memberOfRooms] = await pool.query(roomsSql, [userId]);
  const memberOfRoomIds = memberOfRooms.map(r => r.room_id);

  return {
    profile,
    memberOfRoomIds,
  };
}

async function getProgressDashboard(userId) {
  const cacheKey = `dashboard:${userId}`;

  try {
    const cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
      console.log(`Serving dashboard for user ${userId} from CACHE.`);
      return JSON.parse(cachedData);
    }
  } catch (error) {
    console.error("Redis GET error for dashboard:", error);
  }

  console.log(`Serving dashboard for user ${userId} from DATABASE.`);
  
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
    await redisClient.set(cacheKey, JSON.stringify(dashboardData), { EX: 600 });
  } catch (error) {
    console.error("Redis SET error for dashboard:", error);
  }

  return dashboardData;
}

async function updateAvatar(userId, file) {
  const fileExtension = path.extname(file.originalname).toString();
  const fileContent = parser.format(fileExtension, file.buffer).content;
  const result = await cloudinary.uploader.upload(fileContent, {
    folder: 'sheet-solver-avatars',
    transformation: [{ width: 400, height: 400, crop: "fill", gravity: "face" }]
  });
  const avatarUrl = result.secure_url;

  await pool.query(
    'UPDATE users SET avatar_url = ? WHERE id = ?', 
    [avatarUrl, userId]
  );
  await redisClient.del(`dashboard:${userId}`);
  return { avatar_url: avatarUrl };
}

// Update the exports to include the new functions
module.exports = { 
  updateFcmToken, 
  removeFCMToken, // NEWLY ADDED
  getUserProfile, 
  updateUserProfile,
  searchUsers,
  getPublicUserProfile,
  getProgressDashboard,
  updateAvatar 
};
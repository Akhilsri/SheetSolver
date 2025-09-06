const pool = require('../../config/db');

async function updateFcmToken(userId, fcmToken) {
  const sql = 'UPDATE users SET fcm_token = ? WHERE id = ?';
  await pool.query(sql, [fcmToken, userId]);
  return { message: 'FCM token updated successfully.' };
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

// Update the exports
module.exports = { updateFcmToken, getUserProfile, updateUserProfile,searchUsers,getPublicUserProfile  };
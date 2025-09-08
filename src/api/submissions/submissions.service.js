const badgesService = require('../badges/badges.service');
const pool = require('../../config/db');
const cloudinary = require('../../config/cloudinary');
const DatauriParser = require('datauri/parser');
const path = require('path');
const admin = require('../../config/firebase');

const parser = new DatauriParser();

// This is the new debug version for submissions.service.js

// This is the final version for submissions.service.js
async function createSubmission({ userId, roomId, problemId, file, username }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // --- Points & File Upload (No Changes) ---
    let totalPoints = 0;
    // ... (Your existing points calculation logic is here and is working fine) ...
    const fileExtension = path.extname(file.originalname).toString();
    const fileContent = parser.format(fileExtension, file.buffer).content;
    const result = await cloudinary.uploader.upload(fileContent, { folder: 'sheet-solver-proofs' });
    const photoUrl = result.secure_url;
    const sql = `INSERT INTO submissions (user_id, room_id, problem_id, photo_url, points_awarded) VALUES (?, ?, ?, ?, ?)`;
    await connection.query(sql, [userId, roomId, problemId, photoUrl, totalPoints]);

    // --- NEW DEBUGGING LOGS FOR STREAK CALCULATION ---
    console.log('\n--- STREAK CALCULATION ---');
    // 1. Get the user's current streak data
    const [users] = await connection.query('SELECT current_streak, max_streak, last_submission_date FROM users WHERE id = ? FOR UPDATE', [userId]);
    const user = users[0];
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let newStreak = user.current_streak;
    
    if (user.last_submission_date) {
      const lastSubmissionDate = new Date(user.last_submission_date);
      lastSubmissionDate.setHours(0, 0, 0, 0);

      const diffTime = today - lastSubmissionDate;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        newStreak++; // Continue streak
      } else if (diffDays > 1) {
        newStreak = 1; // Break streak
      }
    } else {
      newStreak = 1; // First submission
    }
    
    // Update the max_streak if the new streak is greater
    const newMaxStreak = Math.max(user.max_streak, newStreak);

    await connection.query(
      'UPDATE users SET current_streak = ?, max_streak = ?, last_submission_date = ? WHERE id = ?',
      [newStreak, newMaxStreak, today, userId]
    );
    // --- END OF STREAK LOGIC ---
    
    const newBadges = await badgesService.checkAndAwardBadges(userId, connection);
    
    await connection.commit();

    // ... (Push Notification logic) ...

    return { success: true, message: 'Submission created successfully', pointsAwarded: totalPoints, url: photoUrl, newBadges };
  
  } catch (error) {
    await connection.rollback();
    console.error("Error in createSubmission service:", error);
    throw error;
  } finally {
    connection.release();
  }
}

async function getTodaysSubmissionsForRoom(roomId) {
  // The query now includes "s.user_id"
  const sql = `
    SELECT s.problem_id, s.photo_url, s.submitted_at, u.username, s.user_id, s.points_awarded 
    FROM submissions s 
    JOIN users u ON s.user_id = u.id 
    WHERE s.room_id = ? AND DATE(s.submitted_at) = CURDATE();
  `;
  
  const [submissions] = await pool.query(sql, [roomId]);
  return submissions;
}

async function getSubmissionStatusForProblems(userId, problemIds) {
  // If the list of problems is empty, return an empty array immediately.
  if (!problemIds || problemIds.length === 0) {
    return [];
  }

  const sql = `SELECT problem_id FROM submissions WHERE user_id = ? AND problem_id IN (?)`;
  
  // The FIX is here: We pass problemIds directly, not wrapped in another array.
  // Incorrect: [userId, [problemIds]]
  // Correct: [userId, problemIds]
  const [results] = await pool.query(sql, [userId, problemIds]);
  
  return results.map(r => r.problem_id);
}

module.exports = { createSubmission, getTodaysSubmissionsForRoom,getSubmissionStatusForProblems };
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
    
    // --- 1. POINTS CALCULATION LOGIC ---
    let totalPoints = 0;
    const [problems] = await connection.query('SELECT difficulty, title FROM problems WHERE id = ?', [problemId]);
    if (problems.length === 0) {
      throw new Error('Problem not found.');
    }
    const problem = problems[0];

    switch (problem.difficulty) {
      case 'Easy':   totalPoints += 10; break;
      case 'Medium': totalPoints += 20; break;
      case 'Hard':   totalPoints += 30; break;
      default:       totalPoints += 10;
    }
    const [existingSubmissions] = await connection.query('SELECT id FROM submissions WHERE room_id = ? AND problem_id = ?', [roomId, problemId]);
    if (existingSubmissions.length === 0) {
      totalPoints += 15; // First solver bonus
    }

    // --- 2. FILE UPLOAD LOGIC ---
    const fileExtension = path.extname(file.originalname).toString();
    const fileContent = parser.format(fileExtension, file.buffer).content;
    const result = await cloudinary.uploader.upload(fileContent, { folder: 'sheet-solver-proofs' });
    const photoUrl = result.secure_url;
    
    // --- 3. SAVE SUBMISSION TO DATABASE ---
    const sql = `INSERT INTO submissions (user_id, room_id, problem_id, photo_url, points_awarded) VALUES (?, ?, ?, ?, ?)`;
    await connection.query(sql, [userId, roomId, problemId, photoUrl, totalPoints]);

    // --- 4. STREAK CALCULATION LOGIC ---
    const [users] = await connection.query('SELECT current_streak, max_streak, last_submission_date FROM users WHERE id = ? FOR UPDATE', [userId]);
    const user = users[0];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let newStreak = user.current_streak;
    if (user.last_submission_date) {
      const lastSubmissionDate = new Date(user.last_submission_date);
      lastSubmissionDate.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((today - lastSubmissionDate) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) newStreak++;
      else if (diffDays > 1) newStreak = 1;
    } else {
      newStreak = 1;
    }
    const newMaxStreak = Math.max(user.max_streak, newStreak);
    await connection.query(
      'UPDATE users SET current_streak = ?, max_streak = ?, last_submission_date = ? WHERE id = ?',
      [newStreak, newMaxStreak, today, userId]
    );
    
    // --- 5. BADGE AWARDING LOGIC ---
    const newBadges = await badgesService.checkAndAwardBadges(userId, connection);
    
    // --- 6. SAVE NOTIFICATIONS TO DB ---
    const notificationTitle = 'Problem Solved! 🔥';
    const notificationBody = `${username} just solved "${problem.title}"! Check out their snap.`;
    const [membersToNotify] = await connection.query('SELECT user_id FROM room_members WHERE room_id = ? AND user_id != ?', [roomId, userId]);
    if (membersToNotify.length > 0) {
      const notificationSql = 'INSERT INTO notifications (recipient_user_id, title, body) VALUES ?';
      const notificationValues = membersToNotify.map(member => [member.user_id, notificationTitle, notificationBody]);
      await connection.query(notificationSql, [notificationValues]);
    }
    
    await connection.commit();

    try {
      console.log('\n--- PUSH NOTIFICATION DEBUG ---');
      if (membersToNotify.length > 0) {
        const memberIds = membersToNotify.map(m => m.user_id);
        console.log(`Found ${memberIds.length} other member(s) to notify with IDs:`, memberIds);

        // Also select the user ID to see who we're checking
        const [usersWithTokens] = await pool.query('SELECT id, fcm_token FROM users WHERE id IN (?) AND fcm_token IS NOT NULL', [memberIds]);
        const tokens = usersWithTokens.map(u => u.fcm_token);
        console.log(`Found ${tokens.length} valid FCM tokens for those members. (Users: ${usersWithTokens.map(u=>u.id).join(', ')})`);

        if (tokens.length > 0) {
          console.log('Attempting to send push notification...');
          const messages = tokens.map(token => ({
            notification: { title: notificationTitle, body: notificationBody },
            token: token,
          }));

          const response = await admin.messaging().sendEach(messages);
          console.log('Successfully sent push notifications:', response.successCount);
          if (response.failureCount > 0) {
              console.log('Failed notifications:', response.responses.filter(r => !r.success));
          }
        } else {
          console.log('Conclusion: No FCM tokens found for other members. No push notification will be sent.');
        }
      } else {
        console.log('Conclusion: No other members in the room to notify.');
      }
      console.log('-----------------------------');
    } catch (notificationError) {
      console.error('Failed to send push notification (but submission was saved):', notificationError);
    }

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
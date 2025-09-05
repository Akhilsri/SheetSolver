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
    
    // --- Points & File Upload (This part is working correctly) ---
    let totalPoints = 0;
    const [problems] = await connection.query('SELECT * FROM problems WHERE id = ?', [problemId]);
    if (problems.length === 0) throw new Error('Problem not found.');
    const problem = problems[0];

    switch (problem.difficulty) {
      case 'Easy': totalPoints += 10; break;
      case 'Medium': totalPoints += 20; break;
      case 'Hard': totalPoints += 30; break;
      default: totalPoints += 10;
    }
    const [existingSubmissions] = await connection.query('SELECT id FROM submissions WHERE room_id = ? AND problem_id = ?', [roomId, problemId]);
    if (existingSubmissions.length === 0) {
      totalPoints += 15;
    }

    const fileExtension = path.extname(file.originalname).toString();
    const fileContent = parser.format(fileExtension, file.buffer).content;
    const result = await cloudinary.uploader.upload(fileContent, { folder: 'sheet-solver-proofs' });
    const photoUrl = result.secure_url;
    
    const sql = `INSERT INTO submissions (user_id, room_id, problem_id, photo_url, points_awarded) VALUES (?, ?, ?, ?, ?)`;
    await connection.query(sql, [userId, roomId, problemId, photoUrl, totalPoints]);

    // --- Save Notifications to DB (This part is working correctly) ---
    const notificationTitle = 'Problem Solved! 🔥';
    const notificationBody = `${username} just solved "${problem.title}"! Check out their snap.`;
    const [membersToNotify] = await connection.query('SELECT user_id FROM room_members WHERE room_id = ? AND user_id != ?', [roomId, userId]);
    if (membersToNotify.length > 0) {
      const notificationSql = 'INSERT INTO notifications (recipient_user_id, title, body) VALUES ?';
      const notificationValues = membersToNotify.map(member => [member.user_id, notificationTitle, notificationBody]);
      await connection.query(notificationSql, [notificationValues]);
    }
    
    await connection.commit();

    // --- PUSH NOTIFICATION LOGIC (CORRECTED) ---
    try {
      if (membersToNotify.length > 0) {
        const memberIds = membersToNotify.map(m => m.user_id);
        const [usersWithTokens] = await pool.query('SELECT fcm_token FROM users WHERE id IN (?) AND fcm_token IS NOT NULL', [memberIds]);
        const tokens = usersWithTokens.map(u => u.fcm_token);

        if (tokens.length > 0) {
          // 1. For sendEach, we create an array of message objects
          const messages = tokens.map(token => ({
            notification: {
              title: notificationTitle,
              body: notificationBody
            },
            token: token,
          }));

          // 2. Use the correct `sendEach` function
          const response = await admin.messaging().sendEach(messages);
          console.log('Successfully sent push notifications:', response.successCount);
        }
      }
    } catch (notificationError) {
      console.error('Failed to send push notification (but submission was saved):', notificationError);
    }
    // --- END OF CORRECTION ---

    return { success: true, message: 'Submission created successfully', pointsAwarded: totalPoints, url: photoUrl };
  
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

module.exports = { createSubmission, getTodaysSubmissionsForRoom };
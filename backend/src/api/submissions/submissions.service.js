const badgesService = require('../badges/badges.service');
const pool = require('../../config/db');
const cloudinary = require('../../config/cloudinary');
const DatauriParser = require('datauri/parser');
const path = require('path');
const admin = require('../../config/firebase');
const { sendNotificationToUser } = require('../utils/socket-utils');
const redisClient = require('../../config/redis') 

const parser = new DatauriParser();

// This is the final version for submissions.service.js
// Remember to ensure all necessary imports (like pool, admin, sendNotificationToUser, etc.) 
// are present at the top of your actual submissions.service.js file.

async function createSubmission({ userId, roomId, problemId, file, username, approach, timeComplexity, spaceComplexity }) {
    const connection = await pool.getConnection();

    // Variables needed for PUSH notification, declared here to be accessible outside the transaction
    let notificationTitle = '';
    let notificationBody = '';
    let membersToNotify = [];
    let newBadges = []; // Declared here to be returned
    
    try {
        await connection.beginTransaction();

        // --- 1. POINTS CALCULATION LOGIC ---
        let totalPoints = 0;
        const [problems] = await connection.query('SELECT difficulty, title FROM problems WHERE id = ?', [problemId]);
        if (problems.length === 0) { throw new Error('Problem not found.'); }
        const problem = problems[0];

        switch (problem.difficulty) {
            case 'Easy': totalPoints += 10; break;
            case 'Medium': totalPoints += 20; break;
            case 'Hard': totalPoints += 30; break;
            default: totalPoints += 10;
        }
        const [existingSubmissions] = await connection.query('SELECT id FROM submissions WHERE room_id = ? AND problem_id = ?', [roomId, problemId]);
        if (existingSubmissions.length === 0) { totalPoints += 15; } // First solver bonus

        // --- 2. FILE UPLOAD LOGIC ---
        const fileExtension = path.extname(file.originalname).toString();
        const fileContent = parser.format(fileExtension, file.buffer).content;
        const uploadResult = await cloudinary.uploader.upload(fileContent, { folder: 'sheet-solver-proofs' });
        const photoUrl = uploadResult.secure_url;

        // --- 3. SAVE SUBMISSION TO DATABASE ---
        const insertSql = `
 INSERT INTO submissions 
 (user_id, room_id, problem_id, photo_url, points_awarded, approach, time_complexity, space_complexity) 
 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
 `;
 
 // MODIFIED: Update the values array to include the new data
const [submissionInsertResult] = await connection.query(insertSql, [
 userId, 
roomId, 
problemId, 
photoUrl, 
totalPoints,
 // NEW VALUES
 approach,
timeComplexity,
spaceComplexity
 ]);
const submissionId = submissionInsertResult.insertId;

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
        await connection.query('UPDATE users SET current_streak = ?, max_streak = ?, last_submission_date = ? WHERE id = ?', [newStreak, newMaxStreak, today, userId]);

        // --- 5. BADGE AWARDING LOGIC ---
        newBadges = await badgesService.checkAndAwardBadges(userId, connection);

        // --- 6. PREPARE & SAVE NOTIFICATIONS ---
        notificationTitle = 'Problem Solved! 🔥';
        notificationBody = `${username} just solved "${problem.title}"! Check out their snap.`;
        // Fetch users to notify and store in external variable
        [membersToNotify] = await connection.query('SELECT user_id FROM room_members WHERE room_id = ? AND user_id != ?', [roomId, userId]);

        if (membersToNotify.length > 0) {
            const notificationSql = 'INSERT INTO notifications (recipient_user_id, title, body, type, related_room_id, related_submission_id) VALUES ?';
            const notificationValues = membersToNotify.map(member => [
                member.user_id, notificationTitle, notificationBody, 'SUBMISSION', roomId, submissionId
            ]);
            await connection.query(notificationSql, [notificationValues]);

            // --- 7. INSTANT SOCKET NOTIFICATIONS ---
            membersToNotify.forEach(member => {
                sendNotificationToUser(member.user_id);
            });
        }
        
        // 🌟 COST OPTIMIZATION: COMMIT TRANSACTION AND RELEASE CONNECTION IMMEDIATELY
        await connection.commit();
        connection.release(); // Free up the resource!

         const leaderboardCacheKey = `leaderboard:${roomId}`;
        try {
            await redisClient.del(leaderboardCacheKey);
            console.log(`✅ Leaderboard cache for room ${roomId} cleared.`);
        } catch (cacheError) {
            console.error(`❌ Error clearing leaderboard cache for room ${roomId}:`, cacheError);
        }

        // -----------------------------------------------------------------
        // 8. PUSH NOTIFICATIONS VIA FCM (MOVED OUTSIDE TRANSACTION)
        
        try {
            // console.log('\n--- PUSH NOTIFICATION DEBUG ---');
            if (membersToNotify.length > 0) {
                const memberIds = membersToNotify.map(m => m.user_id);
                // Use pool (safe outside transaction)
                const [usersWithTokens] = await pool.query('SELECT id, fcm_token FROM users WHERE id IN (?) AND fcm_token IS NOT NULL', [memberIds]);
                
                const tokens = usersWithTokens.map(u => u.fcm_token);

                if (tokens.length > 0) {
                    console.log('Attempting to send push notification...');
                    const messages = tokens.map(token => ({
                         notification: { title: notificationTitle, body: notificationBody }, token: token
                    }));
                    const response = await admin.messaging().sendEach(messages);
                    
                    // FCM Cleanup Logic (uses pool.query)
                    if (response.failureCount > 0) {
                        const tokensToDeleteUserIds = [];
                        response.responses.forEach((res, index) => {
                            const isTokenDead = res.error && (
                                res.error.code === 'messaging/registration-token-not-registered' ||
                                res.error.message.includes('Requested entity was not found')
                            );
                            if (isTokenDead) {
                                const failedToken = messages[index].token;
                                const user = usersWithTokens.find(u => u.fcm_token === failedToken);
                                if (user) { tokensToDeleteUserIds.push(user.id); }
                            }
                        });

                        if (tokensToDeleteUserIds.length > 0) {
                            const deleteSql = 'UPDATE users SET fcm_token = NULL WHERE id IN (?)';
                            await pool.query(deleteSql, [tokensToDeleteUserIds]); 
                        }
                    }
                }
            }
        } catch (notificationError) {
            console.error('Failed to send push notification:', notificationError);
        }
        
        return { success: true, message: 'Submission created successfully', pointsAwarded: totalPoints, url: photoUrl, newBadges };

    } catch (error) {
        // Ensure rollback and release only happens if the connection wasn't released above
        if (connection && connection.connection && connection.connection.release) {
            await connection.rollback();
            connection.release();
        }
        console.error("Error in createSubmission service:", error);
        throw error;
    }
}


async function getTodaysSubmissionsForRoom(roomId) {
 // The query now includes approach, time_complexity, and space_complexity
 const sql = `SELECT 
s.problem_id, 
s.photo_url, 
s.submitted_at, 
u.username, 
s.user_id, 
s.points_awarded,
s.approach,      
s.time_complexity, 
s.space_complexity 
FROM submissions s 
JOIN users u ON s.user_id = u.id 
WHERE s.room_id = ? AND DATE(s.submitted_at) = CURDATE();`; // Remove leading whitespace on every line inside backticks

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
// backend/src/api/analytics/analytics.service.js
const pool = require('../../config/db');

async function getUserSubmissionTrends(userId) {
  const [rows] = await pool.query(
    `SELECT 
       DATE_FORMAT(s.submitted_at, '%Y-%m-%d') as submission_date,
       COUNT(s.id) as total_submissions
     FROM submissions s
     WHERE s.user_id = ?
     GROUP BY submission_date
     ORDER BY submission_date ASC`,
    [userId]
  );
  return rows;
}

async function getUserSubmissionsByDifficulty(userId) {
  const [rows] = await pool.query(
    `SELECT 
       p.difficulty,
       COUNT(s.id) as count
     FROM submissions s
     JOIN problems p ON s.problem_id = p.id
     WHERE s.user_id = ?
     GROUP BY p.difficulty`,
    [userId]
  );
  return rows;
}

async function getUserEloRatingHistory(userId) {
  // Assuming you have an 'elo_history' table that logs ELO changes
  // If not, this part would need a different approach (e.g., deriving from quiz results)
  const [rows] = await pool.query(
    `SELECT
       DATE_FORMAT(eh.timestamp, '%Y-%m-%d %H:00:00') as date_hour,
       eh.elo_rating as rating
     FROM elo_history eh
     WHERE eh.user_id = ?
     ORDER BY eh.timestamp ASC`,
    [userId]
  );
  return rows;
}

async function getSubmissionsByTopic(userId) {
  const [rows] = await pool.query(
    `SELECT
       p.topic,
       COUNT(s.id) as count
     FROM submissions s
     JOIN problems p ON s.problem_id = p.id
     WHERE s.user_id = ?
     GROUP BY p.topic
     ORDER BY count DESC`,
    [userId]
  );
  return rows;
}

// NOTE: If you don't have an 'elo_history' table, you can create one:
// CREATE TABLE elo_history (
//     id INT AUTO_INCREMENT PRIMARY KEY,
//     user_id INT NOT NULL,
//     elo_rating INT NOT NULL,
//     timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
//     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
// );
// And remember to insert a record into this table whenever a user's ELO changes.


module.exports = {
  getUserSubmissionTrends,
  getUserSubmissionsByDifficulty,
  getUserEloRatingHistory,
  getSubmissionsByTopic
};
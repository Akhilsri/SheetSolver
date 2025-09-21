const pool = require('../../config/db');

async function checkAndAwardBadges(userId, connection) {
  // Use the provided transaction connection if available, otherwise use the pool
  const db = connection || pool;

  // 1. Get user's stats
  const [[userStats]] = await db.query(
    'SELECT current_streak, (SELECT COUNT(*) FROM submissions WHERE user_id = ?) as total_submissions FROM users WHERE id = ?',
    [userId, userId]
  );
  
  // 2. Get stats by topic
  const [topicCounts] = await db.query(
    'SELECT p.topic, COUNT(s.id) as count FROM submissions s JOIN problems p ON s.problem_id = p.id WHERE s.user_id = ? GROUP BY p.topic',
    [userId]
  );
  
  // 3. Get badges the user has NOT yet earned
  const [potentialBadges] = await db.query(
    'SELECT * FROM badges WHERE id NOT IN (SELECT badge_id FROM user_badges WHERE user_id = ?)',
    [userId]
  );

  const newlyAwarded = [];

  // 4. Loop through potential badges and check if criteria are met
  for (const badge of potentialBadges) {
    let earned = false;
    if (badge.criteria_type === 'STREAK' && userStats.current_streak >= Number(badge.criteria_value)) {
      earned = true;
    }
    if (badge.criteria_type === 'PROBLEM_COUNT_TOTAL' && userStats.total_submissions >= Number(badge.criteria_value)) {
      earned = true;
    }
    if (badge.criteria_type === 'PROBLEM_COUNT_TOPIC') {
      const [topic, value] = badge.criteria_value.split('_');
      const topicCount = topicCounts.find(tc => tc.topic === topic);
      if (topicCount && topicCount.count >= Number(value)) {
        earned = true;
      }
    }

    if (earned) {
      // 5. If earned, insert into user_badges table
      await db.query('INSERT INTO user_badges (user_id, badge_id) VALUES (?, ?)', [userId, badge.id]);
      newlyAwarded.push(badge);
    }
  }
  
  return newlyAwarded; // Return any new badges
}

// Service to get the badges a user has earned
async function getEarnedBadges(userId) {
    const sql = `
        SELECT b.name, b.description, b.icon_emoji
        FROM badges b
        JOIN user_badges ub ON b.id = ub.badge_id
        WHERE ub.user_id = ?
        ORDER BY ub.earned_at DESC
    `;
    const [badges] = await pool.query(sql, [userId]);
    return badges;
}


module.exports = { checkAndAwardBadges, getEarnedBadges };
const pool = require('../../config/db');

async function getAvailableTopics() {
  // This query now gets a unique, sorted list of ONLY the topics
  // that actually exist in your quiz_questions table.
  const sql = 'SELECT DISTINCT topic FROM quiz_questions ORDER BY topic ASC';
  const [results] = await pool.query(sql);
  const topics = results.map(r => r.topic);
  return topics;
}

module.exports = { getAvailableTopics };
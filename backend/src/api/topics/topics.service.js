const pool = require('../../config/db');

async function getAllTopics() {
  const [rows] = await pool.query('SELECT DISTINCT topic FROM problems ORDER BY topic');
  return rows.map(row => row.topic); // Returns an array of topic strings
}

module.exports = {
  getAllTopics
};
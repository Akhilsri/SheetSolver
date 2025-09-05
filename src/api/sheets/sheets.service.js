const pool = require('../../config/db');

async function getAllSheets() {
  const [sheets] = await pool.query('SELECT * FROM sheets ORDER BY name');
  return sheets;
}

module.exports = { getAllSheets };
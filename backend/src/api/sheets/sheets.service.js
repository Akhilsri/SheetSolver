const pool = require('../../config/db');

// Create a cache variable outside the function
let sheetsCache = null;
let cacheTimestamp = null;

async function getAllSheets() {
  const now = new Date();
  // If we have a cache and it's less than 1 hour old, use it
  if (sheetsCache && cacheTimestamp && (now - cacheTimestamp < 3600000)) {
    console.log('Serving sheets from cache.');
    return sheetsCache;
  }

  // Otherwise, fetch from the database
  console.log('Fetching sheets from database and updating cache.');
  const [sheets] = await pool.query('SELECT id, name FROM sheets ORDER BY name');
  
  // Update the cache and the timestamp
  sheetsCache = sheets;
  cacheTimestamp = now;

  return sheets;
}

module.exports = { getAllSheets };
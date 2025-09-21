const fs = require('fs');
const csv = require('csv-parser');
const pool = require('./src/config/db');

// --- CONFIGURE YOUR IMPORT ---
const CSV_FILE_PATH = './new_sheet.csv'; // Make sure this is the correct filename
const SHEET_ID_TO_SAVE = 5;
const STARTING_PROBLEM_ORDER = 776;
// -----------------------------

async function importCSV() {
  const results = [];
  
  console.log(`Starting CSV import process for: ${CSV_FILE_PATH}`);

  fs.createReadStream(CSV_FILE_PATH)
    // --- THIS IS THE FIX ---
    // We remove the hardcoded headers. The library will now automatically
    // use the first line of your CSV file as the headers.
    .pipe(csv())
    // ---------------------
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      console.log(`CSV file successfully processed. Found ${results.length} problems.`);
      
      try {
        const connection = await pool.getConnection();
        console.log('Database connection successful. Starting import...');

        let currentProblemOrder = STARTING_PROBLEM_ORDER;

        for (const row of results) {
          let problemDifficulty = row.difficulty;
          if (problemDifficulty === 'Unknown') {
            problemDifficulty = 'Hard';
          }

          const sql = `
            INSERT INTO problems 
            (sheet_id, topic, title, url, difficulty, problem_order) 
            VALUES (?, ?, ?, ?, ?, ?)
          `;
          
          const values = [
            SHEET_ID_TO_SAVE,
            row.title, // Mapping 'title' from CSV to 'topic' in DB
            row.problem, // Mapping 'problem' from CSV to 'title' in DB
            row.url,
            problemDifficulty,
            currentProblemOrder
          ];

          await connection.query(sql, values);
          console.log(`Inserted: ${row.problem} (Order: ${currentProblemOrder})`);
          currentProblemOrder++;
        }

        connection.release();
        console.log(`--- Import Complete! Inserted ${results.length} new problems. ---`);

      } catch (error) {
        console.error('An error occurred during the database import:', error);
      } finally {
        pool.end();
      }
    })
    .on('error', (error) => {
      console.error('An error occurred while reading the CSV file:', error);
    });
}

importCSV();
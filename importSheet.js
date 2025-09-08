const fs = require('fs');
const csv = require('csv-parser');
const pool = require('./src/config/db'); // Use your existing DB connection

// --- CONFIGURE YOUR IMPORT ---
// 1. Set the name of the CSV file you want to import.
const CSV_FILE_PATH = './a_to_z_sheet.csv';

// 2. Set the sheet_id for these problems. From your message, it's 3.
const SHEET_ID_TO_SAVE = 1;

// 3. Set the starting number for the problem order. Your last problem was 191, so we start at 192.
const STARTING_PROBLEM_ORDER = 347;
// -----------------------------


async function importCSV() {
  const results = [];
  
  console.log(`Starting CSV import process for: ${CSV_FILE_PATH}`);

  fs.createReadStream(CSV_FILE_PATH)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      console.log(`CSV file successfully processed. Found ${results.length} problems.`);
      
      try {
        const connection = await pool.getConnection();
        console.log('Database connection successful. Starting import...');

        let currentProblemOrder = STARTING_PROBLEM_ORDER;

        for (const row of results) {
          const sql = `
            INSERT INTO problems 
            (sheet_id, topic, title, url, difficulty, problem_order) 
            VALUES (?, ?, ?, ?, ?, ?)
          `;
          
          const values = [
            SHEET_ID_TO_SAVE, // Add the sheet_id from our config
            row.topic,
            row.title,
            row.url,
            row.difficulty,
            currentProblemOrder // Add the calculated problem_order
          ];

          await connection.query(sql, values);
          console.log(`Inserted: ${row.title} (Order: ${currentProblemOrder})`);
          currentProblemOrder++; // Increment the order for the next problem
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

// Run the function
importCSV();
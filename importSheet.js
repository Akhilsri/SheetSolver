const fs = require('fs');
const csv = require('csv-parser');
const pool = require('./src/config/db'); // We'll use the same database connection pool from our app

async function importCSV() {
  const results = [];
  const filePath = './sde_sheet.csv'; // The path to your CSV file

  console.log('Starting CSV import process...');

  // Create a stream to read the CSV file
  fs.createReadStream(filePath)
    .pipe(csv()) // Pipe the stream into the csv-parser
    .on('data', (data) => {
      // This event fires for each row in the CSV
      results.push(data);
    })
    .on('end', async () => {
      // This event fires when the entire file has been read
      console.log(`CSV file successfully processed. Found ${results.length} problems.`);
      
      try {
        // Get a connection from the pool
        const connection = await pool.getConnection();
        console.log('Database connection successful. Starting import...');

        // Loop through each row and insert it into the database
        for (const row of results) {
          const sql = `
            INSERT INTO problems (sheet_id, topic, title, url, difficulty, problem_order) 
            VALUES (?, ?, ?, ?, ?, ?)
          `;
          
          const values = [
            row.sheet_id,
            row.topic,
            row.title,
            row.url,
            row.difficulty,
            row.problem_order
          ];

          await connection.query(sql, values);
          console.log(`Inserted: ${row.title}`);
        }

        // Release the connection back to the pool
        connection.release();
        console.log('--- Import Complete! ---');

      } catch (error) {
        console.error('An error occurred during the database import:', error);
      } finally {
        // Close the connection pool
        pool.end();
      }
    })
    .on('error', (error) => {
      console.error('An error occurred while reading the CSV file:', error);
    });
}

// Run the function
importCSV();
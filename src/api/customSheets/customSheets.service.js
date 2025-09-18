const pool = require('../../config/db');
const csv = require('csv-parser');
const { Readable } = require('stream');

async function createSheetFromCsv(userId, sheetName, fileBuffer) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Create the new custom sheet record and get its ID
    const [sheetResult] = await connection.query(
      'INSERT INTO custom_sheets (name, created_by_user_id) VALUES (?, ?)',
      [sheetName, userId]
    );
    const customSheetId = sheetResult.insertId;

    // 2. Parse the CSV file from the uploaded buffer
    const problems = [];
    await new Promise((resolve, reject) => {
      Readable.from(fileBuffer)
        .pipe(csv({ headers: ['topic', 'title', 'url', 'difficulty'] })) // Ensure correct headers
        .on('data', (row) => problems.push(row))
        .on('end', resolve)
        .on('error', reject);
    });
    
    if (problems.length === 0) {
      throw new Error('CSV file is empty or has an invalid format.');
    }

    // 3. Prepare the problem data for a bulk database insert
    const problemValues = problems.map((p, index) => [
      customSheetId,
      p.topic,
      p.title,
      p.url,
      p.difficulty,
      index + 1 // Use the row number as the problem_order
    ]);

    // 4. Insert all problems into the custom_sheet_problems table in one go
    const sql = 'INSERT INTO custom_sheet_problems (custom_sheet_id, topic, title, url, difficulty, problem_order) VALUES ?';
    await connection.query(sql, [problemValues]);

    await connection.commit();
    return { sheetId: customSheetId, problemsAdded: problems.length };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
module.exports = { createSheetFromCsv };
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const pool = require('./src/config/db');

// --- CONFIGURATION ---
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = 'gemini-1.5-flash-latest';

// --- CUSTOMIZE YOUR REQUEST ---
const TOPIC_TO_GENERATE = 'Stack and Queues';
const DIFFICULTY = 'easy';
const NUMBER_OF_QUESTIONS = 50;

const prompt = `
You are an expert computer science professor. Your task is to generate ${NUMBER_OF_QUESTIONS} unique, ${DIFFICULTY}-difficulty, multiple-choice questions about the '${TOPIC_TO_GENERATE}' topic in data structures.

For each question, you must provide: "question_text", "option_a", "option_b", "option_c", "option_d", and "correct_answer" which must be 'A', 'B', 'C', or 'D'.

Provide the final output as a single, valid JSON array of objects. Do not include any text, explanation, or markdown formatting like \`\`\`json before or after the JSON array.
`;

async function saveQuestionsToDB(questions) {
  console.log('\n--- STARTING DATABASE INSERTION INTO quiz_questions ---');
  for (const q of questions) {
    // New SQL query targeting the new table and its specific columns
    const sql = `
      INSERT INTO quiz_questions 
      (topic, difficulty, question_text, option_a, option_b, option_c, option_d, correct_answer)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await pool.query(sql, [
      TOPIC_TO_GENERATE,
      DIFFICULTY,
      q.question_text,
      q.option_a,
      q.option_b,
      q.option_c,
      q.option_d,
      q.correct_answer
    ]);
    console.log(`Inserted: ${q.question_text.substring(0, 40)}...`);
  }
  console.log('--- DATABASE INSERTION COMPLETE ---');
}

async function run() {
  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    console.log(`Sending prompt to the ${MODEL_NAME} model... Please wait.`);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();
    console.log('Received response from API.');

    if (text.startsWith('```json')) {
      text = text.substring(7, text.length - 3);
    }
    const questions = JSON.parse(text);
    console.log(`--- SUCCESSFULLY PARSED ${questions.length} QUESTIONS ---`);

    await saveQuestionsToDB(questions);

  } catch (error) {
    console.error('An error occurred:', error);
  } finally {
    await pool.end();
    console.log('Database connection closed.');
  }
}

run();
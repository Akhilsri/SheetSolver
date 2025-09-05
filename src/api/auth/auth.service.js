const pool = require('../../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

/**
 * Creates a new user in the database.
 * @param {string} username - The user's username.
 * @param {string} email - The user's email address.
 * @param {string} password - The user's raw password.
 * @returns {Promise<object>} The result of the database insertion.
 */
async function registerUser(username, email, password) {
  // 1. Hash the password
  // A salt round of 10 is a good balance between security and performance
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // 2. Write the SQL query to insert the new user
  const sql = 'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)';
  
  // 3. Execute the query using the connection pool
  // Using '?' placeholders is crucial to prevent SQL injection attacks
  const [result] = await pool.query(sql, [username, email, hashedPassword]);

  return result;
}

/**
 * Authenticates a user and returns a JWT.
 * @param {string} email - The user's email.
 * @param {string} password - The user's raw password.
 * @returns {Promise<string|null>} The JWT if successful, otherwise null.
 */
async function loginUser(email, password) {
  // 1. Find the user by email in the database
  // Make sure you are selecting the username column here
  const sql = 'SELECT id, email, username, password_hash FROM users WHERE email = ?';
  const [users] = await pool.query(sql, [email]);

  if (users.length === 0) {
    return null; // User not found
  }
  const user = users[0];

  // 2. Compare the provided password with the stored hash
  const isMatch = await bcrypt.compare(password, user.password_hash);

  if (!isMatch) {
    return null; // Passwords don't match
  }

  // 3. --- THIS IS THE FIX ---
  // The payload MUST include the username from the user object we just fetched.
  const payload = {
    userId: user.id,
    email: user.email,
    username: user.username, // <-- This line fixes the bug
  };

  // 4. Create the token with the correct payload
  const token = jwt.sign(
    payload,
    process.env.JWT_SECRET,
    { expiresIn: '1h' } // Token expires in 1 hour
  );

  return token;
}

// Update the exports to include the new function
module.exports = {
  registerUser,
  loginUser,
};
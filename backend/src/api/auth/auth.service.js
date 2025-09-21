const crypto = require('crypto');
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
// Add this line at the top of your file
// ... (keep other imports like pool, bcrypt, jwt)

// Replace your old loginUser function with this new one
async function loginUser(email, password) {
  // 1. Find the user by email
  const sql = 'SELECT id, email, username, password_hash FROM users WHERE email = ?';
  const [users] = await pool.query(sql, [email]);

  if (users.length === 0) {
    return null;
  }
  const user = users[0];

  // 2. Compare the password
  const isMatch = await bcrypt.compare(password, user.password_hash);

  if (!isMatch) {
    return null;
  }

  // --- THIS IS THE CORRECT TOKEN GENERATION LOGIC ---

  // 3. Create the short-lived Access Token (15 minutes)
  const accessTokenPayload = {
    userId: user.id,
    email: user.email,
    username: user.username,
  };
  const accessToken = jwt.sign(
    accessTokenPayload,
    process.env.JWT_SECRET,
    { expiresIn: '15m' } 
  );

  // 4. Create the long-lived, secure Refresh Token (30 days)
  const refreshToken = crypto.randomBytes(40).toString('hex');
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 30);

  // 5. Save the new refresh token to your database
  await pool.query(
    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
    [user.id, refreshToken, expiryDate]
  );

  // 6. Return BOTH tokens to the frontend
  return { accessToken, refreshToken };
}

async function refreshAccessToken(oldRefreshToken) {
  // 1. Find the token in our database
  const [tokens] = await pool.query('SELECT * FROM refresh_tokens WHERE token = ?', [oldRefreshToken]);
  if (tokens.length === 0) throw new Error('Invalid refresh token.');
  
  const tokenRecord = tokens[0];
  // 2. Check if it's expired
  if (new Date(tokenRecord.expires_at) < new Date()) {
    throw new Error('Refresh token expired.');
  }

  // 3. Get user info and create a new access token
  const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [tokenRecord.user_id]);
  const user = users[0];
  const accessTokenPayload = { userId: user.id, email: user.email, username: user.username };
  const newAccessToken = jwt.sign(accessTokenPayload, process.env.JWT_SECRET, { expiresIn: '15m' });

  return { accessToken: newAccessToken };
}

// Update the exports to include the new function
module.exports = {
  registerUser,
  loginUser,
  refreshAccessToken 
};
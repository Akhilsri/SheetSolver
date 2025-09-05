const authService = require('./auth.service');

async function handleRegister(req, res) {
  try {
    // 1. Extract data from the request body
    const { username, email, password } = req.body;

    // 2. Basic validation
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Username, email, and password are required.' });
    }

    // 3. Call the service to create the user
    await authService.registerUser(username, email, password);

    // 4. Send a success response
    res.status(201).json({ message: 'User created successfully!' });

  } catch (error) {
    // 5. Handle potential errors (e.g., duplicate email)
    console.error('Registration Error:', error);
    // The UNIQUE constraint on the email column will cause an error if it's a duplicate
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Email already in use.' });
    }
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

async function handleLogin(req, res) {
  try {
    // 1. Extract email and password from request body
    const { email, password } = req.body;

    // 2. Basic validation
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    // 3. Call the service to authenticate the user
    const token = await authService.loginUser(email, password);

    // 4. If the service returns null, credentials were bad
    if (!token) {
      // Use a generic message for security - don't reveal if the email exists or not
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    // 5. If successful, send the token back
    res.status(200).json({ token: token });

  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

// Update the exports to include the new function
module.exports = {
  handleRegister,
  handleLogin,
};
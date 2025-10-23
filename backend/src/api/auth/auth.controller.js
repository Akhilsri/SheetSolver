const authService = require('./auth.service');
const { sendEmail } = require('../utils/email.util'); 

// --- DEEP LINK CONFIGURATION ---
// This MUST match the scheme registered in your React Native app's Linking configuration
// const DEEP_LINK_BASE = 'myapp://reset-password'; 


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
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const tokens = await authService.loginUser(email, password);

    if (!tokens) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    // This line sends the { accessToken, refreshToken } object directly.
    res.status(200).json(tokens);

  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

async function handleRefreshToken(req, res) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.sendStatus(401);

    const tokens = await authService.refreshAccessToken(refreshToken);
    res.json(tokens);
  } catch (error) {
    res.status(403).json({ message: 'Refresh token is invalid or expired.' });
  }
}

async function handleCheckUsername(req, res) {
  const { username } = req.body;

  // Basic validation
  if (!username || typeof username !== 'string' || username.length < 3) {
    return res.status(400).json({ available: false, message: 'Invalid username. Must be at least 3 characters.' });
  }

  try {
    const exists = await authService.checkUsernameExists(username);
    if (exists) {
      return res.json({ available: false, message: 'Username already exists.' });
    } else {
      return res.json({ available: true, message: 'Username is available.' });
    }
  } catch (error) {
    console.error('Error in handleCheckUsername:', error);
    res.status(500).json({ message: 'Server error during username check.' });
  }
}

// POST /api/auth/forgot-password
// POST /api/auth/forgot-password
async function handleForgotPassword(req, res) {
    // 1. Setup the WEB_REDIRECT_BASE URL
    // NOTE: This constant must be defined using the value from process.env.WEB_REDIRECT_BASE
    const WEB_REDIRECT_BASE = process.env.WEB_REDIRECT_BASE; 
    
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: 'Email is required.' });
    }

    try {
        // 1. Create token and retrieve user email from the service
        const result = await authService.createPasswordResetToken(email);

        // Security practice: Only send the email if the result is valid, but always return success below.
        if (result) {
            const { token, userEmail } = result;
            
            // CRITICAL FIX: Construct the HTTPS link pointing to your server's redirect route.
            const resetLink = `${WEB_REDIRECT_BASE}?token=${token}`; 

            // 2. Build the styled HTML content
            const htmlContent = `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #4CAF50;">Password Reset Request</h2>
                    <p>You requested a password reset. Click the button below to open your app and set a new password:</p>
                    
                    <!-- Styled anchor tag using the HTTPS link -->
                    <a href="${resetLink}" 
                       style="display: inline-block; padding: 10px 20px; margin: 15px 0; font-size: 16px; color: #ffffff; background-color: #007bff; text-decoration: none; border-radius: 5px;"
                    >
                        Reset Password Now
                    </a>
                    
                    <p>This link is valid for **1 hour**. If you did not request this, please ignore this email.</p>
                    <p style="font-size: 12px; color: #888;">If the button above does not work, copy and paste this link into your browser: <br>${resetLink}</p>
                </div>
            `;

            // 3. Send email with the styled HTML body
            await sendEmail({
                to: userEmail,
                subject: 'Password Reset Request for SheetSolver',
                html: htmlContent, 
            });
        }

        // 4. Send successful response (always return generic success for security)
        return res.status(200).json({ message: 'If an account is registered with that email, a reset link has been sent.' });

    } catch (error) {
        console.error('Forgot Password Error:', error);
        // Ensure that email sending errors are caught and returned to the frontend
        if (error.message.includes('Email sending failed')) {
            return res.status(503).json({ message: error.message });
        }
        return res.status(500).json({ message: 'Server error during password reset request.' });
    }
}

// POST /api/auth/reset-password
async function handleResetPassword(req, res) {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ message: 'Token and new password are required.' });
  }

  try {
    // 1. Validate token, hash password, and update user record in the service
    await authService.resetPassword(token, newPassword);

    // 2. Success
    return res.status(200).json({ message: 'Password successfully reset.' });

  } catch (error) {
    console.error('Reset Password Error:', error.message);
    // Respond with a 403 for invalid/expired tokens (as thrown by the service)
    if (error.message.includes('token')) {
        return res.status(403).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Server error during password reset.' });
  }
}

// Update the exports to include the new function
module.exports = {
  handleRegister,
  handleLogin,
  handleRefreshToken,
  handleCheckUsername,
  handleForgotPassword,
  handleResetPassword
};
const express = require('express');
const authController = require('./auth.controller');

const router = express.Router();

// Route for registration
router.post('/register', authController.handleRegister);

// --- Add the new route for login ---
router.post('/login', authController.handleLogin);
router.post('/refresh', authController.handleRefreshToken);
router.post('/check-username', authController.handleCheckUsername);

// --- PASSWORD RESET ROUTES (NEW) ---
// 1. Route to request the password reset email (sends deep link)
router.post('/forgot-password', authController.handleForgotPassword);

// 2. Route to receive the token and new password to complete the reset
router.post('/reset-password', authController.handleResetPassword);


module.exports = router;
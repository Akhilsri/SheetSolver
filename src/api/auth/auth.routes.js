const express = require('express');
const authController = require('./auth.controller');

const router = express.Router();

// Route for registration
router.post('/register', authController.handleRegister);

// --- Add the new route for login ---
router.post('/login', authController.handleLogin);
router.post('/refresh', authController.handleRefreshToken);

module.exports = router;
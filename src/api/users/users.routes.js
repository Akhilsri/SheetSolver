const express = require('express');
const usersController = require('./users.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

const router = express.Router();

router.post('/fcm-token', authMiddleware, usersController.handleUpdateFcmToken);

// GET a user's own profile
router.get('/profile', authMiddleware, usersController.handleGetUserProfile);
// UPDATE a user's own profile
router.put('/profile', authMiddleware, usersController.handleUpdateUserProfile);
router.get('/search', authMiddleware, usersController.handleSearchUsers);

module.exports = router;
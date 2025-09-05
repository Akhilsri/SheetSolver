const express = require('express');
const roomsController = require('./rooms.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const adminAuthMiddleware = require('../../middlewares/adminAuth.middleware');

const router = express.Router();

// This middleware protects ALL routes below it. A user must have a valid token.
router.use(authMiddleware);

// --- General Room Routes ---
router.post('/', roomsController.handleCreateRoom);
router.get('/', roomsController.handleGetRooms);
router.post('/join', roomsController.handleJoinRoom);

// --- Room-Specific Routes ---
// Note: More specific routes like '/:roomId/members' should come before generic ones like '/:roomId'
// although in this case it doesn't cause an issue.
router.get('/:roomId', roomsController.handleGetRoomById);
router.get('/:roomId/members', roomsController.handleGetRoomMembers);
router.get('/:roomId/daily-problems', roomsController.handleGetDailyProblems);

// --- Admin-Only Route ---
// This is the only place the start route should be, and it MUST have the admin middleware.
router.post('/:roomId/start', adminAuthMiddleware, roomsController.handleStartJourney);
router.get('/:roomId/leaderboard', roomsController.handleGetLeaderboard);
router.get('/:roomId/full-sheet', roomsController.handleGetFullSheet);
router.delete('/:roomId/members/:memberId', adminAuthMiddleware, roomsController.handleRemoveMember);

module.exports = router;
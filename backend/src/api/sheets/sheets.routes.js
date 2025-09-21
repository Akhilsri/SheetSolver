const express = require('express');
const sheetsController = require('./sheets.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

const router = express.Router();

// Any logged-in user can see the list of sheets
router.get('/', authMiddleware, sheetsController.handleGetAllSheets);

module.exports = router;
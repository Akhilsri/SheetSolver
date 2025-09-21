const express = require('express');
const multer = require('multer');
const customSheetsController = require('./customSheets.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.post(
  '/upload', 
  authMiddleware, 
  upload.single('sheetFile'), // The name of the file field from the frontend
  customSheetsController.handleCreateSheetFromCsv
);

module.exports = router;
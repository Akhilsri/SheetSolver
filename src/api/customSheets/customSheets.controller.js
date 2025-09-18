const customSheetsService = require('./customSheets.service');

async function handleCreateSheetFromCsv(req, res) {
  try {
    const userId = req.user.userId;
    const { sheetName } = req.body;
    const file = req.file;

    if (!sheetName || !file) {
      return res.status(400).json({ message: 'Sheet name and a CSV file are required.' });
    }

    const result = await customSheetsService.createSheetFromCsv(userId, sheetName, file.buffer);
    res.status(201).json({ message: `Custom sheet '${sheetName}' created successfully!`, ...result });
  } catch (error) {
    console.error('Create sheet from CSV error:', error);
    res.status(500).json({ message: 'Failed to create sheet. Please check your CSV format.' });
  }
}
module.exports = { handleCreateSheetFromCsv };
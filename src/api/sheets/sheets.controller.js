const sheetsService = require('./sheets.service');

async function handleGetAllSheets(req, res) {
  try {
    const sheets = await sheetsService.getAllSheets();
    res.status(200).json(sheets);
  } catch (error) {
    console.error('Get All Sheets Error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

module.exports = { handleGetAllSheets };
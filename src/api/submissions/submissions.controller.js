const submissionsService = require('./submissions.service');

async function handleCreateSubmission(req, res) {
  try {
    // Data from the form fields
    const { roomId, problemId } = req.body;
    // User info from the authenticated token (decoded by the middleware)
    const userId = req.user.userId;
    const username = req.user.username; // Get username from token

    // The file object from multer middleware
    const file = req.file;

    if (!file || !roomId || !problemId) {
      return res.status(400).json({ message: 'Missing required fields (proofImage, roomId, problemId).' });
    }

    // Pass the username along with the other data to the service
    const submissionData = { userId, roomId, problemId, file, username };
    const result = await submissionsService.createSubmission(submissionData);

    res.status(201).json(result);
  } catch (error) {
    console.error("Create Submission Error:", error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

async function handleGetTodaysSubmissions(req, res) {
  try {
    const { roomId } = req.params;
    const submissions = await submissionsService.getTodaysSubmissionsForRoom(roomId);
    res.status(200).json(submissions);
  } catch (error) {
    console.error("Get Today's Submissions Error:", error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

module.exports = { handleCreateSubmission, handleGetTodaysSubmissions };
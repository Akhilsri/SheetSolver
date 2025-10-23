const submissionsService = require('./submissions.service');

async function handleCreateSubmission(req, res) {
  try {
    // Data from the form fields
    // MODIFIED: Extract new fields here
    const { 
      roomId, 
      problemId, 
      approach, 
      timeComplexity, 
      spaceComplexity 
    } = req.body;
    
    // User info from the authenticated token (decoded by the middleware)
    const userId = req.user.userId;
    const username = req.user.username; // Get username from token

    // The file object from multer middleware
    const file = req.file;

    // MODIFIED: Add new fields to the missing check, although the frontend now ensures they are present.
    if (!file || !roomId || !problemId || !approach || !timeComplexity || !spaceComplexity) {
      return res.status(400).json({ message: 'Missing required fields (proofImage, roomId, problemId, approach, timeComplexity, or spaceComplexity).' });
    }

    // Pass the username and NEW FIELDS along with the other data to the service
    const submissionData = { 
      userId, 
      roomId, 
      problemId, 
      file, 
      username,
      // NEW FIELDS
      approach,
      timeComplexity,
      spaceComplexity
    };
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

async function handleGetSubmissionStatus(req, res) {
  try {
    const userId = req.user.userId;
    const { problemIds } = req.body;
    const solvedIds = await submissionsService.getSubmissionStatusForProblems(userId, problemIds);
    res.status(200).json(solvedIds);
  } catch (error) {
    // This now goes back to only logging on the server for security
    console.error("Get Submission Status Error:", error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

module.exports = { handleCreateSubmission, handleGetTodaysSubmissions,handleGetSubmissionStatus  };
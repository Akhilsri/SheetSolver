const quizService = require('./quiz.service');

async function handleGetAvailableTopics(req, res) {
  try {
    const topics = await quizService.getAvailableTopics();
    res.status(200).json(topics);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

module.exports = { handleGetAvailableTopics };
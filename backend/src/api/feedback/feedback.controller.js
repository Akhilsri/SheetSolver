const feedbackService = require('./feedback.service');

async function handlePostFeedback(req, res) {
    try {
        const { feedbackText, email, category } = req.body;
        // Basic validation
        if (!feedbackText) {
            return res.status(400).json({ message: 'Feedback text is required.' });
        }
        await feedbackService.saveFeedback({ feedbackText, email, category });
        res.status(201).json({ message: 'Feedback submitted successfully.' });
    } catch (error) {
        console.error('Error submitting feedback:', error);
        res.status(500).json({ message: 'Internal server error while submitting feedback.' });
    }
}

module.exports = { handlePostFeedback };
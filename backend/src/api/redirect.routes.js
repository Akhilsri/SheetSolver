const express = require('express');
const router = express.Router();

router.get('/redirect-to-app', (req, res) => {
    // 1. Get the token from the HTTPS query parameter
    const token = req.query.token;

    if (!token) {
        return res.status(400).send('Invalid password reset link.');
    }

    // 2. Construct the deep link using the custom scheme
    const deepLinkUrl = `myapp://reset-password?token=${token}`;

    // 3. CRITICAL: Issue a 302 redirect. The browser will handle the custom scheme.
    res.redirect(302, deepLinkUrl);
});

module.exports = router;
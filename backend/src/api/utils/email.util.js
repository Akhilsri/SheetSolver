const nodemailer = require('nodemailer');

// --- Configuration ---
// It is CRITICAL to store these values in environment variables (process.env.EMAIL_USER, etc.)
// For security and best practice, use a dedicated email service or an "App Password" 
// if using Gmail, as standard passwords often fail.
const transporter = nodemailer.createTransport({
    // Use an appropriate SMTP service. This example uses Gmail's service.
    service: 'gmail', 
    auth: {
        user: process.env.EMAIL_USER,    // Your sender email address (e.g., from .env)
        pass: process.env.EMAIL_PASS,    // The corresponding password or app password
    },
});

/**
 * Sends an email using the configured transporter.
 * @param {object} mailOptions - Options containing to, subject, and html content.
 * @param {string} mailOptions.to - Recipient email address.
 * @param {string} mailOptions.subject - Subject line of the email.
 * @param {string} mailOptions.html - HTML body of the email (contains the deep link).
 * @returns {Promise<object>} The result object from the email service.
 */
async function sendEmail(mailOptions) {
    // Set a default sender email format
    const options = {
        from: `SheetSolver <${process.env.EMAIL_USER}>`,
        ...mailOptions
    };

    try {
        console.log(`Attempting to send password reset email to: ${options.to}`);
        const info = await transporter.sendMail(options);
        console.log('Email sent successfully. Message ID: %s', info.messageId);
        
        // This is useful for debugging if you use a test account like Ethereal Mail
        // if (process.env.NODE_ENV === 'development') {
        //     console.log('Email Preview URL: %s', nodemailer.getTestMessageUrl(info));
        // }
        
        return info;
    } catch (error) {
        console.error('CRITICAL ERROR: Failed to send email.', error);
        // Rethrow the error to be caught by the calling controller (auth.controller.js)
        throw new Error(`Email sending failed: ${error.message}`);
    }
}

module.exports = {
    sendEmail,
};

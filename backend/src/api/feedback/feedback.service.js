const pool = require('../../config/db'); // Your database connection

async function saveFeedback(feedbackData) {
    const { feedbackText, email, category } = feedbackData;
    const sql = `
        INSERT INTO user_feedback (feedback_text, user_email, category, created_at)
        VALUES (?, ?, ?, NOW())
    `;
    await pool.query(sql, [feedbackText, email, category]);
    // Optionally send an email here to yourself
    // await sendEmailToAdmin({ feedbackText, email, category });
    return { message: 'Feedback saved successfully.' };
}

// Function to send email (you'd need to set up a mailer like Nodemailer)
// async function sendEmailToAdmin({ feedbackText, email, category }) {
//     const nodemailer = require('nodemailer');
//     const transporter = nodemailer.createTransport({
//         service: 'gmail', // or your email service
//         auth: {
//             user: 'your_email@gmail.com',
//             pass: 'your_email_password_or_app_password'
//         }
//     });
//     const mailOptions = {
//         from: 'your_app_email@example.com',
//         to: 'your_admin_email@example.com',
//         subject: `New App Feedback: ${category}`,
//         html: `
//             <p><strong>Category:</strong> ${category}</p>
//             <p><strong>Feedback:</strong> ${feedbackText}</p>
//             <p><strong>User Email:</strong> ${email || 'Not provided'}</p>
//             <p><strong>From:</strong> SheetSolver App</p>
//         `
//     };
//     await transporter.sendMail(mailOptions);
// }

module.exports = { saveFeedback };
const nodemailer = require('nodemailer');
const process = require('process');

/**
 * Sends an email asynchronously using Nodemailer and Gmail.
 */
async function sendEmailNodemailer(to, subject, html) {
  const EMAIL_USER = process.env.EMAIL_USER;
  const EMAIL_PASS = process.env.EMAIL_PASS;

  if (!EMAIL_USER || !EMAIL_PASS) {
    console.error('❌ [Email Error] EMAIL_USER or EMAIL_PASS missing from your .env!');
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      },
      pool: true,
      maxConnections: 1,
      maxMessages: 10,
    });

    const mailOptions = {
      from: `"SecureCrowd Auth" <${EMAIL_USER}>`,
      to: to,
      subject: subject,
      html: html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email Delivered] Reset link sent to ${to}! (Message ID: ${info.messageId})`);

    return true;
  } catch (error) {
    console.error('[Nodemailer Exception]', error.message);
    return false;
  }
}

/**
 * Helper specifically for sending password reset link
 */
async function sendResetPasswordLink(email, username, resetLink) {
  const subject = 'SecureCrowd Security - Reset Your Password';

  const html = `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
      <h2 style="color: #111827;">Hello, ${username}</h2>

      <p style="color: #4B5563; font-size: 15px;">
        We received a request to reset your password. Click the button below to set a new password.
      </p>

      <div style="text-align: center; margin: 24px 0;">
        <a href="${resetLink}" 
           style="
             background-color: #6c63ff;
             color: white;
             padding: 12px 20px;
             text-decoration: none;
             border-radius: 6px;
             font-weight: bold;
             display: inline-block;
           ">
          Reset Password
        </a>
      </div>

      <p style="color: #6B7280; font-size: 13px;">
        If the button doesn't work, copy and paste this link into your browser:
      </p>

      <p style="word-break: break-all; font-size: 13px; color: #2563eb;">
        ${resetLink}
      </p>

      <p style="color: #9CA3AF; font-size: 12px; margin-top: 24px;">
        If you did not request this, you can safely ignore this email.
      </p>
    </div>
  `;

  return sendEmailNodemailer(email, subject, html);
}

module.exports = { sendResetPasswordLink };
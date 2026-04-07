const nodemailer = require('nodemailer');
const process = require('process');

/**
 * Sends an email asynchronously using Nodemailer and Gmail.
 * It does NOT block the main Node process, preventing Render timeouts.
 */
async function sendEmailNodemailer(to, subject, html) {
  const EMAIL_USER = process.env.EMAIL_USER;
  const EMAIL_PASS = process.env.EMAIL_PASS;

  if (!EMAIL_USER || !EMAIL_PASS) {
    console.error('❌ [Email Error] EMAIL_USER or EMAIL_PASS missing from your .env!');
    console.error('Please add your Gmail address and Gmail App Password to your .env file.');
    return false;
  }

  try {
    // Standard configuration for sending via a personal Gmail account
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      },
      // Pool and timeout configs help prevent hanging connections when the network drops
      pool: true,
      maxConnections: 1,
      maxMessages: 10,
    });

    const mailOptions = {
      from: `"SecureCrowd Auth" <${EMAIL_USER}>`,
      to: to, // Now you can send to ANY email address!
      subject: subject,
      html: html,
    };

    // We await this internally, but the outer Controller function explicitly uses .catch()
    // rather than awaiting this outer wrapper, perfectly achieving the background sending.
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email Delivered] Verification code successfully sent to ${to}! (Message ID: ${info.messageId})`);
    
    return true;
  } catch (error) {
    console.error('[Nodemailer Exception]', error.message);
    return false;
  }
}

/**
 * Helper specifically for sending OTPs
 */
async function sendVerificationOTP(email, code, username) {
  const subject = 'SecureCrowd Security - Verify your Email';
  const html = `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
      <h2 style="color: #111827;">Hello, ${username}</h2>
      <p style="color: #4B5563; font-size: 15px;">
        To complete your Organizer account setup and securely login, please verify your email address using the code below.
      </p>
      <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
        <h1 style="margin: 0; font-size: 32px; letter-spacing: 4px; color: #6c63ff;">${code}</h1>
      </div>
      <p style="color: #6B7280; font-size: 12px; margin-top: 32px;">
        This code helps keep your event communications secure. Never share it with anyone.
      </p>
    </div>
  `;

  // Delegate strictly to Nodemailer!
  return sendEmailNodemailer(email, subject, html);
}

module.exports = { sendVerificationOTP };

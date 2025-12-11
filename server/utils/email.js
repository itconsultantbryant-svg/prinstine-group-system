const nodemailer = require('nodemailer');
require('dotenv').config();

// Email transporter configuration
let transporter = null;

if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
} else {
  console.warn('Email configuration not found. Email features will be disabled.');
}

/**
 * Send email
 */
async function sendEmail(to, subject, html, text = null) {
  if (!transporter) {
    console.log('Email not configured. Would send:', { to, subject });
    return false;
  }

  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@prinstine.com',
      to,
      subject,
      text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
      html
    });
    console.log('Email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

/**
 * Send OTP for email verification
 */
async function sendOTP(email, otp) {
  const subject = 'Email Verification - Prinstine Management System';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #007BFF;">Email Verification</h2>
      <p>Thank you for registering with Prinstine Management System.</p>
      <p>Your verification code is:</p>
      <div style="background-color: #FFC107; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; margin: 20px 0;">
        ${otp}
      </div>
      <p>This code will expire in 10 minutes.</p>
      <p>If you did not request this verification, please ignore this email.</p>
    </div>
  `;
  return await sendEmail(email, subject, html);
}

/**
 * Send password reset email
 */
async function sendPasswordReset(email, resetToken, resetUrl) {
  const subject = 'Password Reset - Prinstine Management System';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #007BFF;">Password Reset Request</h2>
      <p>You have requested to reset your password.</p>
      <p>Click the link below to reset your password:</p>
      <a href="${resetUrl}" style="display: inline-block; background-color: #007BFF; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0;">Reset Password</a>
      <p>Or copy this link: ${resetUrl}</p>
      <p>This link will expire in 1 hour.</p>
      <p>If you did not request a password reset, please ignore this email.</p>
    </div>
  `;
  return await sendEmail(email, subject, html);
}

/**
 * Send report approval/rejection notification
 */
async function sendReportNotification(email, reportTitle, status, comments = null) {
  const subject = `Report ${status} - Prinstine Management System`;
  const statusColor = status === 'Approved' ? '#28a745' : '#dc3545';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #007BFF;">Report Status Update</h2>
      <p>Your report "<strong>${reportTitle}</strong>" has been <span style="color: ${statusColor}; font-weight: bold;">${status}</span>.</p>
      ${comments ? `<p><strong>Comments:</strong> ${comments}</p>` : ''}
      <p>Please log in to view details.</p>
    </div>
  `;
  return await sendEmail(email, subject, html);
}

module.exports = {
  sendEmail,
  sendOTP,
  sendPasswordReset,
  sendReportNotification
};


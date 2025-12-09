// Note: dotenv.config() is already called in server.js
const jwt = require('jsonwebtoken');
const { initializeSendGrid, getSendGridClient } = require('../config/emailConfig');

// Initialize SendGrid when needed (not at module load)
let sgMailInitialized = false;
let sgMail = null;

const ensureSendGridInitialized = () => {
  if (!sgMailInitialized) {
    sgMailInitialized = initializeSendGrid();
    sgMail = sgMailInitialized ? getSendGridClient() : null;
  }
  return sgMail;
};

// Send email verification email
const sendVerificationEmail = async (email, userId) => {
  const sgMailClient = ensureSendGridInitialized();
  if (!sgMailClient) {
    console.error('SendGrid client not available for verification email');
    throw new Error('Email service unavailable');
  }

  try {
    const verificationToken = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // Use BACKEND_URL from environment or default to Render URL
    let backendUrl = process.env.BACKEND_URL || 'https://fyp-project-backend.onrender.com';
    backendUrl = backendUrl.replace(/\/*$/, ''); // Remove trailing slashes to avoid paths like //api
    const verificationUrl = `${backendUrl}/api/auth/verify-email?token=${verificationToken}`;

    const msg = {
      to: email,
      from: {
        email: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        name: 'Booking System'
      },
      subject: 'Verify Your Email - Booking System',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Verify Your Email</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
            .button { display: inline-block; background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; font-size: 12px; color: #666; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Welcome to Booking System!</h1>
          </div>
          <div class="content">
            <h2>Please verify your email address</h2>
            <p>Thank you for registering with Booking System. To complete your registration and start booking services, please verify your email address by clicking the button below:</p>
            <a href="${verificationUrl}" class="button">Verify Email Address</a>
            <p><strong>This verification link will expire in 1 hour.</strong></p>
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p>${verificationUrl}</p>
            <p>If you didn't create an account, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>This email was sent to ${email}. If you have any questions, please contact our support team.</p>
            <p>&copy; 2025 Booking System. All rights reserved.</p>
          </div>
        </body>
        </html>
      `,
      text: `Welcome to Booking System!

Thank you for registering. Please verify your email by visiting: ${verificationUrl}

This link will expire in 1 hour.

If you didn't create an account, please ignore this email.`
    };

    const result = await sgMailClient.send(msg);
    console.log('Email verification sent successfully via SendGrid to:', email);
    return result;
  } catch (err) {
    console.error('Error sending email verification to', email, ':', err);
    throw new Error(`Failed to send verification email: ${err.message}`);
  }
};

// Send MFA email with the 6-digit code
const sendMfaEmail = async (email, mfaCode) => {
  const sgMailClient = ensureSendGridInitialized();
  if (!sgMailClient) {
    console.error('SendGrid client not available for MFA email');
    throw new Error('Email service unavailable');
  }

  try {
    const msg = {
      to: email,
      from: {
        email: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        name: 'Booking System Security'
      },
      subject: 'Your Security Code - Booking System',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Your Security Code</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #2196F3; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
            .code { font-size: 24px; font-weight: bold; color: #2196F3; text-align: center; letter-spacing: 3px; background-color: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .warning { background-color: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; font-size: 12px; color: #666; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🔐 Security Verification</h1>
          </div>
          <div class="content">
            <h2>Your Multi-Factor Authentication Code</h2>
            <p>Hello,</p>
            <p>You are attempting to sign in to your Booking System account. For your security, we require additional verification.</p>
            <p>Please enter the following 6-digit code to complete your login:</p>
            <div class="code">${mfaCode}</div>
            <div class="warning">
              <strong>Security Notice:</strong> This code will expire in 72 hours. Do not share this code with anyone. If you did not request this code, please secure your account immediately.
            </div>
            <p>This code was requested for account access at Booking System. If this wasn't you, please contact our support team immediately.</p>
            <p>Thank you for helping us keep your account secure!</p>
          </div>
          <div class="footer">
            <p>This email was sent to ${email} for security purposes.</p>
            <p>&copy; 2025 Booking System. All rights reserved.</p>
          </div>
        </body>
        </html>
      `,
      text: `Security Code for Booking System

Hello,

Your 6-digit MFA code is: ${mfaCode}

This code will expire in 72 hours. Please use it to complete your login.

If you didn't request this code, please secure your account immediately.

Thank you for using Booking System!`
    };

    const result = await sgMailClient.send(msg);
    console.log('MFA email sent successfully via SendGrid to:', email);
    return result;
  } catch (err) {
    console.error('Error sending MFA email to', email, ':', err);
    throw new Error(`Failed to send MFA email: ${err.message}`);
  }
};

// Send password reset email
const sendPasswordResetEmail = async (email, resetToken) => {
  const sgMailClient = ensureSendGridInitialized();
  if (!sgMailClient) {
    console.error('SendGrid client not available for password reset email');
    throw new Error('Email service unavailable');
  }

  try {
    // Use BACKEND_URL from environment or default to Render URL
    let frontendUrl = process.env.FRONTEND_URL || 'https://fyp-project-nine-gray.vercel.app';
    frontendUrl = frontendUrl.replace(/\/*$/, ''); // Remove trailing slashes
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

    const msg = {
      to: email,
      from: {
        email: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        name: 'Booking System Security'
      },
      subject: 'Password Reset Request - Booking System',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Password Reset Request</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #FF9800; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
            .button { display: inline-block; background-color: #FF9800; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .warning { background-color: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; font-size: 12px; color: #666; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🔒 Password Reset Request</h1>
          </div>
          <div class="content">
            <h2>Reset Your Password</h2>
            <p>Hello,</p>
            <p>We received a request to reset your password for your Booking System account. Click the button below to create a new password:</p>
            <a href="${resetUrl}" class="button">Reset Password</a>
            <p><strong>This link will expire in 15 minutes.</strong></p>
            <div class="warning">
              <strong>Security Notice:</strong> After resetting your password, you will need to verify your identity using the MFA code sent to your email.
            </div>
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p>${resetUrl}</p>
            <p><strong>If you didn't request a password reset, please ignore this email.</strong> Your password will remain unchanged.</p>
          </div>
          <div class="footer">
            <p>This email was sent to ${email} for security purposes.</p>
            <p>&copy; 2025 Booking System. All rights reserved.</p>
          </div>
        </body>
        </html>
      `,
      text: `Password Reset Request - Booking System

Hello,

We received a request to reset your password. Click this link to reset your password:

${resetUrl}

This link will expire in 15 minutes.

IMPORTANT: After resetting your password, you will need to verify your identity using the MFA code sent to your email.

If you didn't request this, please ignore this email.

Thank you for using Booking System!`
    };

    const result = await sgMailClient.send(msg);
    console.log('Password reset email sent successfully via SendGrid to:', email);
    return result;
  } catch (err) {
    console.error('Error sending password reset email to', email, ':', err);
    throw new Error(`Failed to send password reset email: ${err.message}`);
  }
};

module.exports = { sendVerificationEmail, sendMfaEmail, sendPasswordResetEmail };

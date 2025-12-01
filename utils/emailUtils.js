const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const { initializeSendGrid, getSendGridClient } = require('../config/emailConfig');

dotenv.config();

// Initialize SendGrid using configuration
const sgMailInitialized = initializeSendGrid();
const sgMail = sgMailInitialized ? getSendGridClient() : null;

// Send email verification email
const sendVerificationEmail = (email, userId) => {
  const verificationToken = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
  
  // Use BACKEND_URL from environment or default to Render URL
  const backendUrl = process.env.BACKEND_URL || 'https://fyp-project-backend.onrender.com';

  const msg = {
    to: email,
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    subject: 'Verify Your Email',
    html: `<p>Please verify your email by clicking the link below:</p>
           <a href="${backendUrl}/api/auth/verify-email?token=${verificationToken}">Verify Email</a>`,
  };

  sgMail
    .send(msg)
    .then(() => console.log('Email verification sent via SendGrid'))
    .catch((err) => console.error('Error sending email verification:', err));
};

// Send MFA email with the 6-digit code
const sendMfaEmail = (email, mfaCode) => {
  const msg = {
    to: email,
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    subject: 'Your MFA Code',
    html: `<p>Your 6-digit MFA code is: <strong>${mfaCode}</strong></p>`,
  };

  return sgMail
    .send(msg)
    .then((res) => {
      console.log('MFA email sent via SendGrid');
      return res;
    })
    .catch((err) => {
      console.error('Error sending MFA email:', err);
      throw err;
    });
};

module.exports = { sendVerificationEmail, sendMfaEmail };

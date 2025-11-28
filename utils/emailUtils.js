const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');

dotenv.config();

// Create reusable transporter object using SMTP transport
const transporter = nodemailer.createTransport({
  service: 'gmail', // Or any other email service
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Send email verification email
const sendVerificationEmail = (email, userId) => {
  const verificationToken = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Verify Your Email',
    html: `<p>Please verify your email by clicking the link below:</p>
           <a href="http://localhost:5000/api/auth/verify-email?token=${verificationToken}">Verify Email</a>`,
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.error('Error sending email verification:', err);
    } else {
      console.log('Email verification sent:', info.response);
    }
  });
};

// Send MFA email with the 6-digit code
const sendMfaEmail = (email, mfaCode) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Your MFA Code',
    html: `<p>Your 6-digit MFA code is: <strong>${mfaCode}</strong></p>`,
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.error('Error sending MFA email:', err);
    } else {
      console.log('MFA email sent:', info.response);
    }
  });
};

module.exports = { sendVerificationEmail, sendMfaEmail };

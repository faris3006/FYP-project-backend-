const express = require('express');
const { sendVerificationEmail } = require('./emailVerification');
const { verifyEmail } = require('./emailVerification');
const { generateMFA, validateMFA } = require('./mfaVerification');
const router = express.Router();

// User registration and email verification
router.post('/register', async (req, res) => {
  // Register logic here
  // After registration, send verification email
  sendVerificationEmail(req.body.email, req.body.userId);
  res.status(200).json({ message: 'Registration successful, please check your email for verification.' });
});

// Verify email
router.get('/verify-email', verifyEmail);

// MFA generation and validation
router.post('/mfa-verify', async (req, res) => {
  const { userId, mfaCode } = req.body;
  const result = await validateMFA(userId, mfaCode);
  if (result.success) {
    res.status(200).json({ message: 'MFA verified successfully' });
  } else {
    res.status(400).json({ message: result.message });
  }
});

module.exports = router;

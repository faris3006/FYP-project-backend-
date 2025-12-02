const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendVerificationEmail, sendMfaEmail } = require('../utils/emailUtils');

const router = express.Router();

// User Registration Route
router.post('/register', async (req, res) => {
  const { name, phone, email, password } = req.body;

  if (!name || !email || !password || !phone) {
    return res.status(400).json({ message: 'Please fill in all fields.' });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already in use.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      phone,
      email,
      password: hashedPassword,
      isVerified: false,
      mfaCode: undefined,
      mfaExpiry: undefined,
      lastMfaVerifiedAt: undefined,
      role: 'user',
    });

    await user.save();

    // Send verification email and handle errors properly
    try {
      await sendVerificationEmail(user.email, user._id);
      console.log('Verification email sent successfully to:', email);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Don't fail registration if email fails, but log it
      // User can still verify later or request resend
    }

    res.status(201).json({
      message: 'Registration successful! Please check your email for verification instructions.',
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      message: 'Server error during registration',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
});

// User Login Route
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Please provide email and password.' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password.' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ message: 'Please verify your email before logging in.' });
    }

    const now = new Date();

    let mfaValidUntil = null;
    if (user.lastMfaVerifiedAt) {
      mfaValidUntil = new Date(user.lastMfaVerifiedAt);
      mfaValidUntil.setHours(mfaValidUntil.getHours() + 72); // 72 hours after last MFA verification
    }

    // Require MFA if no previous verification or expired
    if (!user.lastMfaVerifiedAt || now > mfaValidUntil) {
      const mfaCode = Math.floor(100000 + Math.random() * 900000).toString();
      const mfaExpiry = new Date();
      mfaExpiry.setHours(mfaExpiry.getHours() + 72);

      user.mfaCode = mfaCode;
      user.mfaExpiry = mfaExpiry;
      await user.save({ validateBeforeSave: false });

      await sendMfaEmail(user.email, mfaCode);

      return res.status(200).json({
        message: 'Login successful! Please verify your MFA code.',
        mfaRequired: true,
        userId: user._id,
      });
    }

    // MFA still valid, skip MFA and generate token
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.status(200).json({
      message: 'Login successful!',
      token,
      mfaRequired: false,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
});

// Email Verification Route
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ message: 'Missing token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isVerified = true;
    await user.save();

    res.status(200).json({ message: 'Email verified successfully!' });
  } catch (err) {
    res.status(400).json({ message: 'Invalid or expired token' });
  }
});

// MFA Verification Route
router.post('/verify-mfa', async (req, res) => {
  const { mfaCode, userId } = req.body;

  console.log('MFA verification attempt for userId:', userId, 'with code:', mfaCode);

  if (!mfaCode || !userId) {
    console.log('Missing MFA code or userId');
    return res.status(400).json({ message: 'MFA code and user ID are required.' });
  }

  try {
    const user = await User.findById(userId);
    console.log('User found:', user ? 'yes' : 'no');

    if (!user) {
      console.log('User not found for MFA verification');
      return res.status(400).json({ message: 'Invalid user.' });
    }

    if (!user.mfaCode || user.mfaCode !== mfaCode) {
      console.log('Invalid MFA code. Expected:', user.mfaCode, 'Received:', mfaCode);
      return res.status(400).json({ message: 'Invalid MFA code.' });
    }

    // Check if MFA code has expired
    if (user.mfaExpiry && new Date() > user.mfaExpiry) {
      console.log('MFA code expired');
      return res.status(400).json({ message: 'MFA code has expired. Please login again.' });
    }

    // Clear MFA data and update verification timestamp
    user.mfaCode = undefined;
    user.mfaExpiry = undefined;
    user.lastMfaVerifiedAt = new Date();

    console.log('Saving user after MFA verification...');
    await user.save({ validateBeforeSave: false });
    console.log('User saved successfully');

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    console.log('MFA verification successful for user:', userId);

    res.status(200).json({
      message: 'MFA verified successfully!',
      token,
    });
  } catch (error) {
    console.error('MFA verification error:', error);
    res.status(500).json({
      message: 'Server error during MFA verification',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
});

module.exports = router;

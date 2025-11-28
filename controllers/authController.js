const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendVerificationEmail } = require('../utils/emailUtils');
const { generateMFA, validateMFA } = require('../utils/mfaUtils');

// Register user
const registerUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already in use' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const user = new User({
      email,
      password: hashedPassword,
      isVerified: false,
    });

    await user.save();

    // Send verification email with JWT token link
    sendVerificationEmail(user.email, user._id);

    res.status(201).json({ message: 'Registration successful, please verify your email.' });
  } catch (error) {
    console.error('Error in registerUser:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
};

// Login user
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid password' });
    }

    if (!user.isVerified) {
      return res.status(400).json({ message: 'Please verify your email before login' });
    }

    // Generate MFA code and send via email
    await generateMFA(user);

    res.status(200).json({ message: 'Login successful, check your email for MFA code.', userId: user._id });
  } catch (error) {
    console.error('Error in loginUser:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
};

// Email verification logic
const verifyEmail = async (req, res) => {
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

    if (user.isVerified) {
      return res.status(400).json({ message: 'Email already verified' });
    }

    user.isVerified = true;
    await user.save();

    res.status(200).json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error('Error in verifyEmail:', error);
    res.status(400).json({ message: 'Invalid or expired token' });
  }
};

// MFA verification endpoint
const sendMFA = async (req, res) => {
  try {
    const { userId, mfaCode } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Validate MFA code
    const isValidMFA = await validateMFA(user, mfaCode);
    if (!isValidMFA.success) {
      return res.status(400).json({ message: isValidMFA.message });
    }

    res.status(200).json({ message: 'MFA verified successfully' });
  } catch (error) {
    console.error('Error in sendMFA:', error);
    res.status(500).json({ message: 'Server error during MFA verification' });
  }
};

module.exports = { registerUser, loginUser, verifyEmail, sendMFA };

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

    // Check if permanently locked
    if (user.permanentlyLocked) {
      return res.status(403).json({ 
        message: 'Your account is permanently locked due to multiple failed login attempts. Please use "Forgot Password" to reset your password.',
        isPermanentlyLocked: true 
      });
    }

    // Check if temporarily locked
    if (user.temporaryLockUntil && new Date() < user.temporaryLockUntil) {
      const remainingTime = Math.ceil((user.temporaryLockUntil - new Date()) / 1000 / 60); // minutes
      return res.status(403).json({ 
        message: 'You cannot enter the password',
        isTemporarilyLocked: true,
        remainingMinutes: remainingTime,
        lockUntil: user.temporaryLockUntil
      });
    }

    // If temporary lock has expired, reset for second chance
    if (user.temporaryLockUntil && new Date() >= user.temporaryLockUntil && user.lockoutStage === 1) {
      user.failedLoginAttempts = 0;
      user.temporaryLockUntil = null;
      // Keep lockoutStage at 1 to track that this is the second chance
      await user.save();
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      // Increment failed attempts
      user.failedLoginAttempts += 1;

      // First set of 3 attempts (lockoutStage 0)
      if (user.lockoutStage === 0 && user.failedLoginAttempts >= 3) {
        // Apply 5-minute temporary lock
        user.temporaryLockUntil = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
        user.lockoutStage = 1;
        await user.save();
        
        return res.status(403).json({ 
          message: 'Too many failed attempts. Your account is temporarily locked for 5 minutes.',
          isTemporarilyLocked: true,
          remainingMinutes: 5,
          lockUntil: user.temporaryLockUntil
        });
      }

      // Second set of 3 attempts (lockoutStage 1, after 5-min lock expired)
      if (user.lockoutStage === 1 && user.failedLoginAttempts >= 3) {
        // Apply permanent lock
        user.permanentlyLocked = true;
        user.lockoutStage = 2;
        await user.save();
        
        return res.status(403).json({ 
          message: 'Your account is permanently locked due to multiple failed login attempts. Please use "Forgot Password" to reset your password.',
          isPermanentlyLocked: true
        });
      }

      await user.save();
      
      const remainingAttempts = 3 - user.failedLoginAttempts;
      return res.status(400).json({ 
        message: 'Invalid password',
        remainingAttempts: remainingAttempts > 0 ? remainingAttempts : 0
      });
    }

    if (!user.isVerified) {
      return res.status(400).json({ message: 'Please verify your email before login' });
    }

    // Password is correct - reset all lockout fields
    user.failedLoginAttempts = 0;
    user.temporaryLockUntil = null;
    user.permanentlyLocked = false;
    user.lockoutStage = 0;
    await user.save();

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

    // Check if user already has an active session on another device
    if (user.activeSessionToken) {
      return res.status(403).json({ 
        message: 'Account is already logged in on another device or browser. Please logout from that device first.',
        isActiveSessionBlocked: true
      });
    }

    // Validate MFA code
    const isValidMFA = await validateMFA(user, mfaCode);
    if (!isValidMFA.success) {
      return res.status(400).json({ message: isValidMFA.message });
    }

    // Generate JWT token and store it as active session
    const token = jwt.sign({ userId: user._id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
    
    // Store active session info
    user.activeSessionToken = token;
    user.activeDevice = req.headers['user-agent'] || 'Unknown Device';
    user.sessionCreatedAt = new Date();
    await user.save();

    res.status(200).json({ 
      message: 'MFA verified successfully',
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Error in sendMFA:', error);
    res.status(500).json({ message: 'Server error during MFA verification' });
  }
};

// Logout user
const logoutUser = async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Clear active session
    user.activeSessionToken = null;
    user.activeDevice = null;
    user.sessionCreatedAt = null;
    await user.save();

    res.status(200).json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Error in logoutUser:', error);
    res.status(500).json({ message: 'Server error during logout' });
  }
};

module.exports = { registerUser, loginUser, verifyEmail, sendMFA, logoutUser };

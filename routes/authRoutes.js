const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { sendVerificationEmail, sendMfaEmail, sendPasswordResetEmail } = require('../utils/emailUtils');
const authenticateJWT = require('../middleware/authenticateJWT');

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

// User Login Route with temporary/permanent lockout enforcement
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Please provide email and password.' });
  }

  try {
    const user = await User.findOne({ email });
    let currentUser = user;

    // Auto-create admin user on first login if configured via environment variables
    if (!currentUser && email === process.env.ADMIN_EMAIL) {
      try {
        const adminPassword = process.env.ADMIN_PASSWORD;
        const adminName = process.env.ADMIN_NAME || 'Admin User';
        const adminPhone = process.env.ADMIN_PHONE || '0000000000';

        if (!adminPassword) {
          console.error('ADMIN_PASSWORD is not set. Cannot auto-create admin user.');
          return res.status(500).json({ message: 'Admin account is not configured on the server.' });
        }

        const hashedAdminPassword = await bcrypt.hash(adminPassword, 10);

        const adminUser = new User({
          name: adminName,
          phone: adminPhone,
          email,
          password: hashedAdminPassword,
          role: 'admin',
          isVerified: true,
        });

        await adminUser.save();
        console.log('Admin user auto-created during login for email:', email);
        currentUser = adminUser;
      } catch (createErr) {
        console.error('Error auto-creating admin user:', createErr);
        return res.status(500).json({ message: 'Failed to create admin account.' });
      }
    }

    if (!currentUser) {
      return res.status(400).json({ message: 'Invalid email or password.' });
    }

    // Permanent lock check
    if (currentUser.permanentlyLocked) {
      return res.status(403).json({
        message: 'Your account is permanently locked due to multiple failed login attempts. Please use "Forgot Password" to reset your password.',
        isPermanentlyLocked: true,
      });
    }

    // Temporary lock check
    if (currentUser.temporaryLockUntil && new Date() < currentUser.temporaryLockUntil) {
      const remainingTime = Math.ceil((currentUser.temporaryLockUntil - new Date()) / 1000 / 60);
      return res.status(403).json({
        message: 'You cannot enter the password',
        isTemporarilyLocked: true,
        remainingMinutes: remainingTime,
        lockUntil: currentUser.temporaryLockUntil,
      });
    }

    // If temporary lock expired after first lockout, reset attempts for second chance
    if (currentUser.temporaryLockUntil && new Date() >= currentUser.temporaryLockUntil && currentUser.lockoutStage === 1) {
      currentUser.failedLoginAttempts = 0;
      currentUser.temporaryLockUntil = null;
      await currentUser.save();
    }

    // Password check with lockout updates
    const isMatch = await bcrypt.compare(password, currentUser.password);
    if (!isMatch) {
      currentUser.failedLoginAttempts += 1;

      // First set of 3 attempts -> 5-minute lock
      if (currentUser.lockoutStage === 0 && currentUser.failedLoginAttempts >= 3) {
        currentUser.temporaryLockUntil = new Date(Date.now() + 5 * 60 * 1000);
        currentUser.lockoutStage = 1;
        await currentUser.save();

        return res.status(403).json({
          message: 'Too many failed attempts. Your account is temporarily locked for 5 minutes.',
          isTemporarilyLocked: true,
          remainingMinutes: 5,
          lockUntil: currentUser.temporaryLockUntil,
        });
      }

      // Second set of 3 attempts after temp lock -> permanent lock
      if (currentUser.lockoutStage === 1 && currentUser.failedLoginAttempts >= 3) {
        currentUser.permanentlyLocked = true;
        currentUser.lockoutStage = 2;
        await currentUser.save();

        return res.status(403).json({
          message: 'Your account is permanently locked due to multiple failed login attempts. Please use "Forgot Password" to reset your password.',
          isPermanentlyLocked: true,
        });
      }

      await currentUser.save();

      const remainingAttempts = 3 - currentUser.failedLoginAttempts;
      return res.status(400).json({
        message: 'Invalid email or password.',
        remainingAttempts: remainingAttempts > 0 ? remainingAttempts : 0,
      });
    }

    if (!currentUser.isVerified) {
      return res.status(403).json({ message: 'Please verify your email before logging in.' });
    }

    // Successful password: reset lockout fields
    currentUser.failedLoginAttempts = 0;
    currentUser.temporaryLockUntil = null;
    currentUser.permanentlyLocked = false;
    currentUser.lockoutStage = 0;

    // Enforce single active session per account
    if (currentUser.activeSessionToken) {
      return res.status(403).json({
        message: 'Account is already logged in on another device or browser. Please logout there first.',
        isActiveSessionBlocked: true,
      });
    }

    const now = new Date();

    let mfaValidUntil = null;
    if (currentUser.lastMfaVerifiedAt) {
      mfaValidUntil = new Date(currentUser.lastMfaVerifiedAt);
      mfaValidUntil.setHours(mfaValidUntil.getHours() + 72); // 72 hours after last MFA verification
    }

    // Require MFA if no previous verification or expired
    if (!currentUser.lastMfaVerifiedAt || now > mfaValidUntil) {
      const mfaCode = Math.floor(100000 + Math.random() * 900000).toString();
      const mfaExpiry = new Date();
      mfaExpiry.setHours(mfaExpiry.getHours() + 72);

      currentUser.mfaCode = mfaCode;
      currentUser.mfaExpiry = mfaExpiry;
      await currentUser.save({ validateBeforeSave: false });

      await sendMfaEmail(currentUser.email, mfaCode);

      return res.status(200).json({
        message: 'Login successful! Please verify your MFA code.',
        mfaRequired: true,
        userId: currentUser._id,
      });
    }

    // MFA still valid, skip MFA and generate token
    // MFA still valid, skip MFA and generate token, also store as active session
    const token = jwt.sign(
      { userId: currentUser._id, role: currentUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    currentUser.activeSessionToken = token;
    currentUser.activeDevice = req.headers['user-agent'] || 'Unknown Device';
    currentUser.sessionCreatedAt = new Date();

    await currentUser.save({ validateBeforeSave: false });

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
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Verification Failed</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
          .error { background-color: #f8d7da; color: #721c24; padding: 20px; border-radius: 5px; border: 1px solid #f5c6cb; }
          .success { background-color: #d4edda; color: #155724; padding: 20px; border-radius: 5px; border: 1px solid #c3e6cb; }
          h1 { color: #333; }
        </style>
      </head>
      <body>
        <div class="error">
          <h1>Verification Failed</h1>
          <p>Missing verification token. Please check your email and use the complete verification link.</p>
        </div>
      </body>
      </html>
    `);
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Verification Failed</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
            .error { background-color: #f8d7da; color: #721c24; padding: 20px; border-radius: 5px; border: 1px solid #f5c6cb; }
            h1 { color: #333; }
          </style>
        </head>
        <body>
          <div class="error">
            <h1>Verification Failed</h1>
            <p>User not found. Please contact support if you believe this is an error.</p>
          </div>
        </body>
        </html>
      `);
    }

    if (user.isVerified) {
      return res.status(200).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Email Already Verified</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
            .success { background-color: #d4edda; color: #155724; padding: 20px; border-radius: 5px; border: 1px solid #c3e6cb; }
            h1 { color: #333; }
          </style>
        </head>
        <body>
          <div class="success">
            <h1>Email Already Verified</h1>
            <p>Your email has already been verified. You can now log in to your account.</p>
            <p><a href="https://fyp-project-nine-gray.vercel.app/login" style="color: #155724; text-decoration: underline;">Go to Login Page</a></p>
          </div>
        </body>
        </html>
      `);
    }

    user.isVerified = true;
    await user.save();

    res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Email Verified Successfully</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
          .success { background-color: #d4edda; color: #155724; padding: 20px; border-radius: 5px; border: 1px solid #c3e6cb; }
          .button { display: inline-block; background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          h1 { color: #333; }
        </style>
      </head>
      <body>
        <div class="success">
          <h1>✓ Email Verified Successfully!</h1>
          <p>Your email has been verified. You can now log in to your account.</p>
          <a href="https://fyp-project-nine-gray.vercel.app/login" class="button">Go to Login Page</a>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    res.status(400).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Verification Failed</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
          .error { background-color: #f8d7da; color: #721c24; padding: 20px; border-radius: 5px; border: 1px solid #f5c6cb; }
          h1 { color: #333; }
        </style>
      </head>
      <body>
        <div class="error">
          <h1>Verification Failed</h1>
          <p>Invalid or expired verification token. The verification link may have expired (valid for 1 hour).</p>
          <p>Please request a new verification email or contact support for assistance.</p>
        </div>
      </body>
      </html>
    `);
  }
});

// MFA Verification Route
router.post('/verify-mfa', async (req, res) => {
  // Accept multiple possible field names from frontend to be more robust
  const {
    mfaCode: bodyMfaCode,
    code,
    otp,
    userId: bodyUserId,
    userID,
    id,
  } = req.body || {};

  const mfaCode = (bodyMfaCode || code || otp || '').toString().trim();
  const userId = (bodyUserId || userID || id || '').toString().trim();

  console.log('MFA verification attempt for userId:', userId || '(none)', 'with code:', mfaCode || '(none)');

  if (!mfaCode || !userId) {
    console.log('Missing MFA code or userId in request body. Body received:', req.body);
    return res.status(400).json({ message: 'MFA code and user ID are required.' });
  }

  try {
    const user = await User.findById(userId);
    console.log('User found:', user ? 'yes' : 'no');

    if (!user) {
      console.log('User not found for MFA verification');
      return res.status(400).json({ message: 'Invalid user.' });
    }

    // Enforce single active session per account
    if (user.activeSessionToken) {
      return res.status(403).json({
        message: 'Account is already logged in on another device or browser. Please logout there first.',
        isActiveSessionBlocked: true,
      });
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

    // Store active session info
    user.activeSessionToken = token;
    user.activeDevice = req.headers['user-agent'] || 'Unknown Device';
    user.sessionCreatedAt = new Date();

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

// Forgot Password Route - Generate reset token and send email
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Please provide your email address.' });
  }

  try {
    const user = await User.findOne({ email });

    // Always return success to prevent email enumeration attacks
    if (!user) {
      return res.json({ 
        message: 'If an account with that email exists, a password reset link has been sent.' 
      });
    }

    // Generate secure random reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    user.resetToken = resetToken;
    user.resetTokenExpiry = resetTokenExpiry;
    await user.save();

    // Send password reset email
    try {
      await sendPasswordResetEmail(user.email, resetToken);
      console.log('Password reset email sent to:', email);
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
      return res.status(500).json({ message: 'Failed to send reset email. Please try again.' });
    }

    res.json({ 
      message: 'If an account with that email exists, a password reset link has been sent.' 
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      message: 'Server error during password reset request',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
});

// Reset Password Route - Validate token and update password
router.post('/reset-password', async (req, res) => {
  const { token, newPassword, confirmPassword } = req.body;

  if (!token || !newPassword || !confirmPassword) {
    return res.status(400).json({ message: 'Please provide all required fields.' });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: 'Passwords do not match.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
  }

  try {
    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: Date.now() } // Token must not be expired
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token.' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and clear MFA verification (force re-verify)
    user.password = hashedPassword;
    user.lastMfaVerifiedAt = null; // FORCE MFA RE-VERIFICATION
    user.resetToken = null; // Clear reset token
    user.resetTokenExpiry = null; // Clear expiry
    
    // Reset all lockout fields when password is reset
    user.failedLoginAttempts = 0;
    user.temporaryLockUntil = null;
    user.permanentlyLocked = false;
    user.lockoutStage = 0;
    
    await user.save();

    console.log('Password reset successful for user:', user.email);

    res.json({ 
      message: 'Password reset successful! Please login with your new password. You will need to verify your identity with MFA.',
      accountUnlocked: true,
      clearCache: true,
      attemptCounterReset: true,
      lockoutCleared: true
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      message: 'Server error during password reset',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
});

// Logout Route
router.post('/logout', authenticateJWT, async (req, res) => {
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
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Server error during logout' });
  }
});

module.exports = router;

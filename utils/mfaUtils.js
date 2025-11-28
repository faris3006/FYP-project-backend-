const crypto = require('crypto');
const User = require('../models/User');

// Generate a random MFA code (e.g., 6-character code)
const generateMFA = async (user) => {
  const mfaCode = crypto.randomBytes(3).toString('hex'); // Generate a 6-digit MFA code
  user.mfaCode = mfaCode;
  await user.save();

  // Send the MFA code to the user's email (similar to email verification)
  // You can use the sendVerificationEmail function or create a separate function to send the MFA code
};

// Validate MFA code
const validateMFA = async (user, enteredCode) => {
  if (user.mfaCode !== enteredCode) {
    return { success: false, message: 'Invalid MFA code' };
  }

  // Clear the MFA code after successful validation
  user.mfaCode = null;
  await user.save();
  return { success: true, message: 'MFA verified successfully' };
};

module.exports = { generateMFA, validateMFA };

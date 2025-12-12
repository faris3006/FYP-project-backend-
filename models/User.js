const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  isVerified: { type: Boolean, default: false },
  mfaCode: { type: String },
  mfaExpiry: { type: Date },
  lastMfaVerifiedAt: { type: Date },
  resetToken: { type: String, default: null },
  resetTokenExpiry: { type: Date, default: null },
  // Login lockout fields
  failedLoginAttempts: { type: Number, default: 0 },
  temporaryLockUntil: { type: Date, default: null },
  permanentlyLocked: { type: Boolean, default: false },
  lockoutStage: { type: Number, default: 0 }, // 0 = no failures, 1 = after first 3 failures, 2 = permanently locked
  // Single active session fields
  activeSessionToken: { type: String, default: null },
  activeDevice: { type: String, default: null },
  sessionCreatedAt: { type: Date, default: null },
});

module.exports = mongoose.model('User', userSchema);

const mongoose = require('mongoose');

const loginAttemptSchema = new mongoose.Schema(
  {
    email: { type: String, required: false }, // may be empty or invalid
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
    ip: { type: String, required: false },
    userAgent: { type: String, required: false },
    success: { type: Boolean, required: true },
    reason: { type: String, enum: [
      'invalid-credentials',
      'temporary-locked',
      'permanent-locked',
      'password-accepted',
      'mfa-required'
    ], required: true },
    metadata: { type: Object, default: {} },
  },
  { timestamps: true }
);

loginAttemptSchema.index({ email: 1, createdAt: -1 });
loginAttemptSchema.index({ ip: 1, createdAt: -1 });

module.exports = mongoose.model('LoginAttempt', loginAttemptSchema);

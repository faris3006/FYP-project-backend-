const mongoose = require('mongoose');

const blockedIpSchema = new mongoose.Schema(
  {
    ip: { type: String, required: true, unique: true, index: true },
    blockedUntil: { type: Date, required: true, index: true },
    reason: { type: String, default: 'Too many failed login attempts' },
    attemptCount: { type: Number, default: 0 },
    metadata: { type: Object, default: {} },
  },
  { timestamps: true }
);

// Auto-remove expired blocks
blockedIpSchema.index({ blockedUntil: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('BlockedIp', blockedIpSchema);

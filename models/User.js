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
});

module.exports = mongoose.model('User', userSchema);

const mongoose = require('mongoose');

const receiptSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    url: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const bookingSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    serviceName: { type: String, required: true },
    serviceDetails: { type: String },
    scheduledDate: { type: Date },
    totalAmount: { type: Number, required: true },
    notes: { type: String },
    paymentStatus: {
      type: String,
      enum: ['pending', 'receipt_submitted', 'completed'],
      default: 'pending',
    },
    paymentCompletedAt: { type: Date },
    receiptUploads: { type: [receiptSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Booking', bookingSchema);

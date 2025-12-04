const mongoose = require('mongoose');
const Booking = require('../models/Booking');

// Helper to parse optional dates safely
function parseDate(value) {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

exports.createBooking = async (req, res) => {
  const { serviceName, serviceDetails, scheduledDate, totalAmount, notes } = req.body;
  const amount = Number(totalAmount);

  if (!serviceName || Number.isNaN(amount)) {
    return res.status(400).json({ message: 'Service name and total amount are required.' });
  }

  // Ensure userId exists in the authenticated user's token
  if (!req.user || !req.user.userId) {
    return res.status(401).json({ message: 'Unauthorized: User ID not found in token' });
  }

  try {
    // Convert userId string to MongoDB ObjectId for proper comparison
    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const booking = await Booking.create({
      userId: userId,
      serviceName,
      serviceDetails,
      scheduledDate: parseDate(scheduledDate),
      totalAmount: amount,
      notes,
      paymentStatus: 'pending',
    });

    // Convert to plain object to ensure clean serialization
    const bookingData = booking.toObject();
    res.status(201).json({ message: 'Booking created', booking: bookingData });
  } catch (error) {
    console.error('createBooking error:', error);
    res.status(500).json({ message: 'Unable to create booking' });
  }
};

exports.getUserBookings = async (req, res) => {
  try {
    // Ensure userId exists in the authenticated user's token
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ message: 'Unauthorized: User ID not found in token' });
    }

    // Explicitly filter by the authenticated user's ID only
    // Convert userId string to MongoDB ObjectId for proper comparison
    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const bookings = await Booking.find({ userId: userId }).sort({ createdAt: -1 });
    
    // Convert to plain objects to ensure clean serialization
    const bookingsData = bookings.map(booking => booking.toObject());
    res.json({ bookings: bookingsData });
  } catch (error) {
    console.error('getUserBookings error:', error);
    res.status(500).json({ message: 'Unable to load bookings' });
  }
};

exports.getBookingById = async (req, res) => {
  try {
    // Ensure userId exists in the authenticated user's token
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ message: 'Unauthorized: User ID not found in token' });
    }

    // Explicitly ensure the booking belongs to the authenticated user
    // Convert userId string to MongoDB ObjectId for proper comparison
    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const booking = await Booking.findOne({
      _id: req.params.id,
      userId: userId,
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Convert to plain object to ensure clean serialization
    const bookingData = booking.toObject();
    res.json({ booking: bookingData });
  } catch (error) {
    console.error('getBookingById error:', error);
    res.status(500).json({ message: 'Unable to fetch booking' });
  }
};

exports.uploadReceipt = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Receipt file is required.' });
  }

  try {
    // Ensure userId exists in the authenticated user's token
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ message: 'Unauthorized: User ID not found in token' });
    }

    // Explicitly ensure the booking belongs to the authenticated user
    // Convert userId string to MongoDB ObjectId for proper comparison
    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const booking = await Booking.findOne({
      _id: req.params.id,
      userId: userId,
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    let backendUrl = process.env.BACKEND_URL || 'https://fyp-project-backend.onrender.com';
    backendUrl = backendUrl.replace(/\/*$/, ''); // ensure no trailing slash
    const receiptUrl = `${backendUrl}/uploads/receipts/${req.file.filename}`;

    booking.receiptUploads.push({
      filename: req.file.filename,
      url: receiptUrl,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedAt: new Date(),
    });

    booking.paymentStatus = 'receipt_submitted';
    await booking.save();

    // Convert to plain object to ensure clean serialization
    const bookingData = booking.toObject();
    res.json({ message: 'Receipt uploaded', booking: bookingData });
  } catch (error) {
    console.error('uploadReceipt error:', error);
    res.status(500).json({ message: 'Unable to upload receipt' });
  }
};

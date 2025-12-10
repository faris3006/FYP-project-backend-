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

  // Validate required fields
  if (!serviceName || !serviceName.trim()) {
    return res.status(400).json({
      success: false,
      errorCode: 'VALIDATION_ERROR',
      message: 'Service name is required.',
      field: 'serviceName'
    });
  }

  if (Number.isNaN(amount) || amount <= 0) {
    return res.status(400).json({
      success: false,
      errorCode: 'VALIDATION_ERROR',
      message: 'Valid total amount greater than 0 is required.',
      field: 'totalAmount'
    });
  }

  // Ensure userId exists in the authenticated user's token
  if (!req.user || !req.user.userId) {
    return res.status(401).json({ 
      success: false,
      errorCode: 'UNAUTHORIZED',
      message: 'Unauthorized: User ID not found in token'
    });
  }

  try {
    // Convert userId string to MongoDB ObjectId for proper comparison
    const userId = new mongoose.Types.ObjectId(req.user.userId);
    
    // Create booking with validation
    const booking = await Booking.create({
      userId: userId,
      serviceName: serviceName.trim(),
      serviceDetails: serviceDetails ? serviceDetails.trim() : undefined,
      scheduledDate: parseDate(scheduledDate),
      totalAmount: amount,
      notes: notes ? notes.trim() : undefined,
      paymentStatus: 'pending',
    });

    // Verify booking was actually saved
    if (!booking || !booking._id) {
      throw new Error('Booking creation failed - no ID returned');
    }

    console.log(`Booking created successfully: ID=${booking._id}, User=${userId}, Amount=${amount}`);

    // Convert to plain object to ensure clean serialization
    const bookingData = booking.toObject();
    
    // Return comprehensive response
    res.status(201).json({ 
      message: 'Booking created successfully',
      success: true,
      booking: bookingData,
      bookingId: booking._id.toString(),  //  Explicit booking ID for frontend
      paymentStatus: 'pending'
    });
  } catch (error) {
    console.error('createBooking error:', error);
    
    // Return detailed error for debugging
    res.status(500).json({ 
      success: false,
      errorCode: 'BOOKING_CREATE_FAILED',
      message: 'Unable to create booking',
      error: process.env.NODE_ENV === 'production' 
        ? 'An error occurred while creating your booking. Please try again.'
        : error.message
    });
  }
};

exports.getUserBookings = async (req, res) => {
  try {
    // Ensure userId exists in the authenticated user's token
      if (!req.user || !req.user.userId) {
        return res.status(401).json({ 
          success: false,
          errorCode: 'UNAUTHORIZED',
          message: 'Unauthorized: User ID not found in token'
        });
    }

    // Explicitly filter by the authenticated user's ID only
    // Convert userId string to MongoDB ObjectId for proper comparison
    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const bookings = await Booking.find({ userId: userId }).sort({ createdAt: -1 });
    
    // Convert to plain objects to ensure clean serialization
    const bookingsData = bookings.map(booking => booking.toObject());
    
    console.log(`Fetched ${bookings.length} bookings for user ${userId}`);
    
    res.json({ 
      success: true,
      message: `Retrieved ${bookings.length} booking(s)`,
      bookings: bookingsData,
      count: bookings.length
    });
  } catch (error) {
    console.error('getUserBookings error:', error);
      res.status(500).json({ 
        success: false,
        errorCode: 'BOOKINGS_FETCH_FAILED',
        message: 'Unable to load bookings',
        error: process.env.NODE_ENV === 'production' 
          ? 'An error occurred while loading bookings.'
          : error.message
      });
  }
};

exports.getBookingById = async (req, res) => {
  const { id } = req.params;

  try {
    // Ensure userId exists in the authenticated user's token
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ 
        success: false,
        errorCode: 'UNAUTHORIZED',
        message: 'Unauthorized: User ID not found in token'
      });
    }

    // Validate booking ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        errorCode: 'VALIDATION_ERROR',
        message: 'Invalid booking ID format',
        bookingId: id
      });
    }

    // Explicitly ensure the booking belongs to the authenticated user
    // Convert userId string to MongoDB ObjectId for proper comparison
    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const booking = await Booking.findOne({
      _id: new mongoose.Types.ObjectId(id),
      userId: userId,
    });

    if (!booking) {
      console.warn(`Booking not found: ID=${id}, User=${userId}`);
      return res.status(404).json({ 
        success: false,
        errorCode: 'NOT_FOUND',
        message: 'Booking not found',
        bookingId: id
      });
    }

    // Verify booking data integrity
    if (!booking._id || !booking.userId || !booking.serviceName) {
      console.error(`Booking data integrity issue: ID=${id}`, booking);
      return res.status(500).json({ 
        success: false,
        errorCode: 'DATA_INTEGRITY',
        message: 'Booking data is incomplete',
        bookingId: id
      });
    }

    // Convert to plain object to ensure clean serialization
    const bookingData = booking.toObject();
    
    res.json({ 
      success: true,
      booking: bookingData,
      bookingId: booking._id.toString(),
      paymentStatus: booking.paymentStatus
    });
  } catch (error) {
    console.error('getBookingById error:', error);
    res.status(500).json({ 
      success: false,
      errorCode: 'BOOKING_FETCH_FAILED',
      message: 'Unable to fetch booking',
      bookingId: id,
      error: process.env.NODE_ENV === 'production' 
        ? 'An error occurred while fetching the booking.'
        : error.message
    });
  }
};

exports.uploadReceipt = async (req, res) => {
  const { id } = req.params;

  if (!req.file) {
    return res.status(400).json({ 
      success: false,
      errorCode: 'VALIDATION_ERROR',
      message: 'Receipt file is required.',
      bookingId: id
    });
  }

  try {
    // Ensure userId exists in the authenticated user's token
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ 
        success: false,
        errorCode: 'UNAUTHORIZED',
        message: 'Unauthorized: User ID not found in token'
      });
    }

    // Validate booking ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        errorCode: 'VALIDATION_ERROR',
        message: 'Invalid booking ID format',
        bookingId: id
      });
    }

    // Explicitly ensure the booking belongs to the authenticated user
    // Convert userId string to MongoDB ObjectId for proper comparison
    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const booking = await Booking.findOne({
      _id: new mongoose.Types.ObjectId(id),
      userId: userId,
    });

    if (!booking) {
      console.warn(`Receipt upload failed - booking not found: ID=${id}, User=${userId}`);
      return res.status(404).json({ 
        success: false,
        errorCode: 'NOT_FOUND',
        message: 'Booking not found',
        bookingId: id
      });
    }

    // Validate file upload
    if (!req.file.filename || !req.file.size) {
      console.error(`File validation failed for booking ${id}`);
      return res.status(400).json({ 
        success: false,
        errorCode: 'VALIDATION_ERROR',
        message: 'File upload validation failed',
        bookingId: id
      });
    }

    let backendUrl = process.env.BACKEND_URL || 'https://fyp-project-backend.onrender.com';
    backendUrl = backendUrl.replace(/\/*$/, ''); // ensure no trailing slash
    const receiptUrl = `${backendUrl}/uploads/receipts/${req.file.filename}`;

    // Add receipt to booking
    booking.receiptUploads.push({
      filename: req.file.filename,
      url: receiptUrl,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedAt: new Date(),
    });

    booking.paymentStatus = 'receipt_submitted';
    await booking.save();

    // Verify receipt was saved
    if (!booking.receiptUploads || booking.receiptUploads.length === 0) {
      throw new Error('Receipt metadata not saved to booking');
    }

    console.log(`Receipt uploaded successfully: BookingID=${id}, File=${req.file.filename}, User=${userId}`);

    // Convert to plain object to ensure clean serialization
    const bookingData = booking.toObject();
    
    res.json({ 
      message: 'Receipt uploaded successfully',
      success: true,
      booking: bookingData,
      bookingId: booking._id.toString(),
      paymentStatus: 'receipt_submitted',
      receiptUrl: receiptUrl,
      receiptFile: req.file.filename
    });
  } catch (error) {
    console.error('uploadReceipt error:', error);
    res.status(500).json({ 
      success: false,
      errorCode: 'RECEIPT_UPLOAD_FAILED',
      message: 'Unable to upload receipt',
      bookingId: id,
      error: process.env.NODE_ENV === 'production' 
        ? 'An error occurred while uploading the receipt.'
        : error.message
    });
  }
};

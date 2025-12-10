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

  // Log incoming request
  console.log('[createBooking] Request received', {
    userId: req.user?.userId || 'MISSING',
    serviceName: serviceName || 'MISSING',
    totalAmount: totalAmount || 'MISSING',
    hasServiceDetails: !!serviceDetails,
    hasScheduledDate: !!scheduledDate,
    hasNotes: !!notes
  });

  // Validate required fields
  if (!serviceName || !serviceName.trim()) {
    console.warn('[createBooking] Validation failed: serviceName is missing or empty');
    return res.status(400).json({
      success: false,
      errorCode: 'VALIDATION_ERROR',
      message: 'Service name is required.',
      field: 'serviceName'
    });
  }

  if (Number.isNaN(amount) || amount <= 0) {
    console.warn('[createBooking] Validation failed: totalAmount is invalid', { totalAmount, amount });
    return res.status(400).json({
      success: false,
      errorCode: 'VALIDATION_ERROR',
      message: 'Valid total amount greater than 0 is required.',
      field: 'totalAmount'
    });
  }

  // Ensure userId exists in the authenticated user's token
  if (!req.user || !req.user.userId) {
    console.error('[createBooking] Authentication failed: No JWT token or userId found');
    return res.status(401).json({ 
      success: false,
      errorCode: 'UNAUTHORIZED',
      message: 'Unauthorized: User ID not found in token'
    });
  }

  try {
    // Convert userId string to MongoDB ObjectId for proper comparison
    const userId = new mongoose.Types.ObjectId(req.user.userId);
    console.log('[createBooking] Validation passed, attempting MongoDB create', {
      userId: userId.toString(),
      serviceName: serviceName.trim(),
      totalAmount: amount
    });
    
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
      const error = new Error('Booking creation failed - no ID returned from MongoDB');
      console.error('[createBooking] Verification failed:', error.message, { booking });
      throw error;
    }

    console.log('[createBooking] SUCCESS', {
      bookingId: booking._id.toString(),
      userId: userId.toString(),
      serviceName: booking.serviceName,
      totalAmount: booking.totalAmount,
      paymentStatus: booking.paymentStatus,
      createdAt: booking.createdAt
    });

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
    console.error('[createBooking] EXCEPTION', {
      errorName: error.name,
      errorMessage: error.message,
      errorCode: error.code,
      stack: error.stack
    });
    
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
  console.log('[getUserBookings] Request received', {
    userId: req.user?.userId || 'MISSING'
  });

  try {
    // Ensure userId exists in the authenticated user's token
    if (!req.user || !req.user.userId) {
      console.error('[getUserBookings] Authentication failed: No JWT token or userId found');
      return res.status(401).json({ 
        success: false,
        errorCode: 'UNAUTHORIZED',
        message: 'Unauthorized: User ID not found in token'
      });
    }

    // Explicitly filter by the authenticated user's ID only
    // Convert userId string to MongoDB ObjectId for proper comparison
    const userId = new mongoose.Types.ObjectId(req.user.userId);
    console.log('[getUserBookings] Attempting MongoDB query', { userId: userId.toString() });

    const bookings = await Booking.find({ userId: userId }).sort({ createdAt: -1 });
    
    // Convert to plain objects to ensure clean serialization
    const bookingsData = bookings.map(booking => booking.toObject());
    
    console.log('[getUserBookings] SUCCESS', {
      userId: userId.toString(),
      count: bookings.length,
      bookingIds: bookings.map(b => b._id.toString())
    });
    
    res.json({ 
      success: true,
      message: `Retrieved ${bookings.length} booking(s)`,
      bookings: bookingsData,
      count: bookings.length
    });
  } catch (error) {
    console.error('[getUserBookings] EXCEPTION', {
      userId: req.user?.userId || 'UNKNOWN',
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack
    });
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

  console.log('[getBookingById] Request received', {
    bookingId: id,
    userId: req.user?.userId || 'MISSING'
  });

  try {
    // Ensure userId exists in the authenticated user's token
    if (!req.user || !req.user.userId) {
      console.error('[getBookingById] Authentication failed: No JWT token or userId found');
      return res.status(401).json({ 
        success: false,
        errorCode: 'UNAUTHORIZED',
        message: 'Unauthorized: User ID not found in token'
      });
    }

    // Validate booking ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.warn('[getBookingById] Validation failed: Invalid booking ID format', { bookingId: id });
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
    console.log('[getBookingById] Attempting MongoDB query', {
      bookingId: id,
      userId: userId.toString()
    });

    const booking = await Booking.findOne({
      _id: new mongoose.Types.ObjectId(id),
      userId: userId,
    });

    if (!booking) {
      console.warn('[getBookingById] NOT_FOUND', { bookingId: id, userId: userId.toString() });
      return res.status(404).json({ 
        success: false,
        errorCode: 'NOT_FOUND',
        message: 'Booking not found',
        bookingId: id
      });
    }

    // Verify booking data integrity
    if (!booking._id || !booking.userId || !booking.serviceName) {
      console.error('[getBookingById] Data integrity issue', {
        bookingId: id,
        hasId: !!booking._id,
        hasUserId: !!booking.userId,
        hasServiceName: !!booking.serviceName
      });
      return res.status(500).json({ 
        success: false,
        errorCode: 'DATA_INTEGRITY',
        message: 'Booking data is incomplete',
        bookingId: id
      });
    }

    console.log('[getBookingById] SUCCESS', {
      bookingId: booking._id.toString(),
      serviceName: booking.serviceName,
      totalAmount: booking.totalAmount,
      paymentStatus: booking.paymentStatus
    });

    // Convert to plain object to ensure clean serialization
    const bookingData = booking.toObject();
    
    res.json({ 
      success: true,
      booking: bookingData,
      bookingId: booking._id.toString(),
      paymentStatus: booking.paymentStatus
    });
  } catch (error) {
    console.error('[getBookingById] EXCEPTION', {
      bookingId: id,
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack
    });
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

  console.log('[uploadReceipt] Request received', {
    bookingId: id,
    userId: req.user?.userId || 'MISSING',
    hasFile: !!req.file,
    fileName: req.file?.originalname || 'NONE'
  });

  if (!req.file) {
    console.warn('[uploadReceipt] Validation failed: No file uploaded', { bookingId: id });
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
      console.error('[uploadReceipt] Authentication failed: No JWT token or userId found');
      return res.status(401).json({ 
        success: false,
        errorCode: 'UNAUTHORIZED',
        message: 'Unauthorized: User ID not found in token'
      });
    }

    // Validate booking ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.warn('[uploadReceipt] Validation failed: Invalid booking ID format', { bookingId: id });
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
    console.log('[uploadReceipt] Attempting MongoDB query', {
      bookingId: id,
      userId: userId.toString()
    });

    const booking = await Booking.findOne({
      _id: new mongoose.Types.ObjectId(id),
      userId: userId,
    });

    if (!booking) {
      console.warn('[uploadReceipt] NOT_FOUND', { bookingId: id, userId: userId.toString() });
      return res.status(404).json({ 
        success: false,
        errorCode: 'NOT_FOUND',
        message: 'Booking not found',
        bookingId: id
      });
    }

    // Validate file upload
    if (!req.file.filename || !req.file.size) {
      console.error('[uploadReceipt] File validation failed', {
        bookingId: id,
        hasFilename: !!req.file.filename,
        hasSize: !!req.file.size
      });
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

    console.log('[uploadReceipt] Attempting MongoDB update', {
      bookingId: id,
      fileName: req.file.filename,
      fileSize: req.file.size,
      mimeType: req.file.mimetype
    });

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
      const error = new Error('Receipt metadata not saved to booking');
      console.error('[uploadReceipt] Verification failed:', error.message, { bookingId: id });
      throw error;
    }

    console.log('[uploadReceipt] SUCCESS', {
      bookingId: booking._id.toString(),
      userId: userId.toString(),
      fileName: req.file.filename,
      fileSize: req.file.size,
      receiptCount: booking.receiptUploads.length,
      paymentStatus: booking.paymentStatus
    });

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
    console.error('[uploadReceipt] EXCEPTION', {
      bookingId: id,
      userId: req.user?.userId || 'UNKNOWN',
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack
    });
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

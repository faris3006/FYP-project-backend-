const express = require("express");
const User = require("../models/User");
const Booking = require("../models/Booking");
const router = express.Router();

// Middleware to check admin role
function verifyAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

// Normalize booking shape for admin/frontends
function normalizeBooking(booking) {
  if (!booking) return null;
  const b = booking.toObject ? booking.toObject() : booking;

  let details = {};
  if (typeof b.serviceDetails === "string") {
    try {
      details = JSON.parse(b.serviceDetails);
    } catch (e) {
      details = {};
    }
  } else if (typeof b.serviceDetails === "object" && b.serviceDetails !== null) {
    details = b.serviceDetails;
  }

  const expandedDetails = {
    eventType: details.eventType || null,
    numPeople: details.numPeople || null,
    foodPackage: details.foodPackage || null,
    selectedSides: details.selectedSides || null,
    drink: details.drink || null,
    dessert: details.dessert || null,
    notes: details.notes || details.specialRequests || null,
    specialRequests: details.specialRequests || details.notes || null,
  };

  const userInfo = b.userId && typeof b.userId === "object" && b.userId._id
    ? {
        id: b.userId._id.toString(),
        name: b.userId.name,
        email: b.userId.email,
        phone: b.userId.phone,
      }
    : null;

  // Extract receipt metadata for easy admin access
  const latestReceipt = b.receiptUploads && b.receiptUploads.length > 0 
    ? b.receiptUploads[b.receiptUploads.length - 1] 
    : null;
  
  const receiptFileName = latestReceipt ? latestReceipt.filename : null;
  const receiptUrl = latestReceipt ? latestReceipt.url : null;

  return {
    id: b._id ? b._id.toString() : null,
    _id: b._id ? b._id.toString() : null,
    user: userInfo,
    userId: b.userId?._id?.toString?.() || b.userId || null,
    serviceName: b.serviceName,
    serviceDetails: expandedDetails,
    scheduledDate: b.scheduledDate,
    totalAmount: b.totalAmount,
    paymentStatus: b.paymentStatus,
    status: b.paymentStatus,
    notes: b.notes,
    receiptUploads: b.receiptUploads || [],
    receiptFileName: receiptFileName,
    receiptUrl: receiptUrl,
    qrCode: b.qrCode,
    paymentCompletedAt: b.paymentCompletedAt,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}

// Get all users (exclude sensitive info)
router.get("/users", verifyAdmin, async (req, res) => {
  try {
    const users = await User.find({}, "-password -mfaCode -mfaExpiry");
    res.json({ users });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get dashboard statistics
router.get("/stats", verifyAdmin, async (req, res) => {
  try {
    const totalBookings = await Booking.countDocuments();
    const pendingReceipts = await Booking.countDocuments({ paymentStatus: "receipt_submitted" });
    const completedBookings = await Booking.countDocuments({ paymentStatus: "completed" });
    const pendingBookings = await Booking.countDocuments({ paymentStatus: "pending" });
    const totalUsers = await User.countDocuments({ role: "user" });

    // Calculate total revenue from completed bookings
    const revenueResult = await Booking.aggregate([
      { $match: { paymentStatus: "completed" } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } }
    ]);
    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

    res.json({
      stats: {
        totalBookings,
        pendingReceipts,
        completedBookings,
        pendingBookings,
        totalUsers,
        totalRevenue
      }
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get bookings for receipt review queue (only bookings with receipts submitted)
router.get("/bookings/receipt-queue", verifyAdmin, async (req, res) => {
  try {
    const bookings = await Booking.find({ paymentStatus: "receipt_submitted" })
      .populate("userId", "name email phone")
      .sort({ createdAt: -1 });

    const data = bookings.map(normalizeBooking);
    res.json({ bookings: data });
  } catch (error) {
    console.error("Error fetching receipt queue:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get all bookings for history view (completed or pending)
router.get("/bookings/history", verifyAdmin, async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate("userId", "name email phone")
      .sort({ createdAt: -1, updatedAt: -1 });

    const data = bookings.map(normalizeBooking);
    res.json({ bookings: data });
  } catch (error) {
    console.error("Error fetching booking history:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get all bookings with user info (for booking history - read-only display)
router.get("/bookings", verifyAdmin, async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate("userId", "name email phone")
      .sort({ createdAt: -1 });

    const data = bookings.map(normalizeBooking);
    res.json({ bookings: data });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Update payment status (general endpoint)
router.put("/bookings/:id/payment", verifyAdmin, async (req, res) => {
  const { id } = req.params;
  let { paymentStatus } = req.body;

  if (!paymentStatus) {
    return res.status(400).json({ message: "paymentStatus is required" });
  }

  // Normalize commonly used aliases from the frontend
  const normalizedStatus = paymentStatus.toLowerCase();
  if (normalizedStatus === "approved" || normalizedStatus === "paid") {
    paymentStatus = "completed";
  } else if (normalizedStatus === "receipt_submitted" || normalizedStatus === "receipt-submitted") {
    paymentStatus = "receipt_submitted";
  } else if (normalizedStatus === "pending") {
    paymentStatus = "pending";
  }

  const allowedStatuses = ["pending", "receipt_submitted", "completed"];

  if (!allowedStatuses.includes(paymentStatus)) {
    return res.status(400).json({ message: "Invalid status value" });
  }

  try {
    const booking = await Booking.findById(id).populate("userId", "name email phone");
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    booking.paymentStatus = paymentStatus;

    if (paymentStatus === "completed") {
      booking.paymentCompletedAt = new Date();
    } else {
      booking.paymentCompletedAt = undefined;
    }

    await booking.save();

    res.json({ message: "Payment status updated", booking: normalizeBooking(booking) });
  } catch (error) {
    console.error("admin update booking error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Approve receipt (shortcut endpoint)
router.post("/bookings/:id/approve", verifyAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const booking = await Booking.findById(id).populate("userId", "name email phone");
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.paymentStatus !== "receipt_submitted") {
      return res.status(400).json({ 
        message: "Can only approve bookings with receipt_submitted status",
        currentStatus: booking.paymentStatus 
      });
    }

    booking.paymentStatus = "completed";
    booking.paymentCompletedAt = new Date();
    await booking.save();

    console.log(`Admin approved booking ${id} for user ${booking.userId.email}`);

    res.json({ 
      message: "Receipt approved successfully", 
      booking: normalizeBooking(booking) 
    });
  } catch (error) {
    console.error("Error approving receipt:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Reject receipt (set back to pending)
router.post("/bookings/:id/reject", verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  try {
    const booking = await Booking.findById(id).populate("userId", "name email phone");
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.paymentStatus !== "receipt_submitted") {
      return res.status(400).json({ 
        message: "Can only reject bookings with receipt_submitted status",
        currentStatus: booking.paymentStatus 
      });
    }

    booking.paymentStatus = "pending";
    booking.paymentCompletedAt = undefined;
    
    // Optional: Add rejection reason to notes if provided
    if (reason) {
      booking.notes = booking.notes 
        ? `${booking.notes}\n\nAdmin rejection reason: ${reason}` 
        : `Admin rejection reason: ${reason}`;
    }

    await booking.save();

    console.log(`Admin rejected booking ${id} for user ${booking.userId.email}. Reason: ${reason || 'None provided'}`);

    res.json({ 
      message: "Receipt rejected successfully", 
      booking: normalizeBooking(booking) 
    });
  } catch (error) {
    console.error("Error rejecting receipt:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get single booking by ID (for admin detail view)
router.get("/bookings/:id", verifyAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const booking = await Booking.findById(id).populate("userId", "name email phone");
    
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    res.json({ booking: normalizeBooking(booking) });
  } catch (error) {
    console.error("Error fetching booking:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;

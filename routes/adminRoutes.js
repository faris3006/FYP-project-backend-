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
    res.json({ bookings });
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
      // Primary sort: creation time (when user submitted booking)
      // Secondary sort: latest status change
      .sort({ createdAt: -1, updatedAt: -1 });
    res.json({ bookings });
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
    res.json({ bookings });
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

    res.json({ message: "Payment status updated", booking });
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
      booking 
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
      booking 
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

    res.json({ booking });
  } catch (error) {
    console.error("Error fetching booking:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;

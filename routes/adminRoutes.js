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

// Update payment status
router.put("/bookings/:id/payment", verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { paymentStatus } = req.body;
  const allowedStatuses = ["completed", "pending"];

  if (!allowedStatuses.includes(paymentStatus)) {
    return res.status(400).json({ message: "Invalid status value" });
  }

  try {
    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    booking.paymentStatus = paymentStatus;
    await booking.save();

    res.json({ message: "Payment status updated", booking });
  } catch (error) {
    console.error("admin update booking error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;

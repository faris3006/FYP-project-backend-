const mongoose = require('mongoose');
const Booking = require('./models/Booking');
const { generateBookingQRCode } = require('./utils/qrCodeUtils');
require('dotenv').config();

/**
 * Migration Script: Add QR Codes to Existing Bookings
 * 
 * This script adds unique QR codes to all bookings that don't have one.
 * Run this ONCE before deploying the updated booking system.
 * 
 * Usage: node addQRCodesToExistingBookings.js
 */

async function migrateExistingBookings() {
  console.log('[Migration] Starting QR code migration for existing bookings...');
  
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.DB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('[Migration] Connected to MongoDB');
    
    // Find all bookings without qrCode field
    const bookingsWithoutQR = await Booking.find({ 
      qrCode: { $exists: false } 
    }).select('_id userId serviceName totalAmount createdAt');
    
    const totalBookings = bookingsWithoutQR.length;
    console.log(`[Migration] Found ${totalBookings} bookings without QR codes`);
    
    if (totalBookings === 0) {
      console.log('[Migration] No bookings to migrate. All bookings already have QR codes.');
      process.exit(0);
    }
    
    let successCount = 0;
    let failureCount = 0;
    const errors = [];
    
    // Process each booking
    for (let i = 0; i < bookingsWithoutQR.length; i++) {
      const booking = bookingsWithoutQR[i];
      
      try {
        // Generate unique QR code
        const qrCode = await generateBookingQRCode({
          userId: booking.userId.toString(),
          serviceName: booking.serviceName || 'Unknown Service',
          totalAmount: booking.totalAmount || 0
        });
        
        // Update booking with QR code
        booking.qrCode = qrCode;
        await booking.save();
        
        successCount++;
        console.log(`[Migration] ✅ [${i + 1}/${totalBookings}] Added QR code ${qrCode} to booking ${booking._id}`);
        
      } catch (error) {
        failureCount++;
        const errorMsg = `Failed to add QR code to booking ${booking._id}: ${error.message}`;
        console.error(`[Migration] ❌ [${i + 1}/${totalBookings}] ${errorMsg}`);
        errors.push({
          bookingId: booking._id,
          error: error.message
        });
      }
    }
    
    // Print summary
    console.log('\n[Migration] ========== MIGRATION SUMMARY ==========');
    console.log(`[Migration] Total bookings processed: ${totalBookings}`);
    console.log(`[Migration] Successful: ${successCount}`);
    console.log(`[Migration] Failed: ${failureCount}`);
    
    if (errors.length > 0) {
      console.log('\n[Migration] Failed bookings:');
      errors.forEach(err => {
        console.log(`  - Booking ID: ${err.bookingId}, Error: ${err.error}`);
      });
    }
    
    console.log('[Migration] =======================================\n');
    
    if (failureCount > 0) {
      console.log('[Migration] ⚠️  Migration completed with errors. Review failed bookings above.');
      process.exit(1);
    } else {
      console.log('[Migration] ✅ Migration completed successfully!');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('[Migration] ❌ Migration failed with error:', error);
    process.exit(1);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('[Migration] MongoDB connection closed');
  }
}

// Run migration
migrateExistingBookings();

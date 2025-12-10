const crypto = require('crypto');
const Booking = require('../models/Booking');

/**
 * Generate a unique QR code for a booking
 * Format: QR-{timestamp}-{random}-{checksum}
 * Example: QR-1702224600000-A3F9B2-7E4C
 * 
 * @param {number} maxRetries - Maximum number of attempts to generate unique code
 * @returns {Promise<string>} Unique QR code
 */
async function generateUniqueQRCode(maxRetries = 5) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Generate components
      const timestamp = Date.now();
      const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
      const randomSuffix = crypto.randomBytes(2).toString('hex').toUpperCase();
      
      // Create QR code with format: QR-timestamp-random-checksum
      const qrCode = `QR-${timestamp}-${randomHex}-${randomSuffix}`;
      
      // Check if this QR code already exists in database
      const existing = await Booking.findOne({ qrCode });
      
      if (!existing) {
        console.log(`[QRCode] Generated unique QR code: ${qrCode} (attempt ${attempt})`);
        return qrCode;
      }
      
      console.warn(`[QRCode] Collision detected: ${qrCode} already exists (attempt ${attempt})`);
      
      // Add small delay before retry to ensure different timestamp
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    } catch (error) {
      console.error(`[QRCode] Error during generation attempt ${attempt}:`, error);
      if (attempt === maxRetries) {
        throw new Error('Failed to generate unique QR code after maximum retries');
      }
    }
  }
  
  throw new Error('Failed to generate unique QR code after maximum retries');
}

/**
 * Validate QR code format
 * @param {string} qrCode - QR code to validate
 * @returns {boolean} True if valid format
 */
function isValidQRCodeFormat(qrCode) {
  if (!qrCode || typeof qrCode !== 'string') {
    return false;
  }
  
  // Format: QR-{13-digit-timestamp}-{6-hex-chars}-{4-hex-chars}
  const qrCodePattern = /^QR-\d{13}-[A-F0-9]{6}-[A-F0-9]{4}$/;
  return qrCodePattern.test(qrCode);
}

/**
 * Generate QR code with collision detection and retry logic
 * @param {Object} bookingData - Booking data for context
 * @returns {Promise<string>} Unique QR code
 */
async function generateBookingQRCode(bookingData = {}) {
  try {
    console.log('[QRCode] Generating QR code for booking', {
      userId: bookingData.userId?.toString() || 'UNKNOWN',
      serviceName: bookingData.serviceName || 'UNKNOWN'
    });
    
    const qrCode = await generateUniqueQRCode();
    
    // Validate format before returning
    if (!isValidQRCodeFormat(qrCode)) {
      throw new Error(`Generated QR code has invalid format: ${qrCode}`);
    }
    
    console.log('[QRCode] Successfully generated and validated QR code:', qrCode);
    return qrCode;
  } catch (error) {
    console.error('[QRCode] Failed to generate QR code', {
      error: error.message,
      bookingData: {
        userId: bookingData.userId?.toString() || 'UNKNOWN',
        serviceName: bookingData.serviceName || 'UNKNOWN'
      }
    });
    throw error;
  }
}

module.exports = {
  generateUniqueQRCode,
  generateBookingQRCode,
  isValidQRCodeFormat
};

# QR Code Implementation Guide

## Overview
The booking system now generates unique QR codes for each booking to prevent E11000 duplicate key errors and enable better tracking.

---

## Implementation Details

### 1. Database Schema Update (`models/Booking.js`)

**Added Field:**
```javascript
qrCode: { type: String, unique: true, required: true }
```

**Unique Index:**
```javascript
bookingSchema.index({ qrCode: 1 }, { unique: true });
```

### 2. QR Code Generation (`utils/qrCodeUtils.js`)

**Format:** `QR-{timestamp}-{random6}-{random4}`  
**Example:** `QR-1702224600000-A3F9B2-7E4C`

**Features:**
- ✅ Timestamp-based (13 digits) - ensures chronological ordering
- ✅ Random components (6 + 4 hex chars) - prevents collisions
- ✅ Database collision detection - checks before returning
- ✅ Retry logic (5 attempts) - handles unlikely collisions
- ✅ Format validation - ensures correct pattern

### 3. Booking Creation Flow

**Step 1: Generate QR Code**
```javascript
const qrCode = await generateBookingQRCode({
  userId,
  serviceName,
  totalAmount
});
```

**Step 2: Create Booking with QR Code**
```javascript
const booking = await Booking.create({
  userId,
  serviceName,
  totalAmount,
  qrCode,  // ← Added
  // ... other fields
});
```

**Step 3: Return QR Code in Response**
```javascript
res.status(201).json({
  success: true,
  booking: bookingData,
  bookingId: booking._id.toString(),
  qrCode: booking.qrCode,  // ← Frontend can use this
  paymentStatus: 'pending'
});
```

---

## Error Handling

### Duplicate QR Code Error (E11000)

**Status Code:** `409 Conflict`

**Response:**
```json
{
  "success": false,
  "errorCode": "DUPLICATE_QR_CODE",
  "message": "A booking with this QR code already exists. Please try again.",
  "field": "qrCode",
  "retryable": true
}
```

**Frontend Action:** Retry the booking creation request automatically

### QR Code Generation Failed

**Status Code:** `500 Internal Server Error`

**Response:**
```json
{
  "success": false,
  "errorCode": "QR_CODE_GENERATION_FAILED",
  "message": "Unable to generate unique QR code for booking",
  "error": "Failed to generate booking identifier. Please try again."
}
```

**Frontend Action:** Display error and ask user to retry

---

## Logs

### Successful QR Code Generation
```
[QRCode] Generating QR code for booking {
  userId: "507f1f77bcf86cd799439010",
  serviceName: "Web Development"
}

[QRCode] Generated unique QR code: QR-1702224600000-A3F9B2-7E4C (attempt 1)

[QRCode] Successfully generated and validated QR code: QR-1702224600000-A3F9B2-7E4C

[createBooking] QR code generated, creating booking {
  qrCode: "QR-1702224600000-A3F9B2-7E4C",
  userId: "507f1f77bcf86cd799439010"
}

[createBooking] SUCCESS {
  bookingId: "507f1f77bcf86cd799439011",
  userId: "507f1f77bcf86cd799439010",
  serviceName: "Web Development",
  totalAmount: 5000,
  paymentStatus: "pending",
  qrCode: "QR-1702224600000-A3F9B2-7E4C",
  createdAt: "2025-12-10T10:30:00.000Z"
}
```

### QR Code Collision (Rare)
```
[QRCode] Collision detected: QR-1702224600000-A3F9B2-7E4C already exists (attempt 1)
[QRCode] Generated unique QR code: QR-1702224600010-B4E8C3-9F5D (attempt 2)
```

### Duplicate Key Error
```
[createBooking] Duplicate key error {
  errorCode: 11000,
  field: "qrCode",
  userId: "507f1f77bcf86cd799439010",
  message: "E11000 duplicate key error collection: test.bookings index: qrCode_1 dup key: { qrCode: \"QR-1702224600000-A3F9B2-7E4C\" }"
}
```

---

## Migration Guide

### For Existing Bookings Without QR Codes

If you have existing bookings in the database that don't have QR codes, run this migration:

```javascript
// migration-script.js
const mongoose = require('mongoose');
const Booking = require('./models/Booking');
const { generateBookingQRCode } = require('./utils/qrCodeUtils');

async function migrateExistingBookings() {
  try {
    await mongoose.connect(process.env.DB_URI);
    
    // Find all bookings without qrCode
    const bookingsWithoutQR = await Booking.find({ qrCode: { $exists: false } });
    
    console.log(`Found ${bookingsWithoutQR.length} bookings without QR codes`);
    
    for (const booking of bookingsWithoutQR) {
      try {
        const qrCode = await generateBookingQRCode({
          userId: booking.userId,
          serviceName: booking.serviceName,
          totalAmount: booking.totalAmount
        });
        
        booking.qrCode = qrCode;
        await booking.save();
        
        console.log(`✅ Added QR code ${qrCode} to booking ${booking._id}`);
      } catch (error) {
        console.error(`❌ Failed to add QR code to booking ${booking._id}:`, error.message);
      }
    }
    
    console.log('Migration complete');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateExistingBookings();
```

**Run:**
```bash
node migration-script.js
```

---

## Frontend Integration

### Display QR Code to User

```javascript
// After successful booking creation
const response = await fetch('/api/bookings', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${jwtToken}` },
  body: JSON.stringify({ serviceName, totalAmount })
});

const data = await response.json();

if (data.success) {
  // Display QR code to user
  console.log('Booking QR Code:', data.qrCode);
  
  // Store for payment page
  sessionStorage.setItem('bookingQRCode', data.qrCode);
  sessionStorage.setItem('bookingId', data.bookingId);
  
  // Navigate to payment
  navigate(`/payment/${data.bookingId}`);
}
```

### Handle Duplicate QR Error (Auto-Retry)

```javascript
async function createBookingWithRetry(bookingData, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${jwtToken}` },
        body: JSON.stringify(bookingData)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        return data; // Success
      }
      
      // Check if it's a retryable error
      if (data.errorCode === 'DUPLICATE_QR_CODE' && data.retryable && attempt < maxRetries) {
        console.warn(`QR code collision, retrying... (attempt ${attempt + 1})`);
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms
        continue; // Retry
      }
      
      // Non-retryable error
      throw new Error(data.message);
    } catch (error) {
      if (attempt === maxRetries) {
        throw error; // Give up after max retries
      }
    }
  }
}

// Usage
try {
  const result = await createBookingWithRetry({
    serviceName: 'Web Development',
    totalAmount: 5000
  });
  
  console.log('Booking created with QR code:', result.qrCode);
} catch (error) {
  showError('Failed to create booking. Please try again.');
}
```

---

## Testing

### Test QR Code Generation
```bash
# In Node.js REPL or test file
const { generateBookingQRCode } = require('./utils/qrCodeUtils');

const qrCode = await generateBookingQRCode({
  userId: 'test-user-id',
  serviceName: 'Test Service'
});

console.log('Generated QR Code:', qrCode);
// Expected format: QR-1702224600000-A3F9B2-7E4C
```

### Test Duplicate Detection
```bash
# Create two bookings quickly
curl -X POST http://localhost:10000/api/bookings \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{"serviceName":"Test","totalAmount":100}'

# Both should succeed with different QR codes
```

### Test Error Handling
```javascript
// Manually create booking with duplicate QR code (for testing)
const booking1 = await Booking.create({
  userId: '...',
  serviceName: 'Test 1',
  totalAmount: 100,
  qrCode: 'QR-TEST-DUPLICATE'
});

// This should fail with 409 error
const booking2 = await Booking.create({
  userId: '...',
  serviceName: 'Test 2',
  totalAmount: 200,
  qrCode: 'QR-TEST-DUPLICATE'  // Same QR code
});
// Expected: MongoServerError: E11000 duplicate key error
```

---

## Benefits

✅ **Prevents E11000 Errors** - Unique index + generation logic ensures no duplicates  
✅ **Reliable Tracking** - Each booking has a permanent unique identifier  
✅ **Collision Resistant** - Timestamp + crypto.randomBytes = extremely low collision probability  
✅ **Graceful Error Handling** - Frontend can retry automatically on collision  
✅ **Detailed Logging** - Track QR generation attempts and collisions  
✅ **Format Validation** - Ensures QR codes match expected pattern  
✅ **Cross-Device Support** - QR code stored in database, accessible anywhere  

---

## Troubleshooting

### "QR code generation failed after maximum retries"
**Cause:** Database connection issues or extremely unlikely collision  
**Fix:** Check MongoDB connection, increase retry count if needed

### "E11000 duplicate key error on qrCode"
**Cause:** Race condition or failed QR validation  
**Fix:** Frontend should retry automatically (409 response with `retryable: true`)

### "Booking created without QR code"
**Cause:** Schema requires qrCode, should not be possible  
**Fix:** Verify schema has `required: true` and QR generation happens before `Booking.create()`


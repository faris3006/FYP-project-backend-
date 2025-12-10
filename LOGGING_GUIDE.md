# Backend Logging Guide for Booking Submission

## Overview
All booking controller endpoints (`createBooking`, `getUserBookings`, `getBookingById`, `uploadReceipt`) now include comprehensive structured logging to aid debugging and monitoring.

Logs use a standardized format: `[functionName] [LOG_LEVEL] message` with JSON objects for context.

---

## Log Levels

- **`console.log`** - Success events and informational messages
- **`console.warn`** - Validation failures, missing data (expected client errors)
- **`console.error`** - Unexpected exceptions, database errors (server problems)

---

## Booking Creation: `POST /api/bookings`

### Successful Creation
```
[createBooking] Request received {
  userId: "507f1f77bcf86cd799439010",
  serviceName: "Web Development",
  totalAmount: "5000",
  hasServiceDetails: true,
  hasScheduledDate: false,
  hasNotes: true
}

[createBooking] Validation passed, attempting MongoDB create {
  userId: "507f1f77bcf86cd799439010",
  serviceName: "Web Development",
  totalAmount: 5000
}

[createBooking] SUCCESS {
  bookingId: "507f1f77bcf86cd799439011",
  userId: "507f1f77bcf86cd799439010",
  serviceName: "Web Development",
  totalAmount: 5000,
  paymentStatus: "pending",
  createdAt: "2025-12-10T10:30:00.000Z"
}
```

**Response Status**: `201 Created`

---

### Missing Service Name
```
[createBooking] Request received {
  userId: "507f1f77bcf86cd799439010",
  serviceName: "MISSING",
  totalAmount: "5000",
  hasServiceDetails: false,
  hasScheduledDate: false,
  hasNotes: false
}

[createBooking] Validation failed: serviceName is missing or empty
```

**Response Status**: `400 Bad Request`
```json
{
  "success": false,
  "errorCode": "VALIDATION_ERROR",
  "message": "Service name is required.",
  "field": "serviceName"
}
```

---

### Invalid Total Amount
```
[createBooking] Validation failed: totalAmount is invalid {
  totalAmount: "0",
  amount: 0
}
```

**Response Status**: `400 Bad Request`
```json
{
  "success": false,
  "errorCode": "VALIDATION_ERROR",
  "message": "Valid total amount greater than 0 is required.",
  "field": "totalAmount"
}
```

---

### Missing JWT Token
```
[createBooking] Request received {
  userId: "MISSING",
  serviceName: "Web Development",
  totalAmount: "5000",
  ...
}

[createBooking] Authentication failed: No JWT token or userId found
```

**Response Status**: `401 Unauthorized`
```json
{
  "success": false,
  "errorCode": "UNAUTHORIZED",
  "message": "Unauthorized: User ID not found in token"
}
```

---

### Database Error (e.g., MongoDB Connection Failed)
```
[createBooking] Validation passed, attempting MongoDB create {
  userId: "507f1f77bcf86cd799439010",
  serviceName: "Web Development",
  totalAmount: 5000
}

[createBooking] EXCEPTION {
  errorName: "MongoNetworkError",
  errorMessage: "connect ECONNREFUSED 127.0.0.1:27017",
  errorCode: undefined,
  stack: "Error: connect ECONNREFUSED...\n    at..."
}
```

**Response Status**: `500 Internal Server Error`
```json
{
  "success": false,
  "errorCode": "BOOKING_CREATE_FAILED",
  "message": "Unable to create booking",
  "error": "An error occurred while creating your booking. Please try again."
}
```

---

## Fetching All Bookings: `GET /api/bookings`

### Successful Fetch
```
[getUserBookings] Request received {
  userId: "507f1f77bcf86cd799439010"
}

[getUserBookings] Attempting MongoDB query {
  userId: "507f1f77bcf86cd799439010"
}

[getUserBookings] SUCCESS {
  userId: "507f1f77bcf86cd799439010",
  count: 3,
  bookingIds: [
    "507f1f77bcf86cd799439011",
    "507f1f77bcf86cd799439012",
    "507f1f77bcf86cd799439013"
  ]
}
```

**Response Status**: `200 OK`
```json
{
  "success": true,
  "message": "Retrieved 3 booking(s)",
  "bookings": [...],
  "count": 3
}
```

---

### Missing JWT
```
[getUserBookings] Request received {
  userId: "MISSING"
}

[getUserBookings] Authentication failed: No JWT token or userId found
```

**Response Status**: `401 Unauthorized`

---

### Database Error
```
[getUserBookings] EXCEPTION {
  userId: "507f1f77bcf86cd799439010",
  errorName: "MongooseError",
  errorMessage: "Cast error for field 'userId'",
  stack: "..."
}
```

**Response Status**: `500 Internal Server Error`

---

## Fetching Single Booking: `GET /api/bookings/:id`

### Successful Fetch
```
[getBookingById] Request received {
  bookingId: "507f1f77bcf86cd799439011",
  userId: "507f1f77bcf86cd799439010"
}

[getBookingById] Attempting MongoDB query {
  bookingId: "507f1f77bcf86cd799439011",
  userId: "507f1f77bcf86cd799439010"
}

[getBookingById] SUCCESS {
  bookingId: "507f1f77bcf86cd799439011",
  serviceName: "Web Development",
  totalAmount: 5000,
  paymentStatus: "pending"
}
```

**Response Status**: `200 OK`

---

### Invalid Booking ID Format
```
[getBookingById] Request received {
  bookingId: "invalid_id_format",
  userId: "507f1f77bcf86cd799439010"
}

[getBookingById] Validation failed: Invalid booking ID format {
  bookingId: "invalid_id_format"
}
```

**Response Status**: `400 Bad Request`
```json
{
  "success": false,
  "errorCode": "VALIDATION_ERROR",
  "message": "Invalid booking ID format",
  "bookingId": "invalid_id_format"
}
```

---

### Booking Not Found (Different User)
```
[getBookingById] Request received {
  bookingId: "507f1f77bcf86cd799439011",
  userId: "507f1f77bcf86cd799439010"
}

[getBookingById] Attempting MongoDB query {
  bookingId: "507f1f77bcf86cd799439011",
  userId: "507f1f77bcf86cd799439010"
}

[getBookingById] NOT_FOUND {
  bookingId: "507f1f77bcf86cd799439011",
  userId: "507f1f77bcf86cd799439010"
}
```

**Response Status**: `404 Not Found`
```json
{
  "success": false,
  "errorCode": "NOT_FOUND",
  "message": "Booking not found",
  "bookingId": "507f1f77bcf86cd799439011"
}
```

---

### Data Integrity Issue
```
[getBookingById] Data integrity issue {
  bookingId: "507f1f77bcf86cd799439011",
  hasId: true,
  hasUserId: false,
  hasServiceName: true
}
```

**Response Status**: `500 Internal Server Error`
```json
{
  "success": false,
  "errorCode": "DATA_INTEGRITY",
  "message": "Booking data is incomplete",
  "bookingId": "507f1f77bcf86cd799439011"
}
```

---

## Receipt Upload: `POST /api/bookings/:id/receipt`

### Successful Upload
```
[uploadReceipt] Request received {
  bookingId: "507f1f77bcf86cd799439011",
  userId: "507f1f77bcf86cd799439010",
  hasFile: true,
  fileName: "receipt.pdf"
}

[uploadReceipt] Attempting MongoDB query {
  bookingId: "507f1f77bcf86cd799439011",
  userId: "507f1f77bcf86cd799439010"
}

[uploadReceipt] Attempting MongoDB update {
  bookingId: "507f1f77bcf86cd799439011",
  fileName: "1702224600000-123456789.pdf",
  fileSize: 245000,
  mimeType: "application/pdf"
}

[uploadReceipt] SUCCESS {
  bookingId: "507f1f77bcf86cd799439011",
  userId: "507f1f77bcf86cd799439010",
  fileName: "1702224600000-123456789.pdf",
  fileSize: 245000,
  receiptCount: 1,
  paymentStatus: "receipt_submitted"
}
```

**Response Status**: `200 OK`

---

### No File Uploaded
```
[uploadReceipt] Request received {
  bookingId: "507f1f77bcf86cd799439011",
  userId: "507f1f77bcf86cd799439010",
  hasFile: false,
  fileName: "NONE"
}

[uploadReceipt] Validation failed: No file uploaded {
  bookingId: "507f1f77bcf86cd799439011"
}
```

**Response Status**: `400 Bad Request`
```json
{
  "success": false,
  "errorCode": "VALIDATION_ERROR",
  "message": "Receipt file is required.",
  "bookingId": "507f1f77bcf86cd799439011"
}
```

---

### File Type Not Allowed
**Note**: This error is caught by multer fileFilter middleware before reaching the controller.

**Response Status**: `400 Bad Request`
```json
{
  "message": "Only PNG, JPG, and PDF files are allowed."
}
```

---

### File Validation Failed
```
[uploadReceipt] File validation failed {
  bookingId: "507f1f77bcf86cd799439011",
  hasFilename: true,
  hasSize: false
}
```

**Response Status**: `400 Bad Request`

---

### Booking Not Found During Receipt Upload
```
[uploadReceipt] Attempting MongoDB query {
  bookingId: "507f1f77bcf86cd799439011",
  userId: "507f1f77bcf86cd799439010"
}

[uploadReceipt] NOT_FOUND {
  bookingId: "507f1f77bcf86cd799439011",
  userId: "507f1f77bcf86cd799439010"
}
```

**Response Status**: `404 Not Found`

---

### Database Error During File Save
```
[uploadReceipt] Attempting MongoDB update {
  bookingId: "507f1f77bcf86cd799439011",
  fileName: "1702224600000-123456789.pdf",
  fileSize: 245000,
  mimeType: "application/pdf"
}

[uploadReceipt] EXCEPTION {
  bookingId: "507f1f77bcf86cd799439011",
  userId: "507f1f77bcf86cd799439010",
  errorName: "ValidationError",
  errorMessage: "Receipt object validation failed",
  stack: "..."
}
```

**Response Status**: `500 Internal Server Error`

---

## Error Code Reference

| Error Code | HTTP Status | Meaning | Action |
|---|---|---|---|
| `VALIDATION_ERROR` | 400 | Required field missing or invalid | Fix request data |
| `UNAUTHORIZED` | 401 | JWT token missing/invalid | Re-authenticate |
| `NOT_FOUND` | 404 | Booking doesn't exist or wrong user | Check booking ID |
| `DATA_INTEGRITY` | 500 | Database record is incomplete | Contact support |
| `BOOKING_CREATE_FAILED` | 500 | MongoDB save error | Retry or contact support |
| `BOOKING_FETCH_FAILED` | 500 | Database query error | Retry or contact support |
| `BOOKINGS_FETCH_FAILED` | 500 | List query error | Retry or contact support |
| `RECEIPT_UPLOAD_FAILED` | 500 | File save or update error | Retry or contact support |

---

## Troubleshooting Guide

### "Booking creation failed - no ID returned from MongoDB"
**Symptom**: `[createBooking] EXCEPTION` with message about no ID

**Causes**:
- MongoDB not responding
- Schema validation failure
- Database permissions issue

**Fix**:
1. Check MongoDB connection in logs before this error
2. Verify schema requirements in `models/Booking.js`
3. Check database user has write permissions

---

### "Booking not found" with valid ID
**Symptom**: `[getBookingById] NOT_FOUND` even though booking exists

**Causes**:
- Booking belongs to different user
- Booking ID typo
- User ID in JWT doesn't match

**Fix**:
1. Verify JWT token contains correct userId
2. Check booking exists: `db.bookings.findById(bookingId)`
3. Verify ownership: `db.bookings.findOne({ _id: bookingId, userId: userId })`

---

### "File validation failed"
**Symptom**: `[uploadReceipt] File validation failed`

**Causes**:
- File didn't save to disk properly
- Multer filename not set
- File size is 0

**Fix**:
1. Check `/uploads/receipts` directory exists and is writable
2. Verify multer storage configuration
3. Check file wasn't corrupted during upload

---

### "Receipt metadata not saved to booking"
**Symptom**: `[uploadReceipt] Verification failed`

**Causes**:
- Save didn't persist to database
- Receipt array initialization failed
- Database transaction issue

**Fix**:
1. Manually query booking: `db.bookings.findById(bookingId)`
2. Check `receiptUploads` array exists
3. Verify database replication (if using replica set)

---

## Monitoring Recommendations

### Watch for These Patterns

1. **Multiple VALIDATION_ERROR for same user**: Possible UI bug not validating before submit
2. **Repeated UNAUTHORIZED errors**: JWT expiration or frontend not storing token
3. **Spikes in DATABASE errors**: Check MongoDB connection/performance
4. **Data Integrity errors increasing**: Schema drift or data corruption

### Log Aggregation

For production, aggregate these logs:
```
[createBooking] Request received
[createBooking] SUCCESS / EXCEPTION
[getBookingById] Request received
[getBookingById] SUCCESS / NOT_FOUND / EXCEPTION
[uploadReceipt] Request received
[uploadReceipt] SUCCESS / EXCEPTION
```

---

## Frontend Integration

Frontend should:

1. **Display validation errors by field**: Use `response.field` value
2. **Handle errorCode**: Don't show raw error messages; handle by code
3. **Log significant events**: Send booking-related logs to error tracking service
4. **Retry on 500 errors**: Implement exponential backoff for temporary failures
5. **Display success feedback**: Show bookingId to user after creation

Example:
```javascript
fetch('/api/bookings', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({ serviceName, totalAmount })
})
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      // Store bookingId
      sessionStorage.setItem('bookingId', data.bookingId);
      // Show success
      showNotification(`Booking ${data.bookingId} created!`);
    } else if (data.field) {
      // Show field-specific error
      showFieldError(data.field, data.message);
    } else {
      // Show generic error
      showError(data.message);
    }
  });
```


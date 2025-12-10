# Booking Submission Flow - Backend Verification

## Summary
The backend booking creation endpoint is fully configured to:
1. ✅ Validate required fields (`serviceName`, `totalAmount`)
2. ✅ Save booking immediately to MongoDB
3. ✅ Return complete booking object with `_id` field
4. ✅ Return explicit `bookingId` (string of `_id`)
5. ✅ Enable frontend to fetch booking by ID from any session/browser/device
6. ✅ Support admin receipt review across all sessions

---

## Schema & Validation

### Required Fields (MongoDB Schema)
- **userId** (ObjectId, ref: User) - from JWT token
- **serviceName** (String) - validated non-empty before create
- **totalAmount** (Number) - validated > 0 before create

### Optional Fields
- **serviceDetails** (String)
- **scheduledDate** (Date)
- **notes** (String)

### Database Fields
- **paymentStatus** (enum: 'pending', 'receipt_submitted', 'completed')
- **paymentCompletedAt** (Date) - set when admin approves
- **receiptUploads** (array of receipt objects)
- **createdAt**, **updatedAt** (automatic timestamps)

---

## Endpoint: POST /api/bookings (Create Booking)

### Request
```json
{
  "serviceName": "Web Development",
  "serviceDetails": "Full-stack development",
  "scheduledDate": "2025-12-20",
  "totalAmount": 5000,
  "notes": "Urgent project"
}
```

### Validation (Pre-Save)
```javascript
// serviceName validation
if (!serviceName || !serviceName.trim()) {
  return 400 with errorCode: 'VALIDATION_ERROR', field: 'serviceName'
}

// totalAmount validation
if (Number.isNaN(amount) || amount <= 0) {
  return 400 with errorCode: 'VALIDATION_ERROR', field: 'totalAmount'
}

// userId validation from JWT
if (!req.user || !req.user.userId) {
  return 401 with errorCode: 'UNAUTHORIZED'
}
```

### Success Response (201)
```json
{
  "message": "Booking created successfully",
  "success": true,
  "booking": {
    "_id": "507f1f77bcf86cd799439011",
    "userId": "507f1f77bcf86cd799439010",
    "serviceName": "Web Development",
    "serviceDetails": "Full-stack development",
    "scheduledDate": "2025-12-20T00:00:00.000Z",
    "totalAmount": 5000,
    "notes": "Urgent project",
    "paymentStatus": "pending",
    "receiptUploads": [],
    "createdAt": "2025-12-10T10:30:00.000Z",
    "updatedAt": "2025-12-10T10:30:00.000Z"
  },
  "bookingId": "507f1f77bcf86cd799439011",
  "paymentStatus": "pending"
}
```

### Error Responses

#### Missing serviceName (400)
```json
{
  "success": false,
  "errorCode": "VALIDATION_ERROR",
  "message": "Service name is required.",
  "field": "serviceName"
}
```

#### Missing/Invalid totalAmount (400)
```json
{
  "success": false,
  "errorCode": "VALIDATION_ERROR",
  "message": "Valid total amount greater than 0 is required.",
  "field": "totalAmount"
}
```

#### Missing JWT Token (401)
```json
{
  "success": false,
  "errorCode": "UNAUTHORIZED",
  "message": "Unauthorized: User ID not found in token"
}
```

#### MongoDB Save Error (500)
```json
{
  "success": false,
  "errorCode": "BOOKING_CREATE_FAILED",
  "message": "Unable to create booking",
  "error": "An error occurred while creating your booking. Please try again."
}
```

---

## Endpoint: GET /api/bookings/:id (Get Booking by ID)

### Request
```
GET /api/bookings/507f1f77bcf86cd799439011
Authorization: Bearer <JWT_TOKEN>
```

### Database Validation
```javascript
// Check JWT token exists
if (!req.user || !req.user.userId) {
  return 401 with errorCode: 'UNAUTHORIZED'
}

// Validate ObjectId format
if (!mongoose.Types.ObjectId.isValid(id)) {
  return 400 with errorCode: 'VALIDATION_ERROR'
}

// Ensure booking belongs to authenticated user
const booking = await Booking.findOne({
  _id: new ObjectId(id),
  userId: new ObjectId(req.user.userId)
})
```

### Success Response (200)
```json
{
  "success": true,
  "booking": {
    "_id": "507f1f77bcf86cd799439011",
    "userId": "507f1f77bcf86cd799439010",
    "serviceName": "Web Development",
    "totalAmount": 5000,
    "paymentStatus": "pending",
    "receiptUploads": [],
    "createdAt": "2025-12-10T10:30:00.000Z",
    "updatedAt": "2025-12-10T10:30:00.000Z"
  },
  "bookingId": "507f1f77bcf86cd799439011",
  "paymentStatus": "pending"
}
```

### Error Responses

#### Invalid Booking ID Format (400)
```json
{
  "success": false,
  "errorCode": "VALIDATION_ERROR",
  "message": "Invalid booking ID format",
  "bookingId": "invalid_id"
}
```

#### Booking Not Found (404)
```json
{
  "success": false,
  "errorCode": "NOT_FOUND",
  "message": "Booking not found",
  "bookingId": "507f1f77bcf86cd799439011"
}
```

#### Data Integrity Issue (500)
```json
{
  "success": false,
  "errorCode": "DATA_INTEGRITY",
  "message": "Booking data is incomplete",
  "bookingId": "507f1f77bcf86cd799439011"
}
```

---

## Endpoint: POST /api/bookings/:id/receipt (Upload Receipt)

### Request
```
POST /api/bookings/507f1f77bcf86cd799439011/receipt
Authorization: Bearer <JWT_TOKEN>
Content-Type: multipart/form-data

[file]: receipt.pdf
```

### Validation
```javascript
// File exists
if (!req.file) {
  return 400 with errorCode: 'VALIDATION_ERROR'
}

// Valid JWT
if (!req.user || !req.user.userId) {
  return 401 with errorCode: 'UNAUTHORIZED'
}

// Valid booking ID format
if (!mongoose.Types.ObjectId.isValid(id)) {
  return 400 with errorCode: 'VALIDATION_ERROR'
}

// Booking belongs to user
const booking = await Booking.findOne({
  _id: new ObjectId(id),
  userId: new ObjectId(req.user.userId)
})

// File validation
if (!req.file.filename || !req.file.size) {
  return 400 with errorCode: 'VALIDATION_ERROR'
}
```

### Success Response (200)
```json
{
  "message": "Receipt uploaded successfully",
  "success": true,
  "booking": {
    "_id": "507f1f77bcf86cd799439011",
    "userId": "507f1f77bcf86cd799439010",
    "serviceName": "Web Development",
    "totalAmount": 5000,
    "paymentStatus": "receipt_submitted",
    "receiptUploads": [
      {
        "filename": "1702224600000-123456789.pdf",
        "url": "https://fyp-project-backend.onrender.com/uploads/receipts/1702224600000-123456789.pdf",
        "mimeType": "application/pdf",
        "size": 245000,
        "uploadedAt": "2025-12-10T10:30:00.000Z"
      }
    ],
    "createdAt": "2025-12-10T10:30:00.000Z",
    "updatedAt": "2025-12-10T10:31:00.000Z"
  },
  "bookingId": "507f1f77bcf86cd799439011",
  "paymentStatus": "receipt_submitted",
  "receiptUrl": "https://fyp-project-backend.onrender.com/uploads/receipts/1702224600000-123456789.pdf",
  "receiptFile": "1702224600000-123456789.pdf"
}
```

### Error Responses

#### No File Uploaded (400)
```json
{
  "success": false,
  "errorCode": "VALIDATION_ERROR",
  "message": "Receipt file is required.",
  "bookingId": "507f1f77bcf86cd799439011"
}
```

#### File Type Not Allowed (400)
```json
{
  "message": "Only PNG, JPG, and PDF files are allowed."
}
```

---

## Frontend Implementation Guide

### Step 1: Create Booking
```javascript
const response = await fetch('/api/bookings', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${jwtToken}`
  },
  body: JSON.stringify({
    serviceName: 'Web Development',
    totalAmount: 5000
  })
});

const data = await response.json();

if (!response.ok) {
  // Handle error
  console.error(data.errorCode, data.message);
  console.error('Field:', data.field); // if validation error
  return;
}

// IMPORTANT: Store bookingId for payment page
const bookingId = data.bookingId;
// Option 1: Store in state
setState({ bookingId });
// Option 2: Store in sessionStorage (survives page reload in same session)
sessionStorage.setItem('bookingId', bookingId);
// Option 3: Store in localStorage (survives across sessions, but device-specific)
// localStorage.setItem('bookingId', bookingId);
```

### Step 2: Proceed to Payment Page
```javascript
// Navigate to payment page
navigate(`/payment/${bookingId}`);

// OR in payment page, retrieve booking to verify it exists
const response = await fetch(`/api/bookings/${bookingId}`, {
  headers: {
    'Authorization': `Bearer ${jwtToken}`
  }
});

const data = await response.json();

if (response.ok) {
  // Booking exists and is accessible
  setBooking(data.booking);
  setProceedToPayment(true);
} else {
  // Booking not found or invalid
  console.error(data.errorCode, data.message);
}
```

### Step 3: Upload Receipt (After Payment)
```javascript
const formData = new FormData();
formData.append('receipt', fileInput.files[0]);

const response = await fetch(`/api/bookings/${bookingId}/receipt`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jwtToken}`
  },
  body: formData
});

const data = await response.json();

if (response.ok) {
  // Receipt uploaded, payment status is now 'receipt_submitted'
  console.log('Receipt URL:', data.receiptUrl);
} else {
  console.error(data.errorCode, data.message);
}
```

---

## Admin Review Flow

### Admin retrieves pending receipts across any browser/device
```
GET /api/admin/bookings/receipt-queue
Authorization: Bearer <ADMIN_JWT_TOKEN>
```

Response includes all bookings with `paymentStatus: 'receipt_submitted'`, populated with user info:
```json
{
  "bookings": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "userId": {
        "_id": "507f1f77bcf86cd799439010",
        "name": "John Doe",
        "email": "john@example.com",
        "phone": "+1234567890"
      },
      "serviceName": "Web Development",
      "totalAmount": 5000,
      "paymentStatus": "receipt_submitted",
      "receiptUploads": [
        {
          "filename": "receipt.pdf",
          "url": "https://fyp-project-backend.onrender.com/uploads/receipts/receipt.pdf"
        }
      ],
      "createdAt": "2025-12-10T10:30:00.000Z"
    }
  ]
}
```

### Admin downloads receipt and approves
```
POST /api/admin/bookings/507f1f77bcf86cd799439011/approve
Authorization: Bearer <ADMIN_JWT_TOKEN>
```

Booking status changes to `'completed'` with `paymentCompletedAt` timestamp set.

---

## Key Guarantees

✅ **Immediate Persistence**: Booking saved to MongoDB before response returned  
✅ **Complete Object**: Full booking object with all fields returned in response  
✅ **Explicit ID**: `bookingId` field contains string representation of MongoDB `_id`  
✅ **Session-Agnostic**: Can retrieve booking via `GET /api/bookings/:id` from any browser/device with valid JWT  
✅ **Admin Accessible**: All receipts and booking data stored in MongoDB, accessible to admins across devices  
✅ **Validation**: Required fields validated before save; structured error responses with field information  
✅ **Data Integrity**: Booking creation verified (checks `_id` exists); booking data checked before return  

---

## Database Schema Verification

```javascript
// Booking model fields
{
  userId: ObjectId (required),
  serviceName: String (required),
  serviceDetails: String (optional),
  scheduledDate: Date (optional),
  totalAmount: Number (required, > 0),
  notes: String (optional),
  paymentStatus: String (enum: 'pending', 'receipt_submitted', 'completed'),
  paymentCompletedAt: Date (optional),
  receiptUploads: Array of { filename, url, mimeType, size, uploadedAt },
  createdAt: Date (auto),
  updatedAt: Date (auto)
}
```

All fields are persisted to MongoDB. No session state, no browser cache, no local storage dependency.

---

## Testing Checklist

- [ ] POST /api/bookings with valid data → returns 201 with bookingId
- [ ] POST /api/bookings missing serviceName → returns 400 with errorCode: VALIDATION_ERROR
- [ ] POST /api/bookings with totalAmount ≤ 0 → returns 400 with errorCode: VALIDATION_ERROR
- [ ] POST /api/bookings without JWT → returns 401 with errorCode: UNAUTHORIZED
- [ ] GET /api/bookings/:id → returns 200 with full booking object
- [ ] GET /api/bookings/:id from different browser → returns same booking
- [ ] GET /api/bookings/:id invalid format → returns 400 with errorCode: VALIDATION_ERROR
- [ ] GET /api/bookings/:id wrong user → returns 404 with errorCode: NOT_FOUND
- [ ] POST /api/bookings/:id/receipt → returns 200 with updated booking
- [ ] GET /api/admin/bookings/receipt-queue → lists all pending receipts
- [ ] POST /api/admin/bookings/:id/approve → updates status to 'completed'


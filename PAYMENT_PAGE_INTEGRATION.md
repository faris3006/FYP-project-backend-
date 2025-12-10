# Booking Payment Integration Guide

## Overview
The backend provides complete booking data endpoints to support the payment page. All booking information is stored in MongoDB and can be retrieved with comprehensive details including service information, scheduled dates, amounts, and QR codes.

---

## API Endpoints

### 1. Create Booking
**Endpoint:** `POST /api/bookings`  
**Authentication:** Required (JWT Bearer Token)

**Request Body:**
```json
{
  "serviceName": "Web Development",
  "serviceDetails": "Build a responsive e-commerce website",
  "scheduledDate": "2025-12-20T10:00:00Z",
  "totalAmount": 5000,
  "notes": "Include mobile optimization"
}
```

**Response (201 Created):**
```json
{
  "message": "Booking created successfully",
  "success": true,
  "booking": {
    "_id": "507f1f77bcf86cd799439011",
    "userId": "507f1f77bcf86cd799439010",
    "serviceName": "Web Development",
    "serviceDetails": "Build a responsive e-commerce website",
    "scheduledDate": "2025-12-20T10:00:00.000Z",
    "totalAmount": 5000,
    "notes": "Include mobile optimization",
    "paymentStatus": "pending",
    "qrCode": "QR-1702224600000-A3F9B2-7E4C",
    "receiptUploads": [],
    "createdAt": "2025-12-10T10:30:00.000Z",
    "updatedAt": "2025-12-10T10:30:00.000Z"
  },
  "bookingId": "507f1f77bcf86cd799439011",
  "qrCode": "QR-1702224600000-A3F9B2-7E4C",
  "paymentStatus": "pending"
}
```

**Key Return Values:**
- `booking`: Complete booking object with all details
- `bookingId`: String format of MongoDB ObjectId (for URL navigation)
- `qrCode`: Unique QR code for payment verification
- `paymentStatus`: Always "pending" for new bookings

### 2. Get Booking by ID (Payment Page)
**Endpoint:** `GET /api/bookings/:id`  
**Authentication:** Required (JWT Bearer Token)  
**URL Parameter:** `id` - The bookingId returned from creation

**Example Request:**
```bash
curl -X GET http://localhost:10000/api/bookings/507f1f77bcf86cd799439011 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response (200 OK):**
```json
{
  "success": true,
  "booking": {
    "_id": "507f1f77bcf86cd799439011",
    "userId": "507f1f77bcf86cd799439010",
    "serviceName": "Web Development",
    "serviceDetails": "Build a responsive e-commerce website",
    "scheduledDate": "2025-12-20T10:00:00.000Z",
    "totalAmount": 5000,
    "notes": "Include mobile optimization",
    "paymentStatus": "pending",
    "qrCode": "QR-1702224600000-A3F9B2-7E4C",
    "receiptUploads": [],
    "createdAt": "2025-12-10T10:30:00.000Z",
    "updatedAt": "2025-12-10T10:30:00.000Z"
  },
  "bookingId": "507f1f77bcf86cd799439011",
  "paymentStatus": "pending"
}
```

**Use on Payment Page:**
```javascript
// Fetch booking details
const bookingId = /* from URL params */;
const response = await fetch(`/api/bookings/${bookingId}`, {
  headers: { 'Authorization': `Bearer ${jwtToken}` }
});

const { booking, qrCode } = await response.json();

// Display to user
document.getElementById('serviceName').textContent = booking.serviceName;
document.getElementById('amount').textContent = `$${booking.totalAmount}`;
document.getElementById('qrCode').textContent = qrCode;
document.getElementById('date').textContent = new Date(booking.scheduledDate).toLocaleDateString();
document.getElementById('details').textContent = booking.serviceDetails;
```

### 3. Get All User Bookings
**Endpoint:** `GET /api/bookings`  
**Authentication:** Required (JWT Bearer Token)

**Response (200 OK):**
```json
{
  "success": true,
  "bookings": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "userId": "507f1f77bcf86cd799439010",
      "serviceName": "Web Development",
      "totalAmount": 5000,
      "paymentStatus": "pending",
      "qrCode": "QR-1702224600000-A3F9B2-7E4C",
      "createdAt": "2025-12-10T10:30:00.000Z",
      "updatedAt": "2025-12-10T10:30:00.000Z"
    },
    {
      "_id": "507f1f77bcf86cd799439012",
      "userId": "507f1f77bcf86cd799439010",
      "serviceName": "Logo Design",
      "totalAmount": 2000,
      "paymentStatus": "completed",
      "qrCode": "QR-1702224700000-B5F9C3-8G6E",
      "createdAt": "2025-12-09T14:20:00.000Z",
      "updatedAt": "2025-12-09T16:45:00.000Z"
    }
  ]
}
```

---

## Booking Object Schema

**Field Descriptions:**

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | MongoDB unique identifier for the booking |
| `userId` | ObjectId | Reference to the User who created the booking |
| `serviceName` | String | Name of the service (e.g., "Web Development") |
| `serviceDetails` | String | Optional detailed description of the service |
| `scheduledDate` | Date | Optional scheduled date/time for the service |
| `totalAmount` | Number | Total amount in currency units (e.g., PKR) |
| `notes` | String | Optional additional notes from the user |
| `paymentStatus` | String | One of: `pending`, `receipt_submitted`, `completed` |
| `qrCode` | String | Unique QR code for payment verification |
| `receiptUploads` | Array | Array of receipt objects with file details |
| `createdAt` | Date | Timestamp when booking was created (auto) |
| `updatedAt` | Date | Timestamp of last update (auto) |

**Receipt Object (in receiptUploads):**
```json
{
  "filename": "1702224600000-123456789.pdf",
  "url": "/uploads/receipts/1702224600000-123456789.pdf",
  "mimeType": "application/pdf",
  "size": 245678,
  "uploadedAt": "2025-12-10T12:45:00.000Z"
}
```

---

## Error Responses

### Validation Error (400)
```json
{
  "success": false,
  "errorCode": "VALIDATION_ERROR",
  "message": "Service name is required.",
  "field": "serviceName"
}
```

### Authorization Error (401)
```json
{
  "success": false,
  "errorCode": "UNAUTHORIZED",
  "message": "Unauthorized: User ID not found in token"
}
```

### Duplicate QR Code Error (409)
```json
{
  "success": false,
  "errorCode": "DUPLICATE_QR_CODE",
  "message": "A booking with this QR code already exists. Please try again.",
  "field": "qrCode",
  "retryable": true
}
```

### Not Found Error (404)
```json
{
  "success": false,
  "errorCode": "NOT_FOUND",
  "message": "Booking not found",
  "bookingId": "507f1f77bcf86cd799439011"
}
```

### Server Error (500)
```json
{
  "success": false,
  "errorCode": "BOOKING_CREATE_FAILED",
  "message": "Unable to create booking",
  "error": "An error occurred while creating your booking. Please try again."
}
```

---

## Data Storage & Retrieval

### What's Stored in MongoDB
✅ All booking details are immediately saved to MongoDB  
✅ No reliance on browser storage or sessions  
✅ Data persists across devices and browsers  
✅ Admin can retrieve any booking by ID  
✅ QR code is unique and indexed for fast lookup  

### Data Integrity Checks
The backend verifies:
- Required fields are present (serviceName, totalAmount, userId)
- Total amount is a positive number
- User is authenticated via JWT
- Booking ID is a valid MongoDB ObjectId
- Booking belongs to the authenticated user (except admin)

---

## Payment Page Implementation

### Step 1: Get JWT Token
```javascript
const jwtToken = localStorage.getItem('jwt_token');
```

### Step 2: Extract Booking ID from URL
```javascript
const bookingId = new URLSearchParams(window.location.search).get('bookingId');
// OR from URL path: /payment/507f1f77bcf86cd799439011
const bookingId = window.location.pathname.split('/').pop();
```

### Step 3: Fetch Booking Details
```javascript
async function fetchBookingDetails(bookingId, jwtToken) {
  try {
    const response = await fetch(`/api/bookings/${bookingId}`, {
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const { booking, paymentStatus } = await response.json();
    return booking;

  } catch (error) {
    console.error('Failed to fetch booking:', error);
    // Show error UI
    document.getElementById('error').textContent = 'Failed to load booking details.';
  }
}
```

### Step 4: Display Booking Details
```javascript
function displayBookingDetails(booking) {
  // Service information
  document.getElementById('serviceName').textContent = booking.serviceName;
  document.getElementById('serviceDetails').textContent = booking.serviceDetails || 'N/A';
  
  // Amount
  document.getElementById('amount').textContent = `${booking.totalAmount} PKR`;
  
  // Date
  if (booking.scheduledDate) {
    const date = new Date(booking.scheduledDate);
    document.getElementById('scheduledDate').textContent = date.toLocaleDateString();
  }
  
  // QR Code
  document.getElementById('qrCode').textContent = booking.qrCode;
  
  // Notes
  if (booking.notes) {
    document.getElementById('notes').textContent = booking.notes;
  }
}
```

### Step 5: Complete Payment
```javascript
async function completePayment(bookingId, paymentDetails) {
  // Your payment gateway integration here
  // After successful payment, you can:
  // 1. Upload receipt via POST /api/bookings/:id/receipt
  // 2. Update payment status (admin only)
}
```

---

## Testing

### Test Booking Creation
```bash
# 1. Create booking
curl -X POST http://localhost:10000/api/bookings \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceName": "Test Service",
    "serviceDetails": "Test Description",
    "scheduledDate": "2025-12-20T10:00:00Z",
    "totalAmount": 1000,
    "notes": "Test notes"
  }'

# Response includes: bookingId, qrCode, booking object
```

### Test Booking Retrieval
```bash
# 2. Get booking by ID (use bookingId from creation response)
curl -X GET http://localhost:10000/api/bookings/507f1f77bcf86cd799439011 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Response includes: complete booking object
```

### Verify Data in MongoDB
```javascript
// In MongoDB Atlas console
db.bookings.findOne({ _id: ObjectId("507f1f77bcf86cd799439011") })

// Should return full booking object with all fields
```

---

## Security Notes

✅ All endpoints require JWT authentication  
✅ Users can only fetch their own bookings (unless admin)  
✅ QR codes are unique and cannot be duplicated  
✅ MongoDB indexes ensure fast lookup  
✅ Data is server-side only (not sent to browser storage)  
✅ Sensitive fields are properly validated  

---

## Common Issues & Solutions

**"Booking not found" on payment page:**
- Verify bookingId is correct (from booking creation response)
- Check JWT token is valid and not expired
- Ensure booking belongs to authenticated user

**"E11000 duplicate key error":**
- Frontend automatically retries (409 with `retryable: true`)
- If persists, check MongoDB for duplicate QR codes
- Verify unique index exists: `db.bookings.getIndexes()`

**Payment page shows "undefined" for amount:**
- Verify `booking.totalAmount` is numeric (not string)
- Check API response includes `booking` object
- Confirm fetch call includes Authorization header

**Booking not saving to database:**
- Check MongoDB connection string in `.env`
- Verify all required fields are provided
- Check server logs for validation errors
- Ensure user is authenticated (JWT valid)

---

## Deployment Checklist

Before deploying to production:

✅ All booking fields stored in MongoDB  
✅ QR codes generated uniquely for each booking  
✅ `GET /api/bookings/:id` endpoint returns full booking object  
✅ Payment page can fetch and display booking details  
✅ Error responses include `errorCode` and `retryable` flags  
✅ Database indexes created for qrCode uniqueness  
✅ Migration run for existing bookings (if applicable)  
✅ Frontend updated to handle all response fields  
✅ JWT token validation working on all endpoints  
✅ CORS configured to allow frontend origin  


# Backend Status & Configuration

## ✅ Backend Deployment Status

**Status:** ✅ DEPLOYED AND LIVE

## 🔧 Configuration Checklist

### 1. ✅ CORS Settings
**Status:** CONFIGURED

CORS is configured to allow requests from:
- ✅ `https://fyp-project-nine-gray.vercel.app` (Production Vercel frontend)
- ✅ `http://localhost:3000` (Local development)
- ✅ `http://localhost:3001` (Local development alternative)

**Location:** `server.js` lines 17-24

### 2. ✅ Environment Variables
**Status:** REQUIRED ON RENDER DASHBOARD

Make sure these are set in Render dashboard → Environment Variables (see `env.example` for the complete list):

```
DB_URI=<your-mongodb-connection-string>
JWT_SECRET=<generate_a_strong_random_string>
SENDGRID_API_KEY=<sendgrid_api_key>
EMAIL_FROM=<notification_sender_email>
EMAIL_FROM_NAME=<display_name_for_emails>
BACKEND_URL=<https://your-render-service.onrender.com>
ADMIN_EMAIL=<admin_user_email>
ADMIN_PASSWORD=<admin_user_password>
ADMIN_NAME=<admin_display_name>
ADMIN_PHONE=<admin_phone_number>
PORT=10000
NODE_ENV=production
```

**Important:** 
- Never commit real secrets to Git. Configure them only via Render's dashboard or local `.env`.
- Replace `JWT_SECRET` with a strong random string.
- Verify MongoDB Atlas IP whitelist allows all IPs (0.0.0.0/0).

### 3. ✅ Backend URL Testing

**Test Endpoints:**

1. **Root endpoint (Health check):**
   ```
   GET https://your-backend-url.onrender.com/
   ```
   Expected: `{ message: "Backend API is running", status: "OK" }`

2. **Login endpoint (Test API):**
   ```
   POST https://your-backend-url.onrender.com/api/auth/login
   Body: { "email": "test@test.com", "password": "test" }
   ```
   Expected: Error message (confirms API is working)

3. **Admin bookings (Test with auth):**
   ```
   GET https://your-backend-url.onrender.com/api/admin/bookings
   Headers: Authorization: Bearer <token>
   ```
   Expected: Authentication error without token (confirms route works)

## 📋 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/verify-email` - Email verification
- `POST /api/auth/verify-mfa` - MFA verification

### Bookings (Requires JWT)
- `POST /api/bookings` - Create booking
- `GET /api/bookings` - Get user's bookings
- `GET /api/bookings/:id` - Get booking by ID
- `POST /api/bookings/:id/receipt` - Upload receipt

### Admin (Requires JWT + Admin role)
- `GET /api/admin/users` - Get all users
- `GET /api/admin/bookings` - Get all bookings
- `GET /api/admin/bookings/receipt-queue` - Get receipt review queue
- `PUT /api/admin/bookings/:id/payment` - Update payment status

## 🔍 Troubleshooting

### If CORS errors occur:
1. Verify frontend URL matches exactly: `https://fyp-project-nine-gray.vercel.app`
2. Check Render logs for CORS-related errors
3. Ensure `credentials: true` is set in CORS config

### If database connection fails:
1. Check MongoDB Atlas IP whitelist (should include 0.0.0.0/0)
2. Verify DB_URI environment variable in Render
3. Check Render logs for connection errors

### If authentication fails:
1. Verify JWT_SECRET is set in Render environment variables
2. Check token expiration (default: 1 hour)
3. Verify Authorization header format: `Bearer <token>`

## 📝 Notes for Frontend Team

- **Base URL:** Use your Render backend URL (e.g., `https://booking-backend-xxxx.onrender.com`)
- **CORS:** Already configured for your Vercel domain
- **Authentication:** All booking/admin endpoints require JWT token in Authorization header
- **File Uploads:** Receipt uploads are limited to 20MB (PNG, JPG, PDF)






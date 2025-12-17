const dotenv = require('dotenv');
dotenv.config(); // Load environment variables FIRST

// ===== VALIDATE ENVIRONMENT VARIABLES =====
const requiredEnvVars = ['JWT_SECRET', 'DB_URI'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);

if (missingVars.length > 0) {
  console.error('⚠️  FATAL: Missing required environment variables:');
  missingVars.forEach(v => console.error(`   - ${v}`));
  console.error('Please ensure these are set in your Render environment variables.');
  process.exit(1);
}

console.log('✅ Environment variables validated');

// ===== LOAD DEPENDENCIES =====
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const compression = require('compression');

// ===== LOAD ROUTES & MIDDLEWARE =====
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const authenticateJWT = require('./middleware/authenticateJWT');
const { sendVerificationEmail } = require('./utils/emailUtils');
const { initializeSendGrid } = require('./config/emailConfig');

const app = express();

// ===== CORS SETTINGS =====
const PRIMARY_ORIGIN = 'https://fyp-project-nine-gray.vercel.app';
const DEV_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001'
];

const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [PRIMARY_ORIGIN]
  : [PRIMARY_ORIGIN, ...DEV_ORIGINS];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (no Origin header) and default to primary origin
    if (!origin) return callback(null, PRIMARY_ORIGIN);

    if (allowedOrigins.includes(origin)) {
      return callback(null, origin);
    }

    console.log('⚠️  CORS blocked origin:', origin);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  optionsSuccessStatus: 204
};

// ===== INITIALIZE SENDGRID (NON-BLOCKING) =====
// Run SendGrid initialization in background to not block server startup
setImmediate(() => {
  try {
    const initialized = initializeSendGrid();
    if (initialized) {
      console.log('✅ SendGrid initialized successfully');
    } else {
      console.warn('⚠️  SendGrid not available - email features will be disabled until configured');
    }
  } catch (err) {
    console.warn('⚠️  SendGrid initialization error (continuing without email):', err.message);
  }
});

// ===== MIDDLEWARE CONFIGURATION =====

// Set request timeout to 60 seconds for slow connections
app.use((req, res, next) => {
  req.setTimeout(60000);
  res.setTimeout(60000);
  next();
});

// Enable gzip compression for better performance on cellular networks
try {
  app.use(compression());
  console.log('✅ Compression middleware enabled');
} catch (e) {
  console.warn('⚠️  Compression middleware not available, continuing without it');
}

// CORS configuration - lock production to primary origin, allow localhost in dev
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Ensure CORS headers are present on all responses (including errors)
app.use((req, res, next) => {
  const requestOrigin = req.headers.origin;
  const allowOrigin = allowedOrigins.includes(requestOrigin) ? requestOrigin : PRIMARY_ORIGIN;

  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

console.log('✅ CORS configured');

// Security headers for clickjacking protection
app.use((req, res, next) => {
  // Prevent clickjacking by blocking iframe embedding
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Modern alternative to X-Frame-Options
  res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
  
  // Prevent MIME-type sniffing attacks
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  next();
});

console.log('✅ Clickjacking protection enabled');

// Body parser with size limits
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploaded receipts with proper cache headers
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '1d',
  etag: false
}));

console.log('✅ Static file serving configured');

// ===== ROUTE HANDLERS =====

// Root route for testing
app.get('/', (req, res) => {
  res.json({
    message: 'Backend API is running',
    status: 'OK',
    endpoints: {
      auth: '/api/auth',
      bookings: '/api/bookings',
      admin: '/api/admin',
      testEmail: '/api/test-email',
      health: '/health'
    }
  });
});

// Health check endpoint (for Render deployment monitoring)
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Test email endpoint
app.post('/api/test-email', (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ 
      success: false,
      message: 'Email is required' 
    });
  }

  try {
    // Send a test verification email
    sendVerificationEmail(email, 'test-user-id');

    res.json({
      success: true,
      message: 'Test email sent successfully!',
      email: email,
      note: 'Check your inbox for the verification email from the configured sender address.'
    });
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to send test email', 
      error: error.message 
    });
  }
});

// Authentication Routes (NO JWT required)
app.use('/api/auth', authRoutes);

// Booking Routes (JWT required)
app.use('/api/bookings', authenticateJWT, bookingRoutes);

// Admin Routes (JWT required)
app.use('/api/admin', authenticateJWT, adminRoutes);

// 404 Handler - Route not found
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path,
    method: req.method,
    availableEndpoints: {
      health: 'GET /health',
      root: 'GET /',
      auth: 'POST /api/auth/register, POST /api/auth/login',
      bookings: 'GET /api/bookings, POST /api/bookings, GET /api/bookings/:id',
      admin: 'GET /api/admin/...'
    }
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Unexpected error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ===== DATABASE CONNECTION =====
console.log('Connecting to database...');
mongoose.connect(process.env.DB_URI, {
  serverSelectionTimeoutMS: 10000, // Increased from 5s to 10s
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000, // Socket timeout
  retryWrites: true,
  w: 'majority'
})
  .then(() => {
    console.log('✅ Database connected successfully');
  })
  .catch((error) => {
    console.error('❌ Database connection failed:', error.message);
    console.error('MongoDB connection error details:', {
      code: error.code,
      codeName: error.codeName,
      message: error.message
    });
    console.error('Verify your DB_URI environment variable is correct');
    // Don't exit - allow the app to start without database
    // Queries will fail, but you can debug the connection issue
    console.log('ℹ️  Continuing without database connection...');
  });

// ===== START SERVER =====
const port = process.env.PORT || 5000;

const server = app.listen(port, '0.0.0.0', () => {
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`✅ Server is running on port ${port}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Backend URL: ${process.env.BACKEND_URL || `http://localhost:${port}`}`);
  console.log('═══════════════════════════════════════════════════════');
  console.log('Available endpoints:');
  console.log(`  Health: GET ${process.env.BACKEND_URL || `http://localhost:${port}`}/health`);
  console.log(`  Bookings API: ${process.env.BACKEND_URL || `http://localhost:${port}`}/api/bookings`);
  console.log('═══════════════════════════════════════════════════════\n');
});

// ===== GRACEFUL SHUTDOWN =====
process.on('SIGTERM', () => {
  console.log('\n🛑 SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('✅ HTTP server closed');
    mongoose.connection.close(false, () => {
      console.log('✅ MongoDB connection closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('\n🛑 SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('✅ HTTP server closed');
    mongoose.connection.close(false, () => {
      console.log('✅ MongoDB connection closed');
      process.exit(0);
    });
  });
});

// Unhandled promise rejection
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = server;

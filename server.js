const dotenv = require('dotenv');
dotenv.config(); // Load environment variables FIRST

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const compression = require('compression');
const authRoutes = require('./routes/authRoutes'); // Authentication routes
const adminRoutes = require('./routes/adminRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const authenticateJWT = require('./middleware/authenticateJWT'); // your JWT auth middleware
const { sendVerificationEmail } = require('./utils/emailUtils');
const { initializeSendGrid } = require('./config/emailConfig');

// Initialize SendGrid on startup
initializeSendGrid();

const app = express();

// Set request timeout to 60 seconds for slow connections
app.use((req, res, next) => {
  req.setTimeout(60000);
  res.setTimeout(60000);
  next();
});

// Enable gzip compression for better performance on cellular networks
try {
  app.use(compression());
} catch (e) {
  console.warn('Compression middleware not available, continuing without it');
}

// Middleware - CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // In production, allow all origins for easier mobile/desktop access
    if (process.env.NODE_ENV === 'production') {
      return callback(null, true);
    }

    // In development, restrict to specific origins
    const allowedOrigins = [
      'https://fyp-project-nine-gray.vercel.app',
      'https://fyp-project-git-main-faris-projects-56742192.vercel.app',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001'
    ];

    // Allow all Vercel preview URLs (pattern: *.vercel.app)
    const isVercelPreview = origin && origin.includes('.vercel.app');

    if (allowedOrigins.includes(origin) || isVercelPreview) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
})); // Enable CORS for frontend origins

// Body parser with size limits
app.use(express.json({ limit: '50mb' })); // Body parser for JSON requests
app.use(express.urlencoded({ extended: true, limit: '50mb' })); // For parsing URL-encoded data

// Serve uploaded receipts with proper cache headers
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '1d',
  etag: false
}));

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

// Health check endpoint
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
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    // Send a test verification email
    sendVerificationEmail(email, 'test-user-id');

    res.json({
      message: 'Test email sent successfully!',
      email: email,
      note: 'Check your inbox for the verification email from the configured sender address.'
    });
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({ message: 'Failed to send test email', error: error.message });
  }
});

// Authentication Routes
app.use('/api/auth', authRoutes); // Authentication-related routes (register, login)

// Database Connection (MongoDB) with timeout and retry
mongoose.connect(process.env.DB_URI, {
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 5000,
  retryWrites: true,
  w: 'majority'
})
  .then(() => console.log('Database connected successfully'))
  .catch((error) => {
    console.log('Database connection failed:', error.message);
    // Retry connection after 5 seconds
    setTimeout(() => {
      console.log('Retrying database connection...');
      mongoose.connect(process.env.DB_URI);
    }, 5000);
  });

// Start Server
const port = process.env.PORT || 5000; // Default port 5000 or the one in .env
// Register routes before starting server
app.use('/api/bookings', authenticateJWT, bookingRoutes);
app.use('/api/admin', authenticateJWT, adminRoutes);

// 404 Handler - Route not found
app.use((req, res) => {
  res.status(404).json({
    message: 'Route not found',
    path: req.path,
    method: req.method,
    availableEndpoints: {
      health: 'GET /health',
      root: 'GET /',
      auth: 'POST /api/auth/register, /api/auth/login',
      bookings: 'GET /api/bookings, POST /api/bookings',
      admin: 'GET /api/admin/...'
    }
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unexpected error:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

const server = app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Backend URL: ${process.env.BACKEND_URL || 'http://localhost:' + port}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});

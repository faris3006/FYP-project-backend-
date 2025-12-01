const dotenv = require('dotenv');
dotenv.config(); // Load environment variables FIRST

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/authRoutes'); // Authentication routes
const adminRoutes = require('./routes/adminRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const authenticateJWT = require('./middleware/authenticateJWT'); // your JWT auth middleware
const { sendVerificationEmail } = require('./utils/emailUtils');

const app = express();

// Middleware - CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // List of allowed origins
    const allowedOrigins = [
      'https://fyp-project-nine-gray.vercel.app',
      'https://fyp-project-git-main-faris-projects-56742192.vercel.app',
      'http://localhost:3000',
      'http://localhost:3001'
    ];
    
    // Allow all Vercel preview URLs (pattern: *.vercel.app)
    const isVercelPreview = origin && origin.includes('.vercel.app');
    
    if (allowedOrigins.includes(origin) || isVercelPreview) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
})); // Enable CORS for frontend origins
app.use(express.json()); // Body parser for JSON requests
app.use(express.urlencoded({ extended: true })); // For parsing URL-encoded data
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Serve uploaded receipts

// Root route for testing
app.get('/', (req, res) => {
  res.json({
    message: 'Backend API is running',
    status: 'OK',
    endpoints: {
      auth: '/api/auth',
      bookings: '/api/bookings',
      admin: '/api/admin',
      testEmail: '/api/test-email'
    }
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
      note: 'Check your inbox for the verification email from mankulim625@gmail.com'
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

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

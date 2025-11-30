const express = require('express');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/authRoutes'); // Authentication routes
const adminRoutes = require('./routes/adminRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const authenticateJWT = require('./middleware/authenticateJWT'); // your JWT auth middleware


dotenv.config(); // Load environment variables

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
      admin: '/api/admin'
    }
  });
});

// Authentication Routes
app.use('/api/auth', authRoutes); // Authentication-related routes (register, login)

// Database Connection (MongoDB) without deprecated options
mongoose.connect(process.env.DB_URI)
  .then(() => console.log('Database connected'))
  .catch((error) => console.log('Database connection failed', error));

// Start Server
const port = process.env.PORT || 5000; // Default port 5000 or the one in .env
// Register routes before starting server
app.use('/api/bookings', authenticateJWT, bookingRoutes);
app.use('/api/admin', authenticateJWT, adminRoutes);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

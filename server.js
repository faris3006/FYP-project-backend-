// Load environment variables FIRST
const dotenv = require('dotenv');
dotenv.config();

// ===== VALIDATE ENVIRONMENT VARIABLES =====
const requiredEnvVars = ['JWT_SECRET', 'DB_URI'];
if (String(process.env.RECAPTCHA_DISABLED).toLowerCase() !== 'true') {
  requiredEnvVars.push('RECAPTCHA_SECRET_KEY');
}
const missingVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  console.error('⚠️  FATAL: Missing required environment variables:');
  missingVars.forEach(v => console.error(`   - ${v}`));
  process.exit(1);
}
console.log('✅ Environment variables validated');

// ===== LOAD DEPENDENCIES =====
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const compression = require('compression');

// ===== ROUTES & MIDDLEWARE =====
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
    if (!origin) return callback(null, PRIMARY_ORIGIN);
    if (allowedOrigins.includes(origin)) return callback(null, origin);
    console.log('⚠️  CORS blocked origin:', origin);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  optionsSuccessStatus: 204
};

// ===== INITIALIZE SENDGRID =====
setImmediate(() => {
  try {
    const initialized = initializeSendGrid();
    if (initialized) console.log('✅ SendGrid initialized successfully');
    else console.warn('⚠️  SendGrid not available, email features disabled');
  } catch (err) {
    console.warn('⚠️  SendGrid initialization error:', err.message);
  }
});

// ===== MIDDLEWARE =====
app.use((req, res, next) => {
  req.setTimeout(60000);
  res.setTimeout(60000);
  next();
});

try {
  app.use(compression());
  console.log('✅ Compression middleware enabled');
} catch {
  console.warn('⚠️  Compression middleware not available');
}

app.use(cors(corsOptions));

app.use((req, res, next) => {
  const requestOrigin = req.headers.origin;
  const allowOrigin = allowedOrigins.includes(requestOrigin) ? requestOrigin : PRIMARY_ORIGIN;
  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

console.log('✅ CORS configured');

app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

console.log('✅ Clickjacking protection enabled');

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '1d',
  etag: false
}));

console.log('✅ Static file serving configured');

// ===== ROUTES =====
app.get('/', (req, res) => res.json({ message: 'Backend API is running', status: 'OK' }));

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.post('/api/test-email', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: 'Email is required' });
  sendVerificationEmail(email, 'test-user-id');
  res.json({ success: true, message: 'Test email sent successfully' });
});

app.use('/api/auth', authRoutes);
app.use('/api/bookings', authenticateJWT, bookingRoutes);
app.use('/api/admin', authenticateJWT, adminRoutes);

// ===== DATABASE =====
console.log('Connecting to database...');
mongoose.connect(process.env.DB_URI)
  .then(() => console.log('✅ Database connected successfully'))
  .catch(err => console.error('❌ Database connection failed:', err.message));

// ===== START SERVER =====
const port = process.env.PORT || 5000;
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${port}`);
});

// ===== GRACEFUL SHUTDOWN =====
const shutdown = async (signal) => {
  console.log(`\n🛑 ${signal} received: shutting down gracefully`);
  server.close(async () => {
    console.log('✅ HTTP server closed');
    try {
      await mongoose.connection.close();
      console.log('✅ MongoDB connection closed');
      process.exit(0);
    } catch (err) {
      console.error('❌ Error during shutdown:', err);
      process.exit(1);
    }
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', reason => console.error('❌ Unhandled Rejection:', reason));

module.exports = server;

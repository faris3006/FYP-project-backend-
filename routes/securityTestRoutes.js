const express = require('express');
const authenticateJWT = require('../middleware/authenticateJWT');

const router = express.Router();

// Helper: feature flag to avoid accidental exposure in production
function isPublicTestEnabled() {
  return String(process.env.ENABLE_PUBLIC_ADMIN_TEST || '').toLowerCase() === 'true';
}

// Intentionally public demo route (only active when explicitly enabled)
router.get('/public', (req, res) => {
  if (!isPublicTestEnabled()) {
    return res.status(404).json({ message: 'Not found' });
  }

  return res.json({
    message: 'Admin Test Page - PUBLIC (insecure demo)',
    warning: 'This route is intentionally left public for education. Disable ENABLE_PUBLIC_ADMIN_TEST after testing.',
  });
});

// Secure version requiring auth + admin role
router.get('/secure', authenticateJWT, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }

  return res.json({
    message: 'Admin Test Page - SECURE (properly protected)',
    user: {
      id: req.user.userId || req.user.id,
      role: req.user.role,
      email: req.user.email,
    },
  });
});

module.exports = router;

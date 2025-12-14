const BlockedIp = require('../models/BlockedIp');

/**
 * Middleware to check if the requesting IP is blocked
 * Returns 429 if IP is currently blocked
 */
const checkIpBlock = async (req, res, next) => {
  try {
    // Extract client IP (supports proxies)
    const getClientIp = (request) => {
      const xff = (request.headers['x-forwarded-for'] || '').split(',').map(s => s.trim()).filter(Boolean);
      return (xff[0] || request.ip || request.connection?.remoteAddress || '').toString();
    };

    const clientIp = getClientIp(req);
    
    // Check if IP is blocked
    const blockedEntry = await BlockedIp.findOne({ 
      ip: clientIp,
      blockedUntil: { $gt: new Date() }
    });

    if (blockedEntry) {
      const remainingMinutes = Math.ceil((blockedEntry.blockedUntil - new Date()) / 1000 / 60);
      
      return res.status(429).json({
        message: 'Too many failed login attempts from your IP address. Please try again later.',
        isIpBlocked: true,
        blockedUntil: blockedEntry.blockedUntil,
        remainingMinutes,
        reason: blockedEntry.reason
      });
    }

    next();
  } catch (error) {
    console.error('Error in checkIpBlock middleware:', error);
    // Don't block on middleware error - allow request to proceed
    next();
  }
};

module.exports = checkIpBlock;

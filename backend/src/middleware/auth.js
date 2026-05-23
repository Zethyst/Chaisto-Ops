const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ─── Verify JWT ───────────────────────────────────────────────────────────────
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId).select('-password -loginAttempts -lockUntil');
    if (!user) return res.status(401).json({ error: 'User not found' });
    if (!user.isActive) return res.status(403).json({ error: 'Account disabled. Contact admin.' });

    // Staff: enforce device binding
    if (user.role === 'staff' && user.deviceId) {
      const incomingDeviceId = req.headers['x-device-id'];
      if (incomingDeviceId && incomingDeviceId !== user.deviceId) {
        return res.status(403).json({
          error: 'Device mismatch. This account is bound to another device.',
          code: 'DEVICE_MISMATCH',
        });
      }
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired. Please login again.', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// ─── Role-Based Access Control ────────────────────────────────────────────────
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      error: `Access denied. Required role: ${roles.join(' or ')}`,
      yourRole: req.user.role,
    });
  }
  next();
};

// Convenience middleware combinations
const adminOnly = [authenticate, authorize('admin')];
const adminOrModerator = [authenticate, authorize('admin', 'moderator')];
const allRoles = [authenticate, authorize('admin', 'moderator', 'staff')];

// ─── Staff can only access their own stall's data ─────────────────────────────
const stallAccess = async (req, res, next) => {
  const { stallId } = req.params;
  if (req.user.role === 'staff' && req.user.stallId?.toString() !== stallId) {
    return res.status(403).json({ error: 'You can only access your own stall data' });
  }
  next();
};

// ─── Staff cannot edit past-submitted reports ─────────────────────────────────
const noEditLock = async (req, res, next) => {
  const Report = require('../models/Report');
  const report = await Report.findById(req.params.id);
  if (!report) return res.status(404).json({ error: 'Report not found' });
  if (req.user.role === 'staff' && report.status !== 'draft') {
    return res.status(403).json({ error: 'Submitted reports cannot be edited' });
  }
  req.report = report;
  next();
};

module.exports = { authenticate, authorize, adminOnly, adminOrModerator, allRoles, stallAccess, noEditLock };

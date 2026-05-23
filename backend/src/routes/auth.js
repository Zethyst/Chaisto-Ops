const express = require('express');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { authenticate, adminOnly } = require('../middleware/auth');
const notificationService = require('../services/notificationService');

const router = express.Router();

// Rate limiting: 10 attempts per 15 min per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
  standardHeaders: true,
});

const signToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });

// ─── POST /auth/login ─────────────────────────────────────────────────────────
router.post('/login', loginLimiter, [
  body('phone').matches(/^\d{10}$/).withMessage('Invalid phone number'),
  body('password').isLength({ min: 6 }).withMessage('Password too short'),
  body('deviceId').notEmpty().withMessage('Device ID required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { phone, password, deviceId } = req.body;

  try {
    const user = await User.findOne({ phone }).select('+password +loginAttempts +lockUntil');
    if (!user) return res.status(401).json({ error: 'Invalid phone number or password' });

    if (user.isLocked) {
      const minutes = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(423).json({ error: `Account locked. Try again in ${minutes} minute(s).` });
    }

    if (!user.isActive) return res.status(403).json({ error: 'Account disabled. Contact admin.' });

    const passwordMatch = await user.comparePassword(password);
    if (!passwordMatch) {
      await user.incLoginAttempts();
      return res.status(401).json({ error: 'Invalid phone number or password' });
    }

    // Reset login attempts on success
    await User.findByIdAndUpdate(user._id, {
      $set: { loginAttempts: 0, lastLogin: new Date(), lastLoginDevice: deviceId, lastLoginIp: req.ip },
      $unset: { lockUntil: 1 },
    });

    const token = signToken(user._id);

    // Update FCM token if provided
    if (req.body.fcmToken) {
      await User.findByIdAndUpdate(user._id, { fcmToken: req.body.fcmToken });
    }

    res.json({ token, user: user.toSafeObject() });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /auth/bind-device ───────────────────────────────────────────────────
router.post('/bind-device', authenticate, async (req, res) => {
  const { userId, deviceId, deviceName } = req.body;

  // Only allow binding for own account or admin binding for staff
  if (req.user.role === 'staff' && req.user._id.toString() !== userId) {
    return res.status(403).json({ error: 'You can only bind your own device' });
  }

  try {
    const target = await User.findById(userId);
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.deviceId && target.deviceId !== deviceId) {
      return res.status(409).json({ error: 'Account already bound to a different device. Contact admin to reset.' });
    }

    await User.findByIdAndUpdate(userId, { deviceId, ...(deviceName ? { deviceName } : {}) });
    res.json({ message: 'Device bound successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Could not bind device' });
  }
});

// ─── GET /auth/me ─────────────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  res.json(req.user.toSafeObject ? req.user.toSafeObject() : req.user);
});

// ─── POST /auth/logout ────────────────────────────────────────────────────────
router.post('/logout', authenticate, async (req, res) => {
  // Clear FCM token on logout so no more push notifications
  await User.findByIdAndUpdate(req.user._id, { $unset: { fcmToken: 1 } });
  res.json({ message: 'Logged out successfully' });
});

// ─── POST /auth/create-user (Admin only) ─────────────────────────────────────
router.post('/create-user', ...adminOnly, [
  body('name').trim().notEmpty().withMessage('Name required'),
  body('phone').matches(/^\d{10}$/).withMessage('Invalid phone number'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('role').isIn(['staff', 'moderator']).withMessage('Invalid role'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, phone, password, role, stallId } = req.body;

  try {
    const existing = await User.findOne({ phone });
    if (existing) return res.status(409).json({ error: 'Phone number already registered' });

    const user = await User.create({
      name, phone, password, role,
      stallId: stallId || null,
      createdBy: req.user._id,
    });

    // Notify admin of account creation
    console.log(`[ADMIN] Account created: ${name} (${role}) by ${req.user.name}`);

    res.status(201).json(user.toSafeObject());
  } catch (err) {
    res.status(500).json({ error: 'Could not create account' });
  }
});

// ─── POST /auth/reset-device (Admin only) ────────────────────────────────────
router.post('/reset-device', ...adminOnly, async (req, res) => {
  const { userId } = req.body;
  try {
    await User.findByIdAndUpdate(userId, { $unset: { deviceId: 1 } });
    res.json({ message: 'Device binding reset. Staff can log in from a new device.' });
  } catch {
    res.status(500).json({ error: 'Could not reset device binding' });
  }
});

// ─── POST /auth/change-password ───────────────────────────────────────────────
router.post('/change-password', authenticate, [
  body('oldPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
], async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  try {
    const user = await User.findById(req.user._id).select('+password');
    const match = await user.comparePassword(oldPassword);
    if (!match) return res.status(400).json({ error: 'Old password incorrect' });

    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password changed successfully' });
  } catch {
    res.status(500).json({ error: 'Could not change password' });
  }
});

// ─── PATCH /auth/fcm-token ────────────────────────────────────────────────────
router.patch('/fcm-token', authenticate, [
  body('fcmToken').notEmpty().withMessage('FCM token required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    await User.findByIdAndUpdate(req.user._id, { fcmToken: req.body.fcmToken });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Could not update FCM token' });
  }
});

module.exports = router;

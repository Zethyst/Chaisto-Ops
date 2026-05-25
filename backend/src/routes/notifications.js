const express = require('express');
const Notification = require('../models/Notification');
const User = require('../models/User');
const admin = require('firebase-admin');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /notifications/debug-token — shows the FCM token stored for your account
router.get('/debug-token', authenticate, async (req, res) => {
  const user = await User.findById(req.user._id).select('name fcmToken');
  res.json({ name: user.name, fcmToken: user.fcmToken || null, hasToken: !!user.fcmToken });
});

// POST /notifications/test — sends a test push to the calling user
router.post('/test', authenticate, async (req, res) => {
  const { title = '🔔 Test Notification', body = 'Push notifications are working!' } = req.body;
  try {
    const user = await User.findById(req.user._id).select('fcmToken name');
    if (!user?.fcmToken) {
      return res.status(400).json({ error: 'No FCM token on your account. Open the app and log in first.' });
    }
    await admin.messaging().send({
      token: user.fcmToken,
      notification: { title, body },
      android: { priority: 'high', notification: { sound: 'default', channelId: 'chaisto-ops-default' } },
      apns: { payload: { aps: { sound: 'default', badge: 1 } } },
    });
    res.json({ success: true, sentTo: user.name, token: user.fcmToken.slice(0, 20) + '…' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /notifications
router.get('/', authenticate, async (req, res) => {
  try {
    const filter = { userId: req.user._id };
    if (req.query.unreadOnly === 'true') filter.read = false;

    const [notifications, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).limit(60),
      Notification.countDocuments({ userId: req.user._id, read: false }),
    ]);

    res.json({ notifications, unreadCount });
  } catch {
    res.status(500).json({ error: 'Could not fetch notifications' });
  }
});

// PATCH /notifications/read-all
router.patch('/read-all', authenticate, async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.user._id, read: false }, { read: true });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Could not update notifications' });
  }
});

// PATCH /notifications/:id/read
router.patch('/:id/read', authenticate, async (req, res) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { read: true }
    );
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Could not mark notification as read' });
  }
});

module.exports = router;

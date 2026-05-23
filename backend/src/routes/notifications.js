const express = require('express');
const Notification = require('../models/Notification');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

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

const express = require('express');
const User = require('../models/User');
const { adminOnly, adminOrModerator } = require('../middleware/auth');

const router = express.Router();

// GET /v1/users — all non-admin users (admin + moderator)
router.get('/', ...adminOrModerator, async (req, res) => {
  try {
    const users = await User.find({ role: { $ne: 'admin' } }).sort({ createdAt: -1 });
    res.json(users.map((u) => u.toSafeObject()));
  } catch {
    res.status(500).json({ error: 'Could not fetch users' });
  }
});

// PATCH /v1/users/:id — toggle isActive (admin only)
router.patch('/:id', ...adminOnly, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: req.body.isActive },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user.toSafeObject());
  } catch {
    res.status(500).json({ error: 'Could not update user' });
  }
});

module.exports = router;

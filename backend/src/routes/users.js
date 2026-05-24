const express = require('express');
const User = require('../models/User');
const { adminOnly, adminOrModerator, allRoles } = require('../middleware/auth');

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

// PATCH /v1/users/:id/profile — update own name and/or profilePhoto (any authenticated user)
router.patch('/:id/profile', ...allRoles, async (req, res) => {
  try {
    if (req.user.id !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Cannot update another user\'s profile' });
    }
    const { name, profilePhoto } = req.body;
    const updates = {};
    if (name?.trim()) updates.name = name.trim();
    if (typeof profilePhoto === 'string') updates.profilePhoto = profilePhoto;
    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user.toSafeObject());
  } catch {
    res.status(500).json({ error: 'Could not update profile' });
  }
});

// PATCH /v1/users/:id — update user fields (admin only)
router.patch('/:id', ...adminOnly, async (req, res) => {
  try {
    const { isActive, stallId, stallName } = req.body;
    const updates = {};
    if (isActive != null) updates.isActive = isActive;
    if (stallId !== undefined) updates.stallId = stallId || null;
    if (stallName !== undefined) updates.stallName = stallName || null;
    const user = await User.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user.toSafeObject());
  } catch {
    res.status(500).json({ error: 'Could not update user' });
  }
});

module.exports = router;

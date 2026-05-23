const express = require('express');
const AuditLog = require('../models/AuditLog');
const { adminOnly, adminOrModerator } = require('../middleware/auth');

const router = express.Router();

// GET /v1/audit-logs — paginated audit trail (admin only)
router.get('/', ...adminOnly, async (req, res) => {
  const { action, actorId, page = 1, limit = 50 } = req.query;

  const filter = {};
  if (action) filter.action = action;
  if (actorId) filter.actorId = actorId;

  try {
    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit)),
      AuditLog.countDocuments(filter),
    ]);
    res.json({ logs, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch {
    res.status(500).json({ error: 'Could not fetch audit logs' });
  }
});

module.exports = router;

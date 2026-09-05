const express = require('express');
const { body, validationResult } = require('express-validator');
const Wastage = require('../models/Wastage');
const { allRoles, adminOrModerator } = require('../middleware/auth');

const router = express.Router();

// GET /v1/wastage
router.get('/', ...allRoles, async (req, res) => {
  const { stallId, month } = req.query;
  const filter = {};

  if (req.user.role === 'staff') {
    filter.stallId = req.user.stallId;
  } else if (stallId) {
    filter.stallId = stallId;
  }

  if (month) {
    filter.date = { $gte: `${month}-01`, $lte: `${month}-31` };
  }

  try {
    const wastage = await Wastage.find(filter).sort({ date: -1 }).limit(100);
    res.json(wastage);
  } catch {
    res.status(500).json({ error: 'Could not fetch wastage logs' });
  }
});

// POST /v1/wastage
router.post('/', ...allRoles, [
  body('stallId').notEmpty().withMessage('Pick a stall to log this wastage against'),
  body('date').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Date must be YYYY-MM-DD'),
  body('items').isArray({ min: 1 }).withMessage('Log at least one wasted item'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  // Past days are expected — logs are often entered late — but a day that has
  // not happened yet cannot have anything recorded against it
  if (req.body.date > new Date().toISOString().split('T')[0]) {
    return res.status(400).json({ error: 'Cannot log for a future date' });
  }

  if (req.user.role === 'staff' && req.user.stallId?.toString() !== req.body.stallId) {
    return res.status(403).json({ error: 'Can only log wastage for your assigned stall' });
  }

  try {
    const wastage = await Wastage.create({
      ...req.body,
      loggedBy: req.user._id,
      loggedByName: req.user.name,
    });
    res.status(201).json(wastage);
  } catch (err) {
    res.status(500).json({ error: 'Could not create wastage log' });
  }
});

// PATCH /v1/wastage/:id/loss — admin sets estimated loss
router.patch('/:id/loss', ...adminOrModerator, async (req, res) => {
  try {
    const wastage = await Wastage.findByIdAndUpdate(
      req.params.id,
      { totalEstimatedLoss: req.body.totalEstimatedLoss },
      { new: true }
    );
    if (!wastage) return res.status(404).json({ error: 'Wastage log not found' });
    res.json(wastage);
  } catch {
    res.status(500).json({ error: 'Could not update wastage' });
  }
});

module.exports = router;

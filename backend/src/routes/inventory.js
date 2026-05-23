const express = require('express');
const { body, validationResult } = require('express-validator');
const { InventoryItem, InventoryTransaction } = require('../models/Stall');
const { authenticate, adminOrModerator, allRoles } = require('../middleware/auth');
const notificationService = require('../services/notificationService');

const router = express.Router();

// ─── GET /inventory/:stallId ──────────────────────────────────────────────────
router.get('/:stallId', ...allRoles, async (req, res) => {
  try {
    const items = await InventoryItem.find({ stallId: req.params.stallId }).sort({ name: 1 });
    res.json(items);
  } catch {
    res.status(500).json({ error: 'Could not fetch inventory' });
  }
});

// ─── POST /inventory (Admin/Moderator only) ───────────────────────────────────
router.post('/', ...adminOrModerator, [
  body('stallId').notEmpty(),
  body('name').notEmpty().trim(),
  body('unit').notEmpty(),
  body('minThreshold').isNumeric(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const item = await InventoryItem.create({ ...req.body, updatedBy: req.user._id });
    res.status(201).json(item);
  } catch {
    res.status(500).json({ error: 'Could not create inventory item' });
  }
});

// ─── POST /inventory/:id/supply (Record stock delivery) ──────────────────────
router.post('/:id/supply', ...adminOrModerator, [
  body('quantity').isNumeric().withMessage('Quantity required'),
], async (req, res) => {
  const { quantity, notes } = req.body;
  try {
    const item = await InventoryItem.findByIdAndUpdate(
      req.params.id,
      { $inc: { currentStock: quantity }, lastUpdated: new Date(), updatedBy: req.user._id },
      { new: true }
    );
    if (!item) return res.status(404).json({ error: 'Item not found' });

    await InventoryTransaction.create({
      stallId: item.stallId,
      itemId: item._id,
      type: 'supply',
      quantity,
      notes,
      createdBy: req.user._id,
    });

    res.json(item);
  } catch {
    res.status(500).json({ error: 'Could not record supply' });
  }
});

// ─── POST /inventory/:id/usage (Record daily usage) ──────────────────────────
router.post('/:id/usage', ...allRoles, [
  body('quantity').isNumeric(),
], async (req, res) => {
  const { quantity, reportId, notes } = req.body;
  try {
    const item = await InventoryItem.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const newStock = item.currentStock - quantity;
    if (newStock < 0) return res.status(400).json({ error: 'Usage exceeds current stock' });

    item.currentStock = newStock;
    item.lastUpdated = new Date();
    await item.save();

    await InventoryTransaction.create({
      stallId: item.stallId,
      itemId: item._id,
      type: 'usage',
      quantity: -quantity,
      notes,
      reportId,
      createdBy: req.user._id,
    });

    // Check low stock threshold
    if (newStock <= item.minThreshold) {
      const User = require('../models/User');
      const staffInStall = await User.find({ stallId: item.stallId, role: 'staff', isActive: true }).select('_id');
      for (const s of staffInStall) {
        await notificationService.notifyStaffLowStock(s._id, item.name, newStock, item.unit);
      }
    }

    res.json(item);
  } catch {
    res.status(500).json({ error: 'Could not record usage' });
  }
});

// ─── GET /inventory/:stallId/transactions ─────────────────────────────────────
router.get('/:stallId/transactions', ...adminOrModerator, async (req, res) => {
  try {
    const txns = await InventoryTransaction.find({ stallId: req.params.stallId })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('itemId', 'name unit')
      .populate('createdBy', 'name');
    res.json(txns);
  } catch {
    res.status(500).json({ error: 'Could not fetch transactions' });
  }
});

module.exports = router;

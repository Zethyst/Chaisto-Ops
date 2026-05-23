const express = require('express');
const { body, validationResult } = require('express-validator');
const Expense = require('../models/Expense');
const AuditLog = require('../models/AuditLog');
const { allRoles, adminOrModerator, adminOnly } = require('../middleware/auth');

const router = express.Router();

// GET /v1/expenses — list expenses (admin/mod: by stall; staff: own stall)
router.get('/', ...allRoles, async (req, res) => {
  const { stallId, month } = req.query; // month: YYYY-MM
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
    const expenses = await Expense.find(filter).sort({ date: -1, createdAt: -1 }).limit(200);
    res.json(expenses);
  } catch {
    res.status(500).json({ error: 'Could not fetch expenses' });
  }
});

// POST /v1/expenses — log an expense
router.post('/', ...allRoles, [
  body('stallId').notEmpty(),
  body('category').isIn(['gas', 'supplies', 'maintenance', 'equipment', 'other']),
  body('amount').isFloat({ min: 1 }),
  body('date').matches(/^\d{4}-\d{2}-\d{2}$/),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  // Staff can only log for their own stall
  if (req.user.role === 'staff' && req.user.stallId?.toString() !== req.body.stallId) {
    return res.status(403).json({ error: 'Can only log expenses for your assigned stall' });
  }

  try {
    const expense = await Expense.create({
      ...req.body,
      loggedBy: req.user._id,
      loggedByName: req.user.name,
    });
    res.status(201).json(expense);
  } catch (err) {
    res.status(500).json({ error: 'Could not create expense' });
  }
});

// DELETE /v1/expenses/:id — admin/mod only
router.delete('/:id', ...adminOrModerator, async (req, res) => {
  try {
    const expense = await Expense.findByIdAndDelete(req.params.id);
    if (!expense) return res.status(404).json({ error: 'Expense not found' });

    await AuditLog.create({
      actorId: req.user._id,
      actorName: req.user.name,
      actorRole: req.user.role,
      action: 'expense_deleted',
      entity: 'Expense',
      entityId: req.params.id,
      details: { amount: expense.amount, category: expense.category },
      ip: req.ip,
    });

    res.json({ message: 'Deleted' });
  } catch {
    res.status(500).json({ error: 'Could not delete expense' });
  }
});

module.exports = router;

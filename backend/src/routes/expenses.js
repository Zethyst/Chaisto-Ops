const express = require('express');
const { body, validationResult } = require('express-validator');
const Expense = require('../models/Expense');
const AuditLog = require('../models/AuditLog');
const { allRoles, adminOrModerator, adminOnly } = require('../middleware/auth');
const { EXPENSE_CATEGORIES } = require('../utils/expenseCategories');

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
  body('stallId').notEmpty().withMessage('Pick a stall to log this expense against'),
  body('category').isIn(EXPENSE_CATEGORIES).withMessage('Pick a valid category'),
  body('amount').isFloat({ min: 1 }).withMessage('Amount must be at least ₹1'),
  body('date').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Date must be YYYY-MM-DD'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  // Past days are expected — logs are often entered late — but a day that has
  // not happened yet cannot have anything recorded against it
  if (req.body.date > new Date().toISOString().split('T')[0]) {
    return res.status(400).json({ error: 'Cannot log for a future date' });
  }

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

// PATCH /v1/expenses/:id — admin/mod corrects a logged expense
// Same permission as deleting one: staff log expenses, and letting them rewrite
// their own afterwards would leave no reliable record of what was spent. Every
// change is recorded with what it was before.
router.patch('/:id', ...adminOrModerator, [
  body('category').optional().isIn(EXPENSE_CATEGORIES).withMessage('Pick a valid category'),
  body('amount').optional().isFloat({ min: 1 }).withMessage('Amount must be at least ₹1'),
  body('date').optional().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Date must be YYYY-MM-DD'),
  body('description').optional({ values: 'falsy' }).isLength({ max: 200 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  if (req.body.date && req.body.date > new Date().toISOString().split('T')[0]) {
    return res.status(400).json({ error: 'Cannot log for a future date' });
  }

  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ error: 'Expense not found' });

    // Who logged it and which stall it belongs to are the record; only what
    // was spent can be corrected
    const changes = [];
    ['category', 'amount', 'description', 'date'].forEach((field) => {
      if (req.body[field] === undefined) return;
      const value = field === 'amount' ? Number(req.body[field]) : req.body[field];
      if (expense[field] === value) return;
      changes.push({ field, from: expense[field], to: value });
      expense[field] = value;
    });

    if (!changes.length) return res.status(400).json({ error: 'Nothing changed' });

    await expense.save();

    await AuditLog.create({
      actorId: req.user._id,
      actorName: req.user.name,
      actorRole: req.user.role,
      action: 'expense_edited',
      entity: 'Expense',
      entityId: expense._id,
      details: { changes, loggedByName: expense.loggedByName },
      ip: req.ip,
    }).catch(() => {}); // non-blocking

    res.json(expense);
  } catch (err) {
    console.error('Edit expense error:', err);
    res.status(500).json({ error: 'Could not update expense' });
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

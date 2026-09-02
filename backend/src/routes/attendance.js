const express = require('express');
const { body, validationResult } = require('express-validator');
const Attendance = require('../models/Attendance');
const AuditLog = require('../models/AuditLog');
const { allRoles, adminOrModerator } = require('../middleware/auth');

const router = express.Router();

// GET /v1/attendance — list attendance records
router.get('/', ...allRoles, async (req, res) => {
  const { stallId, userId, month } = req.query;
  const filter = {};

  if (req.user.role === 'staff') {
    filter.userId = req.user._id;
  } else {
    if (stallId) filter.stallId = stallId;
    if (userId) filter.userId = userId;
  }

  if (month) {
    filter.date = { $gte: `${month}-01`, $lte: `${month}-31` };
  }

  try {
    const records = await Attendance.find(filter).sort({ date: -1 }).limit(300);
    res.json(records);
  } catch {
    res.status(500).json({ error: 'Could not fetch attendance' });
  }
});

// GET /v1/attendance/summary — monthly summary per staff (admin/mod)
router.get('/summary', ...adminOrModerator, async (req, res) => {
  const { stallId, month } = req.query;
  if (!month) return res.status(400).json({ error: 'month (YYYY-MM) required' });

  const filter = { date: { $gte: `${month}-01`, $lte: `${month}-31` } };
  if (stallId) filter.stallId = require('mongoose').Types.ObjectId(stallId);

  try {
    const summary = await Attendance.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$userId',
          userName: { $first: '$userName' },
          present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
          absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
          halfday: { $sum: { $cond: [{ $eq: ['$status', 'halfday'] }, 1, 0] } },
          leave: { $sum: { $cond: [{ $eq: ['$status', 'leave'] }, 1, 0] } },
          total: { $sum: 1 },
        },
      },
      { $sort: { userName: 1 } },
    ]);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch attendance summary' });
  }
});

// POST /v1/attendance — mark attendance (admin/mod only)
router.post('/', ...adminOrModerator, [
  body('userId').notEmpty().withMessage('Staff member is required'),
  body('userName').notEmpty().withMessage('Staff name is required'),
  body('stallId').notEmpty().withMessage('This staff member has no stall assigned'),
  body('date').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Date must be YYYY-MM-DD'),
  body('status').isIn(['present', 'absent', 'halfday', 'leave']).withMessage('Pick a valid status'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  // Past days are expected — attendance is often entered late — but a day that
  // hasn't happened yet cannot be attended
  if (req.body.date > new Date().toISOString().split('T')[0]) {
    return res.status(400).json({ error: 'Cannot mark attendance for a future date' });
  }

  try {
    const record = await Attendance.findOneAndUpdate(
      { userId: req.body.userId, date: req.body.date },
      {
        ...req.body,
        markedBy: req.user._id,
        markedByName: req.user.name,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await AuditLog.create({
      actorId: req.user._id,
      actorName: req.user.name,
      actorRole: req.user.role,
      action: 'attendance_marked',
      entity: 'Attendance',
      entityId: record._id.toString(),
      details: { userId: req.body.userId, userName: req.body.userName, date: req.body.date, status: req.body.status },
      ip: req.ip,
    });

    res.status(201).json(record);
  } catch (err) {
    res.status(500).json({ error: 'Could not mark attendance' });
  }
});

// PATCH /v1/attendance/:id — update attendance
router.patch('/:id', ...adminOrModerator, async (req, res) => {
  try {
    const record = await Attendance.findByIdAndUpdate(
      req.params.id,
      { ...req.body, markedBy: req.user._id, markedByName: req.user.name },
      { new: true }
    );
    if (!record) return res.status(404).json({ error: 'Record not found' });
    res.json(record);
  } catch {
    res.status(500).json({ error: 'Could not update attendance' });
  }
});

module.exports = router;

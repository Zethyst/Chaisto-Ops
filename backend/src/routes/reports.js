const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Report = require('../models/Report');
const ReportDraft = require('../models/ReportDraft');
const { Stall } = require('../models/Stall');
const User = require('../models/User');
const { authenticate, authorize, adminOnly, adminOrModerator, allRoles } = require('../middleware/auth');
const notificationService = require('../services/notificationService');
const { deviceService } = require('../services/deviceService');
const AuditLog = require('../models/AuditLog');

const router = express.Router();

// ─── POST /reports — Submit daily report ─────────────────────────────────────
router.post('/', ...allRoles, [
  body('stallId').notEmpty().withMessage('stallId required'),
  body('date').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Date must be YYYY-MM-DD'),
  body('photos.cash').notEmpty().withMessage('Cash photo required'),
  body('photos.stock').notEmpty().withMessage('Stock photo required'),
  body('photos.milkPacket').notEmpty().withMessage('Milk packet photo required'),
  body('location.latitude').isFloat().withMessage('Valid latitude required'),
  body('location.longitude').isFloat().withMessage('Valid longitude required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { stallId, date } = req.body;

  try {
    // Prevent duplicate reports
    const existing = await Report.findOne({ staffId: req.user._id, date });
    if (existing) return res.status(409).json({ error: 'You already submitted a report for today', reportId: existing._id });

    // Staff: verify report is for their assigned stall
    if (req.user.role === 'staff' && req.user.stallId?.toString() !== stallId) {
      return res.status(403).json({ error: 'You can only submit reports for your assigned stall' });
    }

    // GPS location check
    const stall = await Stall.findById(stallId);
    if (stall) {
      const distance = deviceService.haversineDistance(
        req.body.location.latitude, req.body.location.longitude,
        stall.location.latitude, stall.location.longitude
      );
      if (distance > (stall.allowedRadiusMeters || 200)) {
        // Still allow submission but add a location flag
        req.body.locationFlag = {
          type: 'location_mismatch',
          severity: 'high',
          message: `Report submitted ${Math.round(distance)}m from stall — expected within ${stall.allowedRadiusMeters || 200}m`,
          value: distance,
          expectedValue: stall.allowedRadiusMeters || 200,
        };
      }
    }

    const report = new Report({
      ...req.body,
      staffId: req.user._id,
      staffName: req.user.name,
      deviceId: req.headers['x-device-id'],
      submittedAt: new Date(),
    });

    // Add location flag if it was generated
    if (req.body.locationFlag) {
      report.flags = [...(report.flags || []), req.body.locationFlag];
    }

    await report.save(); // pre-save middleware computes anti-cheat metrics

    // The draft has served its purpose — the submitted report is now the record
    await ReportDraft.deleteOne({ staffId: req.user._id, date });

    // Send notifications
    await notificationService.notifyAdminReportSubmitted(report, req.user.name);
    if (report.status === 'flagged') {
      await notificationService.notifyAdminSuspiciousActivity(report);
    }

    res.status(201).json(report);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Duplicate report for this date' });
    console.error('Submit report error:', err);
    res.status(500).json({ error: 'Could not submit report' });
  }
});

// ─── POST /reports/backfill — Admin files a report on a staff member's behalf ─
// For days a staff member never submitted. Photos and GPS cannot be recreated
// after the fact, so both are skipped; the report is stamped with who entered
// it so it is never mistaken for a first-hand submission.
router.post('/backfill', ...adminOrModerator, [
  body('staffId').notEmpty().withMessage('staffId required'),
  body('stallId').notEmpty().withMessage('stallId required'),
  body('date').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Date must be YYYY-MM-DD'),
  // Photos are optional here, but anything supplied must be a hosted URL —
  // the client uploads to Cloudinary first and sends back the secure URL
  body('photos.cash').optional({ values: 'falsy' }).isURL().withMessage('Cash photo must be an uploaded URL'),
  body('photos.stock').optional({ values: 'falsy' }).isURL().withMessage('Stock photo must be an uploaded URL'),
  body('photos.milkPacket').optional({ values: 'falsy' }).isURL().withMessage('Milk packet photo must be an uploaded URL'),
  body('photos.cartClosing').optional({ values: 'falsy' }).isURL().withMessage('Cart closing photo must be an uploaded URL'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { staffId, stallId, date } = req.body;

  try {
    const today = new Date().toISOString().split('T')[0];
    if (date > today) return res.status(400).json({ error: 'Cannot backfill a future date' });

    const existing = await Report.findOne({ staffId, date });
    if (existing) {
      return res.status(409).json({ error: 'A report already exists for this staff member and date', reportId: existing._id });
    }

    const staff = await User.findById(staffId);
    if (!staff) return res.status(404).json({ error: 'Staff member not found' });

    const report = new Report({
      ...req.body,
      staffId,
      stallId,
      staffName: staff.name,
      // Backdated to the end of the day being recorded, not "now", so the
      // report sorts and aggregates alongside that day's real reports
      submittedAt: new Date(`${date}T21:00:00.000Z`),
      photos: req.body.photos || {},
      location: req.body.location || { latitude: 0, longitude: 0 },
      isBackfill: true,
      enteredById: req.user._id,
      enteredByName: req.user.name,
    });

    await report.save(); // pre-save middleware still computes anti-cheat metrics

    // A draft the staff had half-finished for that day is now superseded
    await ReportDraft.deleteOne({ staffId, date });

    await AuditLog.create({
      actorId: req.user._id,
      actorName: req.user.name,
      actorRole: req.user.role,
      action: 'report_backfilled',
      entity: 'Report',
      entityId: report._id,
      details: { staffId, staffName: staff.name, date },
      ip: req.ip,
    }).catch(() => {}); // non-blocking

    res.status(201).json(report);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Duplicate report for this date' });
    console.error('Backfill report error:', err);
    res.status(500).json({ error: 'Could not save backfilled report' });
  }
});

// ─── GET /reports — Fetch reports ────────────────────────────────────────────
router.get('/', ...allRoles, async (req, res) => {
  const { stallId, days = 30, staffId, status, page = 1, limit = 50, date } = req.query;

  const filter = {};
  if (date) {
    filter.date = date; // exact YYYY-MM-DD match
  } else {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - parseInt(days));
    filter.submittedAt = { $gte: cutoff };
  }

  // Staff can only see their own reports
  if (req.user.role === 'staff') {
    filter.staffId = req.user._id;
  } else {
    if (staffId) filter.staffId = staffId;
    if (stallId) filter.stallId = stallId;
  }

  if (status) filter.status = status;

  try {
    const [reports, total] = await Promise.all([
      Report.find(filter)
        .sort({ submittedAt: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit))
        .populate('staffId', 'name phone')
        .populate('stallId', 'name'),
      Report.countDocuments(filter),
    ]);

    res.json({ reports, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch reports' });
  }
});

// ─── GET /reports/draft — Resume an in-progress report ───────────────────────
router.get('/draft', ...allRoles, async (req, res) => {
  const staffId = req.user.role === 'staff' ? req.user._id : (req.query.staffId || req.user._id);
  const date = req.query.date || new Date().toISOString().split('T')[0];

  try {
    const draft = await ReportDraft.findOne({ staffId, date });
    res.json(draft ? { ...draft.data, updatedAt: draft.updatedAt } : null);
  } catch {
    res.status(500).json({ error: 'Could not fetch draft' });
  }
});

// ─── PUT /reports/draft — Autosave an in-progress report ─────────────────────
// Called as the staff fills each field, so nothing entered is lost if the app
// closes and the report can be finished later from any device.
router.put('/draft', ...allRoles, [
  body('date').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Date must be YYYY-MM-DD'),
  body('data').isObject().withMessage('data required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { date, stallId, data } = req.body;

  try {
    // Once submitted the report is locked — don't keep a stale draft alive
    const submitted = await Report.findOne({ staffId: req.user._id, date });
    if (submitted) {
      await ReportDraft.deleteOne({ staffId: req.user._id, date });
      return res.status(409).json({ error: 'Report already submitted for this date', reportId: submitted._id });
    }

    const draft = await ReportDraft.findOneAndUpdate(
      { staffId: req.user._id, date },
      { staffId: req.user._id, stallId: stallId || req.user.stallId, date, data },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ savedAt: draft.updatedAt });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Draft conflict — retry' });
    console.error('Save draft error:', err);
    res.status(500).json({ error: 'Could not save draft' });
  }
});

// ─── DELETE /reports/draft — Discard an in-progress report ───────────────────
router.delete('/draft', ...allRoles, async (req, res) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];
  try {
    await ReportDraft.deleteOne({ staffId: req.user._id, date });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Could not discard draft' });
  }
});

// ─── GET /reports/today — Today's report for a staff member ──────────────────
router.get('/today', ...allRoles, async (req, res) => {
  const staffId = req.user.role === 'staff' ? req.user._id : req.query.staffId;
  const date = req.query.date || new Date().toISOString().split('T')[0];

  try {
    const report = await Report.findOne({ staffId, date });
    res.json(report || null);
  } catch {
    res.status(500).json({ error: 'Could not fetch today\'s report' });
  }
});

// ─── GET /reports/flags — All flagged reports ────────────────────────────────
router.get('/flags', ...adminOrModerator, async (req, res) => {
  const { stallId, severity } = req.query;
  const filter = { status: { $in: ['flagged', 'submitted'] }, 'flags.0': { $exists: true } };
  if (stallId) filter.stallId = stallId;
  if (severity) filter['flags.severity'] = severity;

  try {
    const reports = await Report.find(filter)
      .sort({ 'flags.severity': -1, submittedAt: -1 })
      .limit(50)
      .populate('staffId', 'name phone')
      .populate('stallId', 'name');
    res.json(reports);
  } catch {
    res.status(500).json({ error: 'Could not fetch flagged reports' });
  }
});

// ─── GET /reports/:id ────────────────────────────────────────────────────────
router.get('/:id', ...allRoles, async (req, res) => {
  try {
    const report = await Report.findById(req.params.id)
      .populate('staffId', 'name phone')
      .populate('stallId', 'name location');

    if (!report) return res.status(404).json({ error: 'Report not found' });

    // Staff: only their own reports
    if (req.user.role === 'staff' && report.staffId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(report);
  } catch {
    res.status(500).json({ error: 'Could not fetch report' });
  }
});

// ─── PATCH /reports/:id/review (Admin/Moderator) ─────────────────────────────
router.patch('/:id/review', ...adminOrModerator, async (req, res) => {
  const { status, adminNotes } = req.body;
  try {
    const report = await Report.findByIdAndUpdate(
      req.params.id,
      {
        status: status || 'reviewed',
        adminNotes,
        reviewedBy: req.user._id,
        reviewedAt: new Date(),
      },
      { new: true }
    );
    if (!report) return res.status(404).json({ error: 'Report not found' });

    await AuditLog.create({
      actorId: req.user._id,
      actorName: req.user.name,
      actorRole: req.user.role,
      action: status === 'flagged' ? 'report_flagged' : status === 'reviewed' ? 'report_reviewed' : 'report_cleared',
      entity: 'Report',
      entityId: req.params.id,
      details: { status, adminNotes, staffName: report.staffName },
      ip: req.ip,
    }).catch(() => {}); // non-blocking

    res.json(report);
  } catch {
    res.status(500).json({ error: 'Could not update report' });
  }
});

// ─── PATCH /reports/:id/photos — Attach an optional photo after submission ───
// The three required photos are locked at submission time; only optional ones
// (the cart-closing shot, taken when the stall actually shuts) can be added
// later, and only once.
const OPTIONAL_PHOTO_KEYS = ['cartClosing'];

router.patch('/:id/photos', ...allRoles, [
  body('category').isIn(OPTIONAL_PHOTO_KEYS).withMessage('Only optional photos can be added after submission'),
  body('url').isURL().withMessage('Valid photo URL required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { category, url } = req.body;

  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    // Staff may only add to their own report; admins and moderators to any
    if (req.user.role === 'staff' && report.staffId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'You can only add photos to your own report' });
    }
    if (report.photos?.[category]) {
      return res.status(409).json({ error: 'This photo has already been added' });
    }

    report.photos[category] = url;
    report.markModified('photos');
    await report.save();

    await AuditLog.create({
      actorId: req.user._id,
      actorName: req.user.name,
      actorRole: req.user.role,
      action: 'report_photo_added',
      entity: 'Report',
      entityId: req.params.id,
      details: { category, staffName: report.staffName },
      ip: req.ip,
    }).catch(() => {}); // non-blocking

    res.json(report);
  } catch (err) {
    console.error('Add report photo error:', err);
    res.status(500).json({ error: 'Could not add photo' });
  }
});

// ─── GET /analytics — Summary analytics ──────────────────────────────────────
router.get('/analytics/summary', ...adminOrModerator, async (req, res) => {
  const { stallId, days = 30 } = req.query;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - parseInt(days));

  const match = { submittedAt: { $gte: cutoff } };
  if (stallId) match.stallId = require('mongoose').Types.ObjectId(stallId);

  try {
    const [summary] = await Report.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalCups: { $sum: { $add: ['$sales.regularCups', '$sales.specialCups'] } },
          totalMomoPackets: { $sum: { $add: ['$sales.vegMomoPackets', '$sales.paneerMomoPackets'] } },
          totalRevenue: { $sum: '$computed.totalRevenue' },
          totalUPI: { $sum: '$payments.upi' },
          totalCash: { $sum: '$payments.cash' },
          reportCount: { $sum: 1 },
          flaggedCount: { $sum: { $cond: [{ $eq: ['$status', 'flagged'] }, 1, 0] } },
        },
      },
    ]);

    const daily = await Report.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$date',
          cups: { $sum: { $add: ['$sales.regularCups', '$sales.specialCups'] } },
          momoPackets: { $sum: { $add: ['$sales.vegMomoPackets', '$sales.paneerMomoPackets'] } },
          revenue: { $sum: '$computed.totalRevenue' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const staffPerf = await Report.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$staffId',
          name: { $first: '$staffName' },
          cups: { $sum: { $add: ['$sales.regularCups', '$sales.specialCups'] } },
          momoPackets: { $sum: { $add: ['$sales.vegMomoPackets', '$sales.paneerMomoPackets'] } },
          revenue: { $sum: '$computed.totalRevenue' },
          reports: { $sum: 1 },
        },
      },
      { $sort: { cups: -1 } },
      { $limit: 10 },
    ]);

    res.json({
      summary: summary || { totalCups: 0, totalMomoPackets: 0, totalRevenue: 0, totalUPI: 0, totalCash: 0, reportCount: 0, flaggedCount: 0 },
      daily,
      staffPerformance: staffPerf,
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ error: 'Could not fetch analytics' });
  }
});

module.exports = router;

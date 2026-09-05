const express = require('express');
const { body, validationResult } = require('express-validator');
const PaymentCapture = require('../models/PaymentCapture');
const Report = require('../models/Report');
const User = require('../models/User');
const { adminOrModerator, allRoles } = require('../middleware/auth');
const notificationService = require('../services/notificationService');
const { reconcilePayments } = require('../utils/paymentReconciliation');
const { reconcileReport } = require('../services/paymentReconciliationService');
const { captureHealth, HEALTH_LABELS } = require('../utils/captureHealth');

const router = express.Router();

// ─── POST /payment-captures — A staff device reports what it has seen ────────
// Sent by the app on the staff member's own phone: the UPI credits its payment
// apps announced, plus whether monitoring is still switched on. A device can
// only ever report for the account logged in on it.
router.post('/', ...allRoles, [
  body('enabled').isBoolean().withMessage('enabled required'),
  body('connected').optional().isBoolean(),
  body('captures').optional().isArray().withMessage('captures must be an array'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { enabled, connected, captures = [], deviceId } = req.body;

  try {
    const user = await User.findById(req.user._id).select('name stallId paymentCapture');
    const wasEnabled = user?.paymentCapture?.enabled ?? false;

    // Anything malformed is dropped rather than failing the whole sync — the
    // device cannot re-send what it has already cleared
    const rows = captures.reduce((acc, c) => {
      const amount = Number(c?.amount);
      const capturedAt = Number(c?.capturedAt);
      if (!c?.id || !Number.isFinite(amount) || amount <= 0 || !Number.isFinite(capturedAt)) return acc;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(c?.date || '')) return acc;

      acc.push({
        staffId: req.user._id,
        staffName: req.user.name,
        stallId: user?.stallId,
        date: c.date,
        app: String(c.app || 'unknown').slice(0, 120),
        amount,
        title: typeof c.title === 'string' ? c.title.slice(0, 120) : undefined,
        text: typeof c.text === 'string' ? c.text.slice(0, 240) : undefined,
        capturedAt: new Date(capturedAt),
        deviceId: deviceId || req.headers['x-device-id'],
        fingerprint: String(c.id).slice(0, 200),
      });
      return acc;
    }, []);

    if (rows.length) {
      // A capture the device already sent is not an error — it means the last
      // sync's acknowledgement never made it back to the phone
      await PaymentCapture.insertMany(rows, { ordered: false }).catch((err) => {
        if (err.code !== 11000 && !err.writeErrors) throw err;
      });
    }

    const latest = rows.reduce(
      (max, r) => (!max || r.capturedAt > max ? r.capturedAt : max),
      user?.paymentCapture?.lastCaptureAt || null,
    );
    await User.updateOne({ _id: req.user._id }, {
      'paymentCapture.enabled': enabled,
      // An older build does not send `connected`; fall back to the grant
      'paymentCapture.listenerConnected': connected ?? enabled,
      'paymentCapture.lastSyncAt': new Date(),
      ...(latest ? { 'paymentCapture.lastCaptureAt': latest } : {}),
    });

    // Monitoring going quiet should never look like a quiet day
    if (wasEnabled && !enabled) {
      await notificationService.notifyAdminPaymentMonitoringOff(req.user.name).catch(() => {});
    }

    // The phone often syncs after the report is filed, so every day these
    // captures touch is re-checked against its report
    const days = [...new Set(rows.map((r) => r.date))];
    await Promise.all(
      days.map((day) => reconcileReport(req.user._id, day).catch(() => {})),
    );

    // The device clears only what was stored, so a dropped response leaves the
    // captures on the phone to be sent again
    res.json({ accepted: rows.map((r) => r.fingerprint) });
  } catch (err) {
    console.error('Payment capture sync error:', err);
    res.status(500).json({ error: 'Could not record payments' });
  }
});

// ─── GET /payment-captures — What a staff phone collected on a day ───────────
router.get('/', ...adminOrModerator, async (req, res) => {
  const { date, staffId, stallId } = req.query;

  const filter = {};
  if (date) filter.date = date;
  if (staffId) filter.staffId = staffId;
  if (stallId) filter.stallId = stallId;

  try {
    const captures = await PaymentCapture.find(filter)
      .sort({ capturedAt: -1 })
      .limit(300)
      .populate('staffId', 'name phone');
    res.json(captures);
  } catch (err) {
    console.error('Fetch payment captures error:', err);
    res.status(500).json({ error: 'Could not fetch payments' });
  }
});

// ─── GET /payment-captures/summary — Declared vs collected, per staff ────────
// The day at a glance: what each staff member's report says they took by UPI,
// against what their phone actually announced receiving.
router.get('/summary', ...adminOrModerator, async (req, res) => {
  const { date, stallId } = req.query;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
    return res.status(400).json({ error: 'A date (YYYY-MM-DD) is required' });
  }

  try {
    const filter = { date };
    if (stallId) filter.stallId = stallId;

    const [captures, reports, staff] = await Promise.all([
      PaymentCapture.find(filter).sort({ capturedAt: 1 }),
      Report.find({ date, ...(stallId ? { stallId } : {}) }).select('staffId staffName payments'),
      User.find({ role: 'staff', isActive: true, ...(stallId ? { stallId } : {}) })
        .select('name stallId paymentCapture'),
    ]);

    const rows = staff.map((member) => {
      const id = member._id.toString();
      const mine = captures.filter((c) => c.staffId.toString() === id);
      const report = reports.find((r) => r.staffId.toString() === id);
      const reconciliation = reconcilePayments(mine, report?.payments?.upi ?? 0);

      return {
        staffId: id,
        staffName: member.name,
        hasReport: !!report,
        monitoring: {
          enabled: member.paymentCapture?.enabled ?? false,
          lastSyncAt: member.paymentCapture?.lastSyncAt || null,
          // Granted, running, killed by the phone, or gone quiet. A phone that
          // is not recording looks exactly like an honest quiet day otherwise.
          health: captureHealth(member.paymentCapture),
          healthLabel: HEALTH_LABELS[captureHealth(member.paymentCapture)],
        },
        ...reconciliation,
        captures: mine.map((c) => ({
          _id: c._id,
          app: c.app,
          amount: c.amount,
          title: c.title,
          text: c.text,
          capturedAt: c.capturedAt,
        })),
      };
    });

    // The staff who need looking at first: unaccounted money, then any phone
    // that is not actually recording, then everyone else
    const reporting = (r) => r.monitoring.health === 'reporting';
    rows.sort((a, b) => {
      if (a.mismatch !== b.mismatch) return a.mismatch ? -1 : 1;
      if (reporting(a) !== reporting(b)) return reporting(a) ? 1 : -1;
      return b.capturedTotal - a.capturedTotal;
    });

    res.json({
      date,
      staff: rows,
      totals: {
        captured: rows.reduce((s, r) => s + r.capturedTotal, 0),
        declared: rows.reduce((s, r) => s + r.declaredUpi, 0),
        unaccounted: rows.reduce((s, r) => s + Math.max(0, r.undeclared), 0),
        notReporting: rows.filter((r) => r.monitoring.health !== 'reporting').length,
      },
    });
  } catch (err) {
    console.error('Payment summary error:', err);
    res.status(500).json({ error: 'Could not build the payment summary' });
  }
});

module.exports = router;

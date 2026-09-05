const PaymentCapture = require('../models/PaymentCapture');
const Report = require('../models/Report');
const { reconcilePayments, undeclaredUpiFlag } = require('../utils/paymentReconciliation');
const { replaceFlag } = require('../utils/reportFlags');
const notificationService = require('./notificationService');

/**
 * Checks a day's report against the UPI payments the staff member's phone
 * recorded, and flags the report when money arrived that the report leaves out.
 *
 * Run from both ends, because either can be last: the report may be filed
 * before the phone syncs, or the phone may sync before the report is filed.
 *
 * @returns the reconciliation, or null when there is no report to check yet
 */
async function reconcileReport(staffId, date) {
  const report = await Report.findOne({ staffId, date });
  if (!report) return null;

  const captures = await PaymentCapture.find({ staffId, date }).select('amount');
  const reconciliation = reconcilePayments(captures, report.payments?.upi ?? 0);
  const flag = undeclaredUpiFlag(reconciliation);

  const had = (report.flags || []).some((f) => f.type === 'upi_undeclared');
  if (!flag && !had) return reconciliation; // nothing to say, nothing to change

  report.flags = replaceFlag(report.flags, 'upi_undeclared', flag);
  // A correction to the figures deserves a fresh verdict, and so does this
  if (report.status !== 'reviewed' && report.status !== 'cleared') {
    report.status = 'submitted';
  }
  await report.save(); // the pre-save hook keeps the flag and re-derives status

  // Only worth an alert when the gap is new — a later sync of the same day
  // should not notify again
  if (flag && !had) {
    await notificationService.notifyAdminSuspiciousActivity(report).catch(() => {});
  }

  return reconciliation;
}

module.exports = { reconcileReport };

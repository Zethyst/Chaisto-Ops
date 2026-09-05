// Compares the UPI a report declares against the UPI payments the staff
// member's own phone recorded receiving that day.
//
// The two disagree in a way worth knowing about when the phone saw more than
// the report admits: money was collected on that phone and left off the day's
// figures. The other direction is normal — payments made to the stall's own
// business QR never reach the staff member's phone at all.

// Below this the gap is rounding, a tip, or a payment that landed either side
// of midnight — not worth putting in front of anyone.
const UNDECLARED_MIN_RUPEES = 50;

/**
 * @param {{ amount: number }[]} captures - the day's captures for one staff member
 * @param {number} declaredUpi - the UPI figure on that day's report
 */
function reconcilePayments(captures, declaredUpi) {
  const capturedTotal = (captures || []).reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  const declared = Number(declaredUpi) || 0;
  const undeclared = Math.round((capturedTotal - declared) * 100) / 100;

  return {
    capturedTotal: Math.round(capturedTotal * 100) / 100,
    capturedCount: (captures || []).length,
    declaredUpi: declared,
    undeclared,
    // Only an excess counts as a mismatch — see the note above
    mismatch: undeclared >= UNDECLARED_MIN_RUPEES,
  };
}

/**
 * The flag to put on the report, or null when the figures reconcile.
 * @returns {{ type: string, severity: string, message: string, value: number, expectedValue: number }|null}
 */
function undeclaredUpiFlag(reconciliation) {
  if (!reconciliation.mismatch) return null;

  const { capturedTotal, declaredUpi, undeclared, capturedCount } = reconciliation;
  return {
    type: 'upi_undeclared',
    // Money received and not reported is the strongest signal the app has
    severity: 'high',
    message:
      `₹${Math.round(capturedTotal)} of UPI arrived on the staff phone ` +
      `(${capturedCount} payment${capturedCount === 1 ? '' : 's'}) but only ₹${Math.round(declaredUpi)} ` +
      `is on the report — ₹${Math.round(undeclared)} unaccounted for`,
    value: capturedTotal,
    expectedValue: declaredUpi,
  };
}

module.exports = { reconcilePayments, undeclaredUpiFlag, UNDECLARED_MIN_RUPEES };

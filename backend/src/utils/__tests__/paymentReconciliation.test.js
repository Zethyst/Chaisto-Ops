const {
  reconcilePayments, undeclaredUpiFlag, UNDECLARED_MIN_RUPEES,
} = require('../paymentReconciliation');

const captures = (...amounts) => amounts.map((amount) => ({ amount }));

describe('reconcilePayments', () => {
  it('totals what the phone recorded against what the report declares', () => {
    const result = reconcilePayments(captures(120, 80, 50), 250);
    expect(result.capturedTotal).toBe(250);
    expect(result.capturedCount).toBe(3);
    expect(result.declaredUpi).toBe(250);
    expect(result.undeclared).toBe(0);
    expect(result.mismatch).toBe(false);
  });

  it('flags money the phone saw that the report leaves out', () => {
    const result = reconcilePayments(captures(300, 200), 100);
    expect(result.undeclared).toBe(400);
    expect(result.mismatch).toBe(true);
  });

  it('treats a declared figure above the captures as normal', () => {
    // Customers paying the stall's own business QR never touch the staff phone
    const result = reconcilePayments(captures(100), 900);
    expect(result.undeclared).toBe(-800);
    expect(result.mismatch).toBe(false);
  });

  it('ignores a gap too small to mean anything', () => {
    const result = reconcilePayments(captures(UNDECLARED_MIN_RUPEES - 1), 0);
    expect(result.mismatch).toBe(false);
  });

  it('counts a gap exactly at the threshold', () => {
    expect(reconcilePayments(captures(UNDECLARED_MIN_RUPEES), 0).mismatch).toBe(true);
  });

  it('handles a day with no captures and no report figures', () => {
    const result = reconcilePayments([], 0);
    expect(result).toMatchObject({ capturedTotal: 0, capturedCount: 0, undeclared: 0, mismatch: false });
  });

  it('is not thrown off by a missing or unparseable amount', () => {
    const result = reconcilePayments([{ amount: 100 }, { amount: null }, {}], 0);
    expect(result.capturedTotal).toBe(100);
  });

  it('keeps totals to paise rather than accumulating float noise', () => {
    expect(reconcilePayments(captures(10.1, 20.2), 0).capturedTotal).toBe(30.3);
  });
});

describe('undeclaredUpiFlag', () => {
  it('says nothing when the figures reconcile', () => {
    expect(undeclaredUpiFlag(reconcilePayments(captures(100), 100))).toBeNull();
  });

  it('raises a high-severity flag naming both figures and the gap', () => {
    const flag = undeclaredUpiFlag(reconcilePayments(captures(300, 200), 100));
    expect(flag).toMatchObject({ type: 'upi_undeclared', severity: 'high', value: 500, expectedValue: 100 });
    expect(flag.message).toContain('₹500');
    expect(flag.message).toContain('₹100');
    expect(flag.message).toContain('₹400');
    expect(flag.message).toContain('2 payments');
  });

  it('says "payment" for a single one', () => {
    expect(undeclaredUpiFlag(reconcilePayments(captures(500), 0)).message).toContain('(1 payment)');
  });
});

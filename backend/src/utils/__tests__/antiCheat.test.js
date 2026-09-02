const { computeAntiCheatMetrics } = require('../antiCheat');

// A clean baseline report where nothing should be flagged:
// milkUsed = 5 + 0 - 1 = 4L -> expectedCups = 4 * 7.5 = 30, totalCups = 30 (exact match)
// momoOpening = 20, momoPurchased = 0, momoClosing = 8 -> expectedMomo = 12, totalMomo = 12 (exact match)
// revenuePerCup = 450 / 30 = 15 (within 10-60), upiRatio = 300/450 = 0.667 (well above 0.20)
// totalRevenue = 450, which is not > 500, so low_upi can never fire regardless of ratio
function baseline(overrides = {}) {
  const report = {
    openingStock: { milk: 5, sugar: 1, teaLeaves: 100, cups: 50, kulhadCups: 20, vegMomoPackets: 10, paneerMomoPackets: 10 },
    purchases: { milk: 0, snacks: 0, vegMomoPackets: 0, paneerMomoPackets: 0 },
    closingStock: { milk: 1, sugar: 0.5, teaLeaves: 20, cups: 20, kulhadCups: 5, vegMomoPackets: 4, paneerMomoPackets: 4 },
    sales: { regularCups: 30, specialCups: 0, kulhadCups: 0, vegMomoPackets: 6, paneerMomoPackets: 6, snacks: 0 },
    payments: { upi: 300, cash: 150 },
  };
  return { ...report, ...overrides };
}

function flagTypes(result) {
  return result.flags.map((f) => f.type);
}

describe('computeAntiCheatMetrics — baseline / happy path', () => {
  it('produces no flags and status "submitted" when everything reconciles', () => {
    const result = computeAntiCheatMetrics(baseline());
    expect(result.flags).toEqual([]);
    expect(result.status).toBe('submitted');
  });

  it('computes exact numeric values for the computed block', () => {
    const { computed } = computeAntiCheatMetrics(baseline());
    expect(computed.totalRevenue).toBe(450);
    expect(computed.milkUsed).toBe(4);
    expect(computed.expectedCupsFromMilk).toBe(30);
    expect(computed.revenuePerCup).toBe(15);
    expect(computed.upiRatio).toBeCloseTo(300 / 450, 10);
    expect(computed.cupsVsMilkDeviation).toBe(0);
    expect(computed.totalMomoPackets).toBe(12);
    expect(computed.expectedMomoFromStock).toBe(12);
    expect(computed.momoStockDeviation).toBe(0);
  });

  it('handles a brand-new stall with an entirely empty report without crashing', () => {
    const empty = {
      openingStock: { milk: 0, vegMomoPackets: 0, paneerMomoPackets: 0 },
      purchases: { milk: 0, vegMomoPackets: 0, paneerMomoPackets: 0 },
      closingStock: { milk: 0, vegMomoPackets: 0, paneerMomoPackets: 0 },
      sales: { regularCups: 0, specialCups: 0, kulhadCups: 0, vegMomoPackets: 0, paneerMomoPackets: 0 },
      payments: { upi: 0, cash: 0 },
    };
    const result = computeAntiCheatMetrics(empty);
    expect(result.flags).toEqual([]);
    expect(result.status).toBe('submitted');
    expect(result.computed.totalRevenue).toBe(0);
    expect(result.computed.upiRatio).toBe(0);
    expect(result.computed.revenuePerCup).toBe(0);
  });
});

describe('computeAntiCheatMetrics — milk_mismatch', () => {
  it('does not flag right at the 20% boundary (strictly greater-than only)', () => {
    // expectedCups = 30, totalCups = 24 -> deviation exactly (30-24)/30 = 0.20
    const report = baseline({ sales: { regularCups: 24, specialCups: 0, kulhadCups: 0, vegMomoPackets: 6, paneerMomoPackets: 6 } });
    const result = computeAntiCheatMetrics(report);
    expect(flagTypes(result)).not.toContain('milk_mismatch');
  });

  it('flags medium severity just above the 20% threshold', () => {
    // totalCups = 23 -> deviation = (30-23)/30 = 0.2333
    const report = baseline({ sales: { regularCups: 23, specialCups: 0, kulhadCups: 0, vegMomoPackets: 6, paneerMomoPackets: 6 } });
    const result = computeAntiCheatMetrics(report);
    const flag = result.flags.find((f) => f.type === 'milk_mismatch');
    expect(flag).toBeDefined();
    expect(flag.severity).toBe('medium');
    expect(flag.value).toBe(23);
    expect(flag.expectedValue).toBe(30);
    expect(result.status).toBe('submitted'); // medium severity alone doesn't flag the report
  });

  it('does not flag right at the 45% boundary (medium, not high)', () => {
    // deviation exactly 0.45 -> totalCups = 30 * (1 - 0.45) = 16.5
    const report = baseline({ sales: { regularCups: 16.5, specialCups: 0, kulhadCups: 0, vegMomoPackets: 6, paneerMomoPackets: 6 } });
    const result = computeAntiCheatMetrics(report);
    const flag = result.flags.find((f) => f.type === 'milk_mismatch');
    expect(flag.severity).toBe('medium');
  });

  it('flags high severity above the 45% threshold and marks the report flagged', () => {
    // totalCups = 10 -> deviation = (30-10)/30 = 0.667
    const report = baseline({ sales: { regularCups: 10, specialCups: 0, kulhadCups: 0, vegMomoPackets: 6, paneerMomoPackets: 6 } });
    const result = computeAntiCheatMetrics(report);
    const flag = result.flags.find((f) => f.type === 'milk_mismatch');
    expect(flag.severity).toBe('high');
    expect(result.status).toBe('flagged');
  });

  it('does not flag when totalCups is 0, even if milk strongly implies sales', () => {
    const report = baseline({ sales: { regularCups: 0, specialCups: 0, kulhadCups: 0, vegMomoPackets: 6, paneerMomoPackets: 6 } });
    const result = computeAntiCheatMetrics(report);
    expect(flagTypes(result)).not.toContain('milk_mismatch');
  });

  it('does not flag when expectedCups is 0 or negative (e.g. no net milk used)', () => {
    // closing > opening + purchased -> negative milkUsed -> negative expectedCups
    const report = baseline({
      openingStock: { milk: 1, vegMomoPackets: 10, paneerMomoPackets: 10 },
      purchases: { milk: 0, vegMomoPackets: 0, paneerMomoPackets: 0 },
      closingStock: { milk: 5, vegMomoPackets: 4, paneerMomoPackets: 4 }, // more milk left than started with
      sales: { regularCups: 20, specialCups: 0, kulhadCups: 0, vegMomoPackets: 6, paneerMomoPackets: 6 },
    });
    const result = computeAntiCheatMetrics(report);
    expect(flagTypes(result)).not.toContain('milk_mismatch');
    expect(result.computed.milkUsed).toBe(-4);
    expect(result.computed.cupsVsMilkDeviation).toBe(0);
  });

  it('sums regular + special + kulhad cups together for the deviation check', () => {
    const report = baseline({ sales: { regularCups: 10, specialCups: 10, kulhadCups: 10, vegMomoPackets: 6, paneerMomoPackets: 6 } });
    const result = computeAntiCheatMetrics(report);
    // total = 30, matches expectedCups of 30 exactly -> no flag
    expect(flagTypes(result)).not.toContain('milk_mismatch');
  });
});

describe('computeAntiCheatMetrics — momo_stock_mismatch', () => {
  it('does not flag right at the 20% boundary', () => {
    // Use an opening/closing combo giving a clean expectedMomo of 20 so the 20%
    // boundary (deviation = 4/20 = 0.2 exactly) isn't affected by float rounding.
    const report = baseline({
      openingStock: { milk: 5, vegMomoPackets: 20, paneerMomoPackets: 0 },
      closingStock: { milk: 1, vegMomoPackets: 0, paneerMomoPackets: 0 },
      sales: { regularCups: 30, specialCups: 0, kulhadCups: 0, vegMomoPackets: 16, paneerMomoPackets: 0 },
    });
    const result = computeAntiCheatMetrics(report);
    expect(result.computed.expectedMomoFromStock).toBe(20);
    expect(flagTypes(result)).not.toContain('momo_stock_mismatch');
  });

  it('flags medium severity just above the 20% threshold', () => {
    // totalMomo = 9 -> deviation = (12-9)/12 = 0.25
    const report = baseline({ sales: { regularCups: 30, specialCups: 0, kulhadCups: 0, vegMomoPackets: 9, paneerMomoPackets: 0 } });
    const result = computeAntiCheatMetrics(report);
    const flag = result.flags.find((f) => f.type === 'momo_stock_mismatch');
    expect(flag).toBeDefined();
    expect(flag.severity).toBe('medium');
    expect(flag.value).toBe(9);
    expect(flag.expectedValue).toBe(12);
  });

  it('flags high severity above the 45% threshold', () => {
    // totalMomo = 5 -> deviation = (12-5)/12 = 0.583
    const report = baseline({ sales: { regularCups: 30, specialCups: 0, kulhadCups: 0, vegMomoPackets: 5, paneerMomoPackets: 0 } });
    const result = computeAntiCheatMetrics(report);
    const flag = result.flags.find((f) => f.type === 'momo_stock_mismatch');
    expect(flag.severity).toBe('high');
    expect(result.status).toBe('flagged');
  });

  it('does not flag when totalMomoPackets is 0', () => {
    const report = baseline({ sales: { regularCups: 30, specialCups: 0, kulhadCups: 0, vegMomoPackets: 0, paneerMomoPackets: 0 } });
    const result = computeAntiCheatMetrics(report);
    expect(flagTypes(result)).not.toContain('momo_stock_mismatch');
  });

  it('does not flag when expectedMomoFromStock is 0 or negative', () => {
    // momoOpening = 2+2 = 4, momoClosing = 6+6 = 12 -> expected = 4 - 12 = -8
    const report = baseline({
      openingStock: { milk: 5, vegMomoPackets: 2, paneerMomoPackets: 2 },
      closingStock: { milk: 1, vegMomoPackets: 6, paneerMomoPackets: 6 }, // more momo left than started with
      sales: { regularCups: 30, specialCups: 0, kulhadCups: 0, vegMomoPackets: 6, paneerMomoPackets: 6 },
    });
    const result = computeAntiCheatMetrics(report);
    expect(flagTypes(result)).not.toContain('momo_stock_mismatch');
    expect(result.computed.expectedMomoFromStock).toBe(-8);
  });

  it('combines veg + paneer opening, purchased, closing, and sold into one reconciliation', () => {
    // veg: open 10, purchased 5, closing 3 -> contributes 12 expected
    // paneer: open 4, purchased 0, closing 1 -> contributes 3 expected
    // total expected = 15, total sold = veg 8 + paneer 7 = 15 -> exact match, no flag
    const report = baseline({
      openingStock: { milk: 5, vegMomoPackets: 10, paneerMomoPackets: 4 },
      purchases: { milk: 0, vegMomoPackets: 5, paneerMomoPackets: 0 },
      closingStock: { milk: 1, vegMomoPackets: 3, paneerMomoPackets: 1 },
      sales: { regularCups: 30, specialCups: 0, kulhadCups: 0, vegMomoPackets: 8, paneerMomoPackets: 7 },
    });
    const result = computeAntiCheatMetrics(report);
    expect(result.computed.expectedMomoFromStock).toBe(15);
    expect(result.computed.totalMomoPackets).toBe(15);
    expect(flagTypes(result)).not.toContain('momo_stock_mismatch');
  });

  it('accounts for momo purchases made during the day', () => {
    // open 10, purchased 10, closing 5 -> expected 15
    const report = baseline({
      openingStock: { milk: 5, vegMomoPackets: 10, paneerMomoPackets: 0 },
      purchases: { milk: 0, vegMomoPackets: 10, paneerMomoPackets: 0 },
      closingStock: { milk: 1, vegMomoPackets: 5, paneerMomoPackets: 0 },
      sales: { regularCups: 30, specialCups: 0, kulhadCups: 0, vegMomoPackets: 15, paneerMomoPackets: 0 },
    });
    const result = computeAntiCheatMetrics(report);
    expect(result.computed.expectedMomoFromStock).toBe(15);
    expect(flagTypes(result)).not.toContain('momo_stock_mismatch');
  });
});

describe('computeAntiCheatMetrics — revenue_mismatch', () => {
  it('flags high severity when price per cup is below the minimum', () => {
    // revenuePerCup = 5 (below MIN_PRICE 10)
    const report = baseline({ payments: { upi: 100, cash: 50 } }); // 150/30 = 5
    const result = computeAntiCheatMetrics(report);
    const flag = result.flags.find((f) => f.type === 'revenue_mismatch');
    expect(flag).toBeDefined();
    expect(flag.severity).toBe('high');
    expect(result.status).toBe('flagged');
  });

  it('flags high severity when price per cup is above the maximum', () => {
    // revenuePerCup = 100 (above MAX_PRICE 60)
    const report = baseline({ payments: { upi: 2000, cash: 1000 } }); // 3000/30 = 100
    const result = computeAntiCheatMetrics(report);
    const flag = result.flags.find((f) => f.type === 'revenue_mismatch');
    expect(flag).toBeDefined();
    expect(flag.severity).toBe('high');
  });

  it('does not flag exactly at the MIN_PRICE boundary', () => {
    const report = baseline({ payments: { upi: 200, cash: 100 } }); // 300/30 = 10 exactly
    const result = computeAntiCheatMetrics(report);
    expect(flagTypes(result)).not.toContain('revenue_mismatch');
  });

  it('does not flag exactly at the MAX_PRICE boundary', () => {
    const report = baseline({ payments: { upi: 1200, cash: 600 } }); // 1800/30 = 60 exactly
    const result = computeAntiCheatMetrics(report);
    expect(flagTypes(result)).not.toContain('revenue_mismatch');
  });

  it('does not flag when totalCups is 0, regardless of revenue', () => {
    const report = baseline({
      sales: { regularCups: 0, specialCups: 0, kulhadCups: 0, vegMomoPackets: 6, paneerMomoPackets: 6 },
      payments: { upi: 100000, cash: 0 },
    });
    const result = computeAntiCheatMetrics(report);
    expect(flagTypes(result)).not.toContain('revenue_mismatch');
  });

  it('does not flag revenue_mismatch on a momo-only day even with implausible revenue (momo_revenue_mismatch handles that instead)', () => {
    const report = baseline({
      openingStock: { milk: 0, vegMomoPackets: 10, paneerMomoPackets: 0 },
      closingStock: { milk: 0, vegMomoPackets: 5, paneerMomoPackets: 0 },
      sales: { regularCups: 0, specialCups: 0, kulhadCups: 0, vegMomoPackets: 5, paneerMomoPackets: 0 },
      payments: { upi: 50000, cash: 0 },
    });
    const result = computeAntiCheatMetrics(report);
    expect(flagTypes(result)).not.toContain('revenue_mismatch');
  });
});

describe('computeAntiCheatMetrics — momo_revenue_mismatch', () => {
  it('flags high severity when a momo-only day has implausibly high revenue per packet', () => {
    // 5 momo packets "sold" for ₹50,000 collected — closes the gap the
    // revenue_mismatch check leaves open for momo-only days (no cups sold).
    const report = baseline({
      openingStock: { milk: 0, vegMomoPackets: 10, paneerMomoPackets: 0 },
      closingStock: { milk: 0, vegMomoPackets: 5, paneerMomoPackets: 0 },
      sales: { regularCups: 0, specialCups: 0, kulhadCups: 0, vegMomoPackets: 5, paneerMomoPackets: 0 },
      payments: { upi: 50000, cash: 0 },
    });
    const result = computeAntiCheatMetrics(report);
    const flag = result.flags.find((f) => f.type === 'momo_revenue_mismatch');
    expect(flag).toBeDefined();
    expect(flag.severity).toBe('high');
    expect(result.status).toBe('flagged');
    expect(result.computed.revenuePerMomoPacket).toBe(10000);
  });

  it('flags high severity when a momo-only day has implausibly low revenue per packet (under-reporting)', () => {
    // 20 momo packets "sold" for only ₹100 collected — classic under-reporting pattern.
    const report = baseline({
      openingStock: { milk: 0, vegMomoPackets: 25, paneerMomoPackets: 0 },
      closingStock: { milk: 0, vegMomoPackets: 5, paneerMomoPackets: 0 },
      sales: { regularCups: 0, specialCups: 0, kulhadCups: 0, vegMomoPackets: 20, paneerMomoPackets: 0 },
      payments: { upi: 100, cash: 0 },
    });
    const result = computeAntiCheatMetrics(report);
    const flag = result.flags.find((f) => f.type === 'momo_revenue_mismatch');
    expect(flag).toBeDefined();
    expect(flag.severity).toBe('high');
  });

  it('does not flag exactly at the MIN_PRICE_MOMO boundary (₹20)', () => {
    const report = baseline({
      openingStock: { milk: 0, vegMomoPackets: 10, paneerMomoPackets: 0 },
      closingStock: { milk: 0, vegMomoPackets: 5, paneerMomoPackets: 0 },
      sales: { regularCups: 0, specialCups: 0, kulhadCups: 0, vegMomoPackets: 5, paneerMomoPackets: 0 },
      payments: { upi: 100, cash: 0 }, // 100/5 = 20 exactly
    });
    const result = computeAntiCheatMetrics(report);
    expect(flagTypes(result)).not.toContain('momo_revenue_mismatch');
  });

  it('does not flag exactly at the MAX_PRICE_MOMO boundary (₹150)', () => {
    const report = baseline({
      openingStock: { milk: 0, vegMomoPackets: 10, paneerMomoPackets: 0 },
      closingStock: { milk: 0, vegMomoPackets: 5, paneerMomoPackets: 0 },
      sales: { regularCups: 0, specialCups: 0, kulhadCups: 0, vegMomoPackets: 5, paneerMomoPackets: 0 },
      payments: { upi: 750, cash: 0 }, // 750/5 = 150 exactly
    });
    const result = computeAntiCheatMetrics(report);
    expect(flagTypes(result)).not.toContain('momo_revenue_mismatch');
  });

  it('does not flag a normal momo-only day within the plausible range', () => {
    const report = baseline({
      openingStock: { milk: 0, vegMomoPackets: 10, paneerMomoPackets: 5 },
      closingStock: { milk: 0, vegMomoPackets: 4, paneerMomoPackets: 2 },
      sales: { regularCups: 0, specialCups: 0, kulhadCups: 0, vegMomoPackets: 6, paneerMomoPackets: 3 },
      payments: { upi: 300, cash: 150 }, // 450 / 9 packets = 50/packet
    });
    const result = computeAntiCheatMetrics(report);
    expect(flagTypes(result)).not.toContain('momo_revenue_mismatch');
  });

  it('does not flag when totalMomoPackets is 0', () => {
    const report = baseline({
      sales: { regularCups: 0, specialCups: 0, kulhadCups: 0, vegMomoPackets: 0, paneerMomoPackets: 0 },
      payments: { upi: 50000, cash: 0 },
    });
    const result = computeAntiCheatMetrics(report);
    expect(flagTypes(result)).not.toContain('momo_revenue_mismatch');
  });

  it('does not flag on a mixed day (cups also sold), even with an implausible momo-only ratio — the cup-based check owns mixed days', () => {
    // Same baseline as the top-level happy path (30 cups, matches milk exactly)
    // but with momo revenue skewed wildly; totalCups > 0 so this check is skipped.
    const report = baseline({
      sales: { regularCups: 30, specialCups: 0, kulhadCups: 0, vegMomoPackets: 1, paneerMomoPackets: 0 },
      payments: { upi: 300, cash: 150 },
    });
    const result = computeAntiCheatMetrics(report);
    expect(flagTypes(result)).not.toContain('momo_revenue_mismatch');
  });
});

describe('computeAntiCheatMetrics — low_upi', () => {
  it('flags medium severity when UPI ratio is low and revenue exceeds ₹500', () => {
    // total 600, upi 50 -> ratio 0.083
    const report = baseline({ payments: { upi: 50, cash: 550 } });
    const result = computeAntiCheatMetrics(report);
    const flag = result.flags.find((f) => f.type === 'low_upi');
    expect(flag).toBeDefined();
    expect(flag.severity).toBe('medium');
    expect(result.status).toBe('submitted'); // medium only
  });

  it('never flags when total revenue is ₹500 or less, no matter how low the UPI ratio is', () => {
    const report = baseline({ payments: { upi: 0, cash: 500 } }); // exactly 500, all cash
    const result = computeAntiCheatMetrics(report);
    expect(flagTypes(result)).not.toContain('low_upi');
  });

  it('flags once revenue crosses ₹500', () => {
    const report = baseline({ payments: { upi: 0, cash: 501 } });
    const result = computeAntiCheatMetrics(report);
    expect(flagTypes(result)).toContain('low_upi');
  });

  it('does not flag exactly at the 20% UPI ratio boundary', () => {
    const report = baseline({ payments: { upi: 120, cash: 480 } }); // 600 total, ratio exactly 0.20
    const result = computeAntiCheatMetrics(report);
    expect(flagTypes(result)).not.toContain('low_upi');
  });

  it('does not flag a healthy UPI ratio', () => {
    const report = baseline({ payments: { upi: 500, cash: 100 } }); // ratio 0.833
    const result = computeAntiCheatMetrics(report);
    expect(flagTypes(result)).not.toContain('low_upi');
  });

  it('does not divide by zero when there is no revenue at all', () => {
    const report = baseline({
      sales: { regularCups: 0, specialCups: 0, kulhadCups: 0, vegMomoPackets: 0, paneerMomoPackets: 0 },
      payments: { upi: 0, cash: 0 },
    });
    const result = computeAntiCheatMetrics(report);
    expect(result.computed.upiRatio).toBe(0);
    expect(flagTypes(result)).not.toContain('low_upi');
  });
});

describe('computeAntiCheatMetrics — status derivation', () => {
  it('stays "submitted" when only medium-severity flags are present', () => {
    // trigger low_upi (medium) and milk_mismatch (medium) simultaneously
    const report = baseline({
      sales: { regularCups: 23, specialCups: 0, kulhadCups: 0, vegMomoPackets: 6, paneerMomoPackets: 6 },
      payments: { upi: 50, cash: 550 },
    });
    const result = computeAntiCheatMetrics(report);
    expect(result.flags.length).toBeGreaterThanOrEqual(2);
    expect(result.flags.every((f) => f.severity !== 'high')).toBe(true);
    expect(result.status).toBe('submitted');
  });

  it('becomes "flagged" as soon as any single flag is high severity, even amongst mediums', () => {
    const report = baseline({
      // milk_mismatch medium (23 cups vs 30 expected)
      sales: { regularCups: 23, specialCups: 0, kulhadCups: 0, vegMomoPackets: 6, paneerMomoPackets: 6 },
      // revenue_mismatch high (23 cups, revenuePerCup way out of range)
      payments: { upi: 5, cash: 0 },
    });
    const result = computeAntiCheatMetrics(report);
    const severities = result.flags.map((f) => f.severity);
    expect(severities).toContain('high');
    expect(result.status).toBe('flagged');
  });

  it('can raise all four flag types at once on a sufficiently bad report', () => {
    const report = {
      openingStock: { milk: 5, vegMomoPackets: 20, paneerMomoPackets: 0 },
      purchases: { milk: 0, vegMomoPackets: 0, paneerMomoPackets: 0 },
      closingStock: { milk: 1, vegMomoPackets: 15, paneerMomoPackets: 0 }, // expected momo = 5
      sales: {
        regularCups: 5, specialCups: 0, kulhadCups: 0, // expectedCups = 4*7.5=30, deviation huge -> milk_mismatch high
        vegMomoPackets: 1, paneerMomoPackets: 0, // vs expected 5 -> deviation 0.8 -> momo_stock_mismatch high
      },
      payments: { upi: 10, cash: 590 }, // revenuePerCup = 600/5=120 -> revenue_mismatch high; upiRatio=10/600=0.017, revenue>500 -> low_upi medium
    };
    const result = computeAntiCheatMetrics(report);
    expect(flagTypes(result).sort()).toEqual(
      ['low_upi', 'milk_mismatch', 'momo_stock_mismatch', 'revenue_mismatch'].sort()
    );
    expect(result.status).toBe('flagged');
  });
});

describe('computeAntiCheatMetrics — defensive numeric handling', () => {
  it('treats missing/undefined optional numeric fields as zero rather than throwing', () => {
    const report = {
      openingStock: { milk: 5 }, // no momo fields at all
      purchases: { milk: 0 },
      closingStock: { milk: 1 }, // no momo fields at all
      sales: { regularCups: 30 }, // no special/kulhad/momo fields
      payments: { upi: 300, cash: 150 },
    };
    expect(() => computeAntiCheatMetrics(report)).not.toThrow();
    const result = computeAntiCheatMetrics(report);
    expect(result.computed.totalMomoPackets).toBe(0);
    expect(result.computed.expectedMomoFromStock).toBe(0);
  });
});

describe('computeAntiCheatMetrics — non-unit sales (snacks and cigarettes)', () => {
  it('does not let side sales inflate the revenue-per-cup check', () => {
    // ₹450 of chai plus ₹600 of cigarettes: per-cup is still ₹15, not ₹35
    const report = baseline({
      sales: { regularCups: 30, specialCups: 0, kulhadCups: 0, vegMomoPackets: 6, paneerMomoPackets: 6, snacks: 0, cigarettes: 600 },
      payments: { upi: 700, cash: 350 },
    });
    const result = computeAntiCheatMetrics(report);

    expect(result.computed.revenuePerCup).toBe(15);
    expect(flagTypes(result)).not.toContain('revenue_mismatch');
  });

  it('still reports the full amount collected', () => {
    const report = baseline({
      sales: { regularCups: 30, specialCups: 0, kulhadCups: 0, vegMomoPackets: 6, paneerMomoPackets: 6, snacks: 100, cigarettes: 600 },
      payments: { upi: 700, cash: 450 },
    });
    expect(computeAntiCheatMetrics(report).computed.totalRevenue).toBe(1150);
  });

  it('still flags a genuinely wrong per-cup rate once side sales are netted out', () => {
    const report = baseline({
      sales: { regularCups: 10, specialCups: 0, kulhadCups: 0, vegMomoPackets: 6, paneerMomoPackets: 6, snacks: 0, cigarettes: 100 },
      payments: { upi: 900, cash: 0 },
    });
    // ₹800 net over 10 cups = ₹80/cup, past the ceiling the check allows
    expect(flagTypes(computeAntiCheatMetrics(report))).toContain('revenue_mismatch');
  });
});

describe('admin verdict survives a recompute', () => {
  // Mirrors the Report pre-save hook: an admin's decision is not re-derived,
  // so saving a reviewed report for an unrelated reason (attaching the
  // cart-closing photo) must not drop it back to flagged.
  const applyHook = (doc) => {
    const { computed, flags, status } = computeAntiCheatMetrics(doc);
    const adminDecided = doc.status === 'reviewed' || doc.status === 'cleared';
    return { ...doc, computed, flags, status: adminDecided ? doc.status : status };
  };

  const flaggable = () => baseline({
    sales: { regularCups: 10, specialCups: 0, kulhadCups: 0, vegMomoPackets: 6, paneerMomoPackets: 6 },
  });

  it('leaves a reviewed report reviewed', () => {
    const saved = applyHook({ ...flaggable(), status: 'reviewed' });
    expect(saved.status).toBe('reviewed');
    // the flags themselves are still recomputed and visible
    expect(saved.flags.length).toBeGreaterThan(0);
  });

  it('leaves a cleared report cleared', () => {
    expect(applyHook({ ...flaggable(), status: 'cleared' }).status).toBe('cleared');
  });

  it('still re-derives the status of an unreviewed report', () => {
    expect(applyHook({ ...flaggable(), status: 'submitted' }).status).toBe('flagged');
  });

  it('re-derives after an edit resets the status', () => {
    // The edit route sets status back to 'submitted' precisely so corrected
    // figures get a fresh verdict
    const corrected = applyHook({ ...baseline(), status: 'submitted' });
    expect(corrected.status).toBe('submitted');
    expect(corrected.flags).toEqual([]);
  });
});

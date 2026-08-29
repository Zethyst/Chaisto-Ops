import { computeReportMetrics } from '../antiCheatCalc';
import { DailyReport } from '../../../types';

// A clean baseline draft where nothing should be flagged — mirrors the
// backend's antiCheat.test.js baseline exactly so both implementations can
// be checked against the same numbers.
function baseline(overrides: Partial<DailyReport> = {}): Partial<DailyReport> {
  const draft: Partial<DailyReport> = {
    openingStock: { milk: 5, sugar: 1, teaLeaves: 100, cups: 50, kulhadCups: 20, vegMomoPackets: 10, paneerMomoPackets: 10 },
    purchases: { milk: 0, snacks: 0, vegMomoPackets: 0, paneerMomoPackets: 0 },
    closingStock: { milk: 1, sugar: 0.5, teaLeaves: 20, cups: 20, kulhadCups: 5, vegMomoPackets: 4, paneerMomoPackets: 4 },
    sales: { regularCups: 30, specialCups: 0, kulhadCups: 0, vegMomoPackets: 6, paneerMomoPackets: 6, snacks: 0 },
    payments: { upi: 300, cash: 150 },
  };
  return { ...draft, ...overrides };
}

function flagTypes(result: ReturnType<typeof computeReportMetrics>) {
  return result.flags.map((f) => f.type);
}

describe('computeReportMetrics — baseline / happy path', () => {
  it('produces no flags when everything reconciles', () => {
    const result = computeReportMetrics(baseline());
    expect(result.flags).toEqual([]);
  });

  it('computes exact numeric values for the computed block', () => {
    const { computed } = computeReportMetrics(baseline());
    expect(computed.totalRevenue).toBe(450);
    expect(computed.milkUsed).toBe(4);
    expect(computed.expectedCupsFromMilk).toBe(30);
    expect(computed.revenuePerCup).toBe(15);
    expect(computed.upiRatio).toBeCloseTo(300 / 450, 10);
    expect(computed.totalMomoPackets).toBe(12);
    expect(computed.expectedMomoFromStock).toBe(12);
  });

  it('handles an entirely empty draft without crashing', () => {
    const empty: Partial<DailyReport> = {
      openingStock: { milk: 0, sugar: 0, teaLeaves: 0, cups: 0, kulhadCups: 0, vegMomoPackets: 0, paneerMomoPackets: 0 },
      purchases: { milk: 0, snacks: 0, vegMomoPackets: 0, paneerMomoPackets: 0 },
      closingStock: { milk: 0, sugar: 0, teaLeaves: 0, cups: 0, kulhadCups: 0, vegMomoPackets: 0, paneerMomoPackets: 0 },
      sales: { regularCups: 0, specialCups: 0, kulhadCups: 0, vegMomoPackets: 0, paneerMomoPackets: 0, snacks: 0 },
      payments: { upi: 0, cash: 0 },
    };
    const result = computeReportMetrics(empty);
    expect(result.flags).toEqual([]);
    expect(result.computed.totalRevenue).toBe(0);
    expect(result.computed.upiRatio).toBe(0);
    expect(result.computed.revenuePerCup).toBe(0);
  });

  it('tolerates a fully undefined draft (all optional chaining paths)', () => {
    expect(() => computeReportMetrics({})).not.toThrow();
    const result = computeReportMetrics({});
    expect(result.flags).toEqual([]);
  });
});

describe('computeReportMetrics — milk_mismatch', () => {
  it('does not flag right at the 20% boundary', () => {
    const report = baseline({ sales: { regularCups: 24, specialCups: 0, kulhadCups: 0, vegMomoPackets: 6, paneerMomoPackets: 6, snacks: 0 } });
    const result = computeReportMetrics(report);
    expect(flagTypes(result)).not.toContain('milk_mismatch');
  });

  it('flags medium severity just above the 20% threshold', () => {
    const report = baseline({ sales: { regularCups: 23, specialCups: 0, kulhadCups: 0, vegMomoPackets: 6, paneerMomoPackets: 6, snacks: 0 } });
    const result = computeReportMetrics(report);
    const flag = result.flags.find((f) => f.type === 'milk_mismatch');
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe('medium');
  });

  it('agrees with the backend on the high-severity boundary (45%, not 40%)', () => {
    // deviation exactly 0.45 -> totalCups = 30 * 0.55 = 16.5
    // Backend classifies this as MEDIUM (its condition is `> 0.45`).
    // This test locks in that the frontend must match — see antiCheat.js.
    const report = baseline({ sales: { regularCups: 16.5, specialCups: 0, kulhadCups: 0, vegMomoPackets: 6, paneerMomoPackets: 6, snacks: 0 } });
    const result = computeReportMetrics(report);
    const flag = result.flags.find((f) => f.type === 'milk_mismatch');
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe('medium');
  });

  it('flags high severity clearly above the 45% threshold', () => {
    const report = baseline({ sales: { regularCups: 10, specialCups: 0, kulhadCups: 0, vegMomoPackets: 6, paneerMomoPackets: 6, snacks: 0 } });
    const result = computeReportMetrics(report);
    const flag = result.flags.find((f) => f.type === 'milk_mismatch');
    expect(flag!.severity).toBe('high');
  });

  it('does not flag when totalCups is 0', () => {
    const report = baseline({ sales: { regularCups: 0, specialCups: 0, kulhadCups: 0, vegMomoPackets: 6, paneerMomoPackets: 6, snacks: 0 } });
    const result = computeReportMetrics(report);
    expect(flagTypes(result)).not.toContain('milk_mismatch');
  });

  it('does not flag when expectedCupsFromMilk is 0 or negative', () => {
    const report = baseline({
      openingStock: { milk: 1, sugar: 0, teaLeaves: 0, cups: 0, kulhadCups: 0, vegMomoPackets: 10, paneerMomoPackets: 10 },
      closingStock: { milk: 5, sugar: 0, teaLeaves: 0, cups: 0, kulhadCups: 0, vegMomoPackets: 4, paneerMomoPackets: 4 },
      sales: { regularCups: 20, specialCups: 0, kulhadCups: 0, vegMomoPackets: 6, paneerMomoPackets: 6, snacks: 0 },
    });
    const result = computeReportMetrics(report);
    expect(flagTypes(result)).not.toContain('milk_mismatch');
    expect(result.computed.milkUsed).toBe(-4);
  });
});

describe('computeReportMetrics — momo_stock_mismatch', () => {
  it('does not flag right at the 20% boundary', () => {
    const report = baseline({
      openingStock: { milk: 5, sugar: 1, teaLeaves: 100, cups: 50, kulhadCups: 20, vegMomoPackets: 20, paneerMomoPackets: 0 },
      closingStock: { milk: 1, sugar: 0.5, teaLeaves: 20, cups: 20, kulhadCups: 5, vegMomoPackets: 0, paneerMomoPackets: 0 },
      sales: { regularCups: 30, specialCups: 0, kulhadCups: 0, vegMomoPackets: 16, paneerMomoPackets: 0, snacks: 0 },
    });
    const result = computeReportMetrics(report);
    expect(result.computed.expectedMomoFromStock).toBe(20);
    expect(flagTypes(result)).not.toContain('momo_stock_mismatch');
  });

  it('flags medium severity just above the 20% threshold', () => {
    const report = baseline({ sales: { regularCups: 30, specialCups: 0, kulhadCups: 0, vegMomoPackets: 9, paneerMomoPackets: 0, snacks: 0 } });
    const result = computeReportMetrics(report);
    const flag = result.flags.find((f) => f.type === 'momo_stock_mismatch');
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe('medium');
  });

  it('flags high severity above the 45% threshold', () => {
    const report = baseline({ sales: { regularCups: 30, specialCups: 0, kulhadCups: 0, vegMomoPackets: 5, paneerMomoPackets: 0, snacks: 0 } });
    const result = computeReportMetrics(report);
    const flag = result.flags.find((f) => f.type === 'momo_stock_mismatch');
    expect(flag!.severity).toBe('high');
  });

  it('does not flag when totalMomoPackets is 0', () => {
    const report = baseline({ sales: { regularCups: 30, specialCups: 0, kulhadCups: 0, vegMomoPackets: 0, paneerMomoPackets: 0, snacks: 0 } });
    const result = computeReportMetrics(report);
    expect(flagTypes(result)).not.toContain('momo_stock_mismatch');
  });

  it('does not flag when expectedMomoFromStock is 0 or negative', () => {
    const report = baseline({
      openingStock: { milk: 5, sugar: 1, teaLeaves: 100, cups: 50, kulhadCups: 20, vegMomoPackets: 2, paneerMomoPackets: 2 },
      closingStock: { milk: 1, sugar: 0.5, teaLeaves: 20, cups: 20, kulhadCups: 5, vegMomoPackets: 6, paneerMomoPackets: 6 },
      sales: { regularCups: 30, specialCups: 0, kulhadCups: 0, vegMomoPackets: 6, paneerMomoPackets: 6, snacks: 0 },
    });
    const result = computeReportMetrics(report);
    expect(flagTypes(result)).not.toContain('momo_stock_mismatch');
    expect(result.computed.expectedMomoFromStock).toBe(-8);
  });
});

describe('computeReportMetrics — revenue_mismatch', () => {
  it('flags high severity below the minimum price per cup', () => {
    const report = baseline({ payments: { upi: 100, cash: 50 } }); // 150/30 = 5
    const result = computeReportMetrics(report);
    const flag = result.flags.find((f) => f.type === 'revenue_mismatch');
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe('high');
  });

  it('flags high severity above the maximum price per cup', () => {
    const report = baseline({ payments: { upi: 2000, cash: 1000 } }); // 3000/30 = 100
    const result = computeReportMetrics(report);
    expect(flagTypes(result)).toContain('revenue_mismatch');
  });

  it('does not flag exactly at the effective boundaries (10 and 60)', () => {
    const low = computeReportMetrics(baseline({ payments: { upi: 200, cash: 100 } })); // 10/cup
    const high = computeReportMetrics(baseline({ payments: { upi: 1200, cash: 600 } })); // 60/cup
    expect(flagTypes(low)).not.toContain('revenue_mismatch');
    expect(flagTypes(high)).not.toContain('revenue_mismatch');
  });

  it('does not flag when totalCups is 0, regardless of revenue (momo_revenue_mismatch handles that instead)', () => {
    const report = baseline({
      sales: { regularCups: 0, specialCups: 0, kulhadCups: 0, vegMomoPackets: 6, paneerMomoPackets: 6, snacks: 0 },
      payments: { upi: 100000, cash: 0 },
    });
    const result = computeReportMetrics(report);
    expect(flagTypes(result)).not.toContain('revenue_mismatch');
  });
});

describe('computeReportMetrics — momo_revenue_mismatch', () => {
  it('flags high severity when a momo-only day has implausibly high revenue per packet', () => {
    const report = baseline({
      openingStock: { milk: 0, sugar: 0, teaLeaves: 0, cups: 0, kulhadCups: 0, vegMomoPackets: 10, paneerMomoPackets: 0 },
      closingStock: { milk: 0, sugar: 0, teaLeaves: 0, cups: 0, kulhadCups: 0, vegMomoPackets: 5, paneerMomoPackets: 0 },
      sales: { regularCups: 0, specialCups: 0, kulhadCups: 0, vegMomoPackets: 5, paneerMomoPackets: 0, snacks: 0 },
      payments: { upi: 50000, cash: 0 },
    });
    const result = computeReportMetrics(report);
    const flag = result.flags.find((f) => f.type === 'momo_revenue_mismatch');
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe('high');
    expect(result.computed.revenuePerMomoPacket).toBe(10000);
  });

  it('flags high severity when a momo-only day has implausibly low revenue per packet', () => {
    const report = baseline({
      openingStock: { milk: 0, sugar: 0, teaLeaves: 0, cups: 0, kulhadCups: 0, vegMomoPackets: 25, paneerMomoPackets: 0 },
      closingStock: { milk: 0, sugar: 0, teaLeaves: 0, cups: 0, kulhadCups: 0, vegMomoPackets: 5, paneerMomoPackets: 0 },
      sales: { regularCups: 0, specialCups: 0, kulhadCups: 0, vegMomoPackets: 20, paneerMomoPackets: 0, snacks: 0 },
      payments: { upi: 100, cash: 0 },
    });
    const result = computeReportMetrics(report);
    const flag = result.flags.find((f) => f.type === 'momo_revenue_mismatch');
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe('high');
  });

  it('does not flag exactly at the ₹20/₹150 boundaries', () => {
    const low = computeReportMetrics(baseline({
      openingStock: { milk: 0, sugar: 0, teaLeaves: 0, cups: 0, kulhadCups: 0, vegMomoPackets: 10, paneerMomoPackets: 0 },
      closingStock: { milk: 0, sugar: 0, teaLeaves: 0, cups: 0, kulhadCups: 0, vegMomoPackets: 5, paneerMomoPackets: 0 },
      sales: { regularCups: 0, specialCups: 0, kulhadCups: 0, vegMomoPackets: 5, paneerMomoPackets: 0, snacks: 0 },
      payments: { upi: 100, cash: 0 }, // 100/5 = 20
    }));
    const high = computeReportMetrics(baseline({
      openingStock: { milk: 0, sugar: 0, teaLeaves: 0, cups: 0, kulhadCups: 0, vegMomoPackets: 10, paneerMomoPackets: 0 },
      closingStock: { milk: 0, sugar: 0, teaLeaves: 0, cups: 0, kulhadCups: 0, vegMomoPackets: 5, paneerMomoPackets: 0 },
      sales: { regularCups: 0, specialCups: 0, kulhadCups: 0, vegMomoPackets: 5, paneerMomoPackets: 0, snacks: 0 },
      payments: { upi: 750, cash: 0 }, // 750/5 = 150
    }));
    expect(flagTypes(low)).not.toContain('momo_revenue_mismatch');
    expect(flagTypes(high)).not.toContain('momo_revenue_mismatch');
  });

  it('does not flag when totalMomoPackets is 0', () => {
    const report = baseline({
      sales: { regularCups: 0, specialCups: 0, kulhadCups: 0, vegMomoPackets: 0, paneerMomoPackets: 0, snacks: 0 },
      payments: { upi: 50000, cash: 0 },
    });
    const result = computeReportMetrics(report);
    expect(flagTypes(result)).not.toContain('momo_revenue_mismatch');
  });

  it('does not flag on a mixed day (cups also sold) even with a skewed momo ratio', () => {
    const report = baseline({
      sales: { regularCups: 30, specialCups: 0, kulhadCups: 0, vegMomoPackets: 1, paneerMomoPackets: 0, snacks: 0 },
      payments: { upi: 300, cash: 150 },
    });
    const result = computeReportMetrics(report);
    expect(flagTypes(result)).not.toContain('momo_revenue_mismatch');
  });
});

describe('computeReportMetrics — low_upi', () => {
  it('flags medium severity when UPI ratio is low and revenue exceeds ₹500', () => {
    const report = baseline({ payments: { upi: 50, cash: 550 } });
    const result = computeReportMetrics(report);
    const flag = result.flags.find((f) => f.type === 'low_upi');
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe('medium');
  });

  it('never flags when total revenue is ₹500 or less', () => {
    const report = baseline({ payments: { upi: 0, cash: 500 } });
    const result = computeReportMetrics(report);
    expect(flagTypes(result)).not.toContain('low_upi');
  });

  it('flags once revenue crosses ₹500', () => {
    const report = baseline({ payments: { upi: 0, cash: 501 } });
    const result = computeReportMetrics(report);
    expect(flagTypes(result)).toContain('low_upi');
  });

  it('does not flag exactly at the 20% UPI ratio boundary', () => {
    const report = baseline({ payments: { upi: 120, cash: 480 } });
    const result = computeReportMetrics(report);
    expect(flagTypes(result)).not.toContain('low_upi');
  });
});

describe('computeReportMetrics — cross-check against backend on shared scenarios', () => {
  it('produces the same flag set as the backend for the "all four flags" scenario', () => {
    // Mirrors antiCheat.test.js's "can raise all four flag types at once" case.
    const report: Partial<DailyReport> = {
      openingStock: { milk: 5, sugar: 0, teaLeaves: 0, cups: 0, kulhadCups: 0, vegMomoPackets: 20, paneerMomoPackets: 0 },
      purchases: { milk: 0, snacks: 0, vegMomoPackets: 0, paneerMomoPackets: 0 },
      closingStock: { milk: 1, sugar: 0, teaLeaves: 0, cups: 0, kulhadCups: 0, vegMomoPackets: 15, paneerMomoPackets: 0 },
      sales: { regularCups: 5, specialCups: 0, kulhadCups: 0, vegMomoPackets: 1, paneerMomoPackets: 0, snacks: 0 },
      payments: { upi: 10, cash: 590 },
    };
    const result = computeReportMetrics(report);
    expect(flagTypes(result).sort()).toEqual(
      ['low_upi', 'milk_mismatch', 'momo_stock_mismatch', 'revenue_mismatch'].sort()
    );
  });
});

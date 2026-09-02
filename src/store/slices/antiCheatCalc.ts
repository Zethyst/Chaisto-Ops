import { DailyReport, SuspicionFlag } from '../../types';
import { BREW_CONSTANTS } from '../../constants/brew';

// Pure anti-cheat computation engine — deliberately has zero React Native or
// service imports so it stays unit-testable without mocking native modules.
// This mirrors the backend's authoritative check in
// backend/src/utils/antiCheat.js; keep the two in sync (see their shared
// test scenarios).
export function computeReportMetrics(report: Partial<DailyReport>): {
  computed: DailyReport['computed'];
  flags: SuspicionFlag[];
} {
  const { openingStock, purchases, sales, payments, closingStock } = report;
  const flags: SuspicionFlag[] = [];

  const totalCups = (sales?.regularCups || 0) + (sales?.specialCups || 0) + (sales?.kulhadCups || 0);
  const totalMomoPackets = (sales?.vegMomoPackets || 0) + (sales?.paneerMomoPackets || 0);
  const milkUsed = (openingStock?.milk || 0) + (purchases?.milk || 0) - (closingStock?.milk || 0);
  const expectedCupsFromMilk = milkUsed * BREW_CONSTANTS.CUPS_PER_LITRE;
  const momoOpening = (openingStock?.vegMomoPackets || 0) + (openingStock?.paneerMomoPackets || 0);
  const momoPurchased = (purchases?.vegMomoPackets || 0) + (purchases?.paneerMomoPackets || 0);
  const momoClosing = (closingStock?.vegMomoPackets || 0) + (closingStock?.paneerMomoPackets || 0);
  const expectedMomoFromStock = momoOpening + momoPurchased - momoClosing;
  const totalRevenue = (payments?.upi || 0) + (payments?.cash || 0);
  // Snacks and cigarettes are sold by rupee value, not by the cup or plate, so
  // they are netted out before checking the per-unit rate — otherwise a stall
  // with healthy side sales looks like it is overcharging for chai.
  const nonUnitSales = (sales?.snacks || 0) + (sales?.cigarettes || 0);
  const unitRevenue = Math.max(0, totalRevenue - nonUnitSales);
  const revenuePerCup = totalCups > 0 ? unitRevenue / totalCups : 0;
  const revenuePerMomoPacket = totalMomoPackets > 0 ? unitRevenue / totalMomoPackets : 0;
  const upiRatio = totalRevenue > 0 ? (payments?.upi || 0) / totalRevenue : 0;

  // Flag 1: Milk vs cups mismatch (>20% deviation)
  if (totalCups > 0 && expectedCupsFromMilk > 0) {
    const deviation = Math.abs(totalCups - expectedCupsFromMilk) / expectedCupsFromMilk;
    if (deviation > 0.2) {
      flags.push({
        type: 'milk_mismatch',
        severity: deviation > 0.45 ? 'high' : 'medium',
        message: `${totalCups} cups reported but milk suggests ~${Math.round(expectedCupsFromMilk)} cups`,
        value: totalCups,
        expectedValue: Math.round(expectedCupsFromMilk),
      });
    }
  }

  // Flag 1b: Momo stock vs sales mismatch (>20% deviation)
  if (totalMomoPackets > 0 && expectedMomoFromStock > 0) {
    const momoDeviation = Math.abs(totalMomoPackets - expectedMomoFromStock) / expectedMomoFromStock;
    if (momoDeviation > 0.2) {
      flags.push({
        type: 'momo_stock_mismatch',
        severity: momoDeviation > 0.45 ? 'high' : 'medium',
        message: `${totalMomoPackets} momo plates reported but stock suggests ~${Math.round(expectedMomoFromStock)} plates`,
        value: totalMomoPackets,
        expectedValue: Math.round(expectedMomoFromStock),
      });
    }
  }

  // Flag 2: Revenue vs cups mismatch
  if (revenuePerCup > 0 && (revenuePerCup < BREW_CONSTANTS.MIN_PRICE_REGULAR || revenuePerCup > BREW_CONSTANTS.MAX_PRICE_REGULAR * 2)) {
    flags.push({
      type: 'revenue_mismatch',
      severity: 'high',
      message: `Revenue per cup ₹${revenuePerCup.toFixed(0)} is outside normal range (₹${BREW_CONSTANTS.MIN_PRICE_REGULAR}-₹${BREW_CONSTANTS.MAX_PRICE_REGULAR})`,
      value: revenuePerCup,
    });
  }

  // Flag 2b: Revenue vs momo plates mismatch — only on momo-only days (no
  // cups sold), since the cup-based check above already covers days with
  // cup sales. Matches the backend's MIN_PRICE_MOMO/MAX_PRICE_MOMO of 20/150.
  if (totalCups === 0 && totalMomoPackets > 0 && (revenuePerMomoPacket < 20 || revenuePerMomoPacket > 150)) {
    flags.push({
      type: 'momo_revenue_mismatch',
      severity: 'high',
      message: `Revenue per momo plate ₹${revenuePerMomoPacket.toFixed(0)} is outside normal range (₹20-₹150)`,
      value: revenuePerMomoPacket,
    });
  }

  // Flag 3: Low UPI ratio
  if (totalRevenue > 500 && upiRatio < BREW_CONSTANTS.UPI_MIN_RATIO) {
    flags.push({
      type: 'low_upi',
      severity: 'medium',
      message: `Only ${(upiRatio * 100).toFixed(0)}% of revenue via UPI — unusually low`,
      value: upiRatio,
      expectedValue: BREW_CONSTANTS.UPI_MIN_RATIO,
    });
  }

  return {
    computed: {
      totalRevenue,
      expectedCupsFromMilk: Math.round(expectedCupsFromMilk),
      milkUsed,
      revenuePerCup,
      revenuePerMomoPacket,
      upiRatio,
      totalMomoPackets,
      expectedMomoFromStock: Math.round(expectedMomoFromStock),
    },
    flags,
  };
}

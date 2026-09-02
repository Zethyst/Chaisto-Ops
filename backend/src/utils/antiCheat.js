// Pure anti-cheat computation — extracted from Report.js's pre('save') hook
// so the rules can be unit tested without a database.

const CUPS_PER_LITRE = 7.5;
const MIN_PRICE = 10;
const MAX_PRICE = 60;
const MIN_PRICE_MOMO = 20;
const MAX_PRICE_MOMO = 150;
const MIN_UPI_RATIO = 0.20;
const LOW_UPI_REVENUE_FLOOR = 500;
const MISMATCH_THRESHOLD = 0.20;
const MISMATCH_HIGH_THRESHOLD = 0.45;

/**
 * @param {object} report - has openingStock, purchases, closingStock, sales, payments
 * @returns {{ computed: object, flags: object[], status: 'submitted' | 'flagged' }}
 */
function computeAntiCheatMetrics(report) {
  const { openingStock, purchases, closingStock, sales, payments } = report;
  const flags = [];

  const milkUsed = (openingStock.milk || 0) + (purchases.milk || 0) - (closingStock.milk || 0);
  const expectedCups = milkUsed * CUPS_PER_LITRE;
  const totalCups = (sales.regularCups || 0) + (sales.specialCups || 0) + (sales.kulhadCups || 0);
  const totalMomoPackets = (sales.vegMomoPackets || 0) + (sales.paneerMomoPackets || 0);
  const totalRevenue = (payments.upi || 0) + (payments.cash || 0);
  // Snacks and cigarettes are sold by rupee value, not by the cup or plate, so
  // they are netted out before checking the per-unit rate — otherwise a stall
  // with healthy side sales looks like it is overcharging for chai.
  const nonUnitSales = (sales.snacks || 0) + (sales.cigarettes || 0);
  const unitRevenue = Math.max(0, totalRevenue - nonUnitSales);
  const revenuePerCup = totalCups > 0 ? unitRevenue / totalCups : 0;
  const revenuePerMomoPacket = totalMomoPackets > 0 ? unitRevenue / totalMomoPackets : 0;
  const upiRatio = totalRevenue > 0 ? payments.upi / totalRevenue : 0;
  const cupsDeviation = expectedCups > 0 ? Math.abs(totalCups - expectedCups) / expectedCups : 0;

  // Momo packets are a direct resale item (bought pre-made, not brewed) —
  // opening + purchased − closing should match packets sold almost exactly.
  const momoOpening = (openingStock.vegMomoPackets || 0) + (openingStock.paneerMomoPackets || 0);
  const momoPurchased = (purchases.vegMomoPackets || 0) + (purchases.paneerMomoPackets || 0);
  const momoClosing = (closingStock.vegMomoPackets || 0) + (closingStock.paneerMomoPackets || 0);
  const expectedMomoFromStock = momoOpening + momoPurchased - momoClosing;
  const momoStockDeviation = expectedMomoFromStock > 0
    ? Math.abs(totalMomoPackets - expectedMomoFromStock) / expectedMomoFromStock
    : 0;

  const computed = {
    totalRevenue,
    expectedCupsFromMilk: Math.round(expectedCups),
    milkUsed,
    revenuePerCup,
    revenuePerMomoPacket,
    upiRatio,
    cupsVsMilkDeviation: cupsDeviation,
    totalMomoPackets,
    expectedMomoFromStock,
    momoStockDeviation,
  };

  // Flag: milk vs cups mismatch
  if (totalCups > 0 && expectedCups > 0 && cupsDeviation > MISMATCH_THRESHOLD) {
    flags.push({
      type: 'milk_mismatch',
      severity: cupsDeviation > MISMATCH_HIGH_THRESHOLD ? 'high' : 'medium',
      message: `${totalCups} cups reported but milk used suggests ~${Math.round(expectedCups)} cups (${(cupsDeviation * 100).toFixed(0)}% off)`,
      value: totalCups,
      expectedValue: Math.round(expectedCups),
    });
  }

  // Flag: momo stock vs sales mismatch
  if (totalMomoPackets > 0 && expectedMomoFromStock > 0 && momoStockDeviation > MISMATCH_THRESHOLD) {
    flags.push({
      type: 'momo_stock_mismatch',
      severity: momoStockDeviation > MISMATCH_HIGH_THRESHOLD ? 'high' : 'medium',
      message: `${totalMomoPackets} momo plates sold but stock suggests ~${Math.round(expectedMomoFromStock)} plates (${(momoStockDeviation * 100).toFixed(0)}% off)`,
      value: totalMomoPackets,
      expectedValue: Math.round(expectedMomoFromStock),
    });
  }

  // Flag: revenue per cup out of range
  if (totalCups > 0 && (revenuePerCup < MIN_PRICE || revenuePerCup > MAX_PRICE)) {
    flags.push({
      type: 'revenue_mismatch',
      severity: 'high',
      message: `Revenue per cup ₹${revenuePerCup.toFixed(0)} is outside normal range (₹${MIN_PRICE}–₹${MAX_PRICE})`,
      value: revenuePerCup,
    });
  }

  // Flag: revenue per momo packet out of range — only engages on momo-only
  // days (no cups sold), since the cup-based check above already covers any
  // day with cup sales. Closes the gap where a momo-only day with wildly
  // implausible revenue would otherwise pass through unchecked.
  if (totalCups === 0 && totalMomoPackets > 0 && (revenuePerMomoPacket < MIN_PRICE_MOMO || revenuePerMomoPacket > MAX_PRICE_MOMO)) {
    flags.push({
      type: 'momo_revenue_mismatch',
      severity: 'high',
      message: `Revenue per momo plate ₹${revenuePerMomoPacket.toFixed(0)} is outside normal range (₹${MIN_PRICE_MOMO}–₹${MAX_PRICE_MOMO})`,
      value: revenuePerMomoPacket,
    });
  }

  // Flag: low UPI ratio (only meaningful if revenue > ₹500)
  if (totalRevenue > LOW_UPI_REVENUE_FLOOR && upiRatio < MIN_UPI_RATIO) {
    flags.push({
      type: 'low_upi',
      severity: 'medium',
      message: `Only ${(upiRatio * 100).toFixed(0)}% via UPI — unusually low cash-heavy pattern`,
      value: upiRatio,
      expectedValue: MIN_UPI_RATIO,
    });
  }

  const status = flags.some((f) => f.severity === 'high') ? 'flagged' : 'submitted';

  return { computed, flags, status };
}

module.exports = {
  computeAntiCheatMetrics,
  CUPS_PER_LITRE,
  MIN_PRICE,
  MAX_PRICE,
  MIN_PRICE_MOMO,
  MAX_PRICE_MOMO,
  MIN_UPI_RATIO,
  LOW_UPI_REVENUE_FLOOR,
  MISMATCH_THRESHOLD,
  MISMATCH_HIGH_THRESHOLD,
};

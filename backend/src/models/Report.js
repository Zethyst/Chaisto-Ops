const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
}, { _id: false });

const stockSchema = new mongoose.Schema({
  milk: { type: Number, default: 0, min: 0 },      // litres
  sugar: { type: Number, default: 0, min: 0 },     // kg
  teaLeaves: { type: Number, default: 0, min: 0 }, // grams
  cups: { type: Number, default: 0, min: 0 },      // count
}, { _id: false });

const flagSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['milk_mismatch', 'revenue_mismatch', 'low_upi', 'sales_drop', 'location_mismatch', 'missing_report'],
  },
  severity: { type: String, enum: ['low', 'medium', 'high'] },
  message: String,
  value: Number,
  expectedValue: Number,
}, { _id: false });

const reportSchema = new mongoose.Schema({
  stallId: { type: mongoose.Schema.Types.ObjectId, ref: 'Stall', required: true },
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  staffName: String,
  date: { type: String, required: true }, // YYYY-MM-DD
  submittedAt: { type: Date, required: true },

  openingStock: stockSchema,
  purchases: {
    milk: { type: Number, default: 0, min: 0 },
    snacks: { type: Number, default: 0, min: 0 }, // ₹
  },
  sales: {
    regularCups: { type: Number, default: 0, min: 0 },
    specialCups: { type: Number, default: 0, min: 0 },
    snacks: { type: Number, default: 0, min: 0 }, // ₹
  },
  payments: {
    upi: { type: Number, default: 0, min: 0 },
    cash: { type: Number, default: 0, min: 0 },
  },
  closingStock: stockSchema,

  photos: {
    cash: { type: String, required: true },
    cartClosing: { type: String, required: true },
    stock: { type: String, required: true },
    milkPacket: { type: String, required: true },
  },

  location: { type: locationSchema, required: true },
  deviceId: String,

  // Server-computed (not trusted from client)
  computed: {
    totalRevenue: Number,
    expectedCupsFromMilk: Number,
    milkUsed: Number,
    revenuePerCup: Number,
    upiRatio: Number,
    cupsVsMilkDeviation: Number, // percentage
  },

  flags: [flagSchema],
  adminNotes: String,
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: Date,

  status: {
    type: String,
    enum: ['submitted', 'reviewed', 'flagged', 'cleared'],
    default: 'submitted',
  },
}, { timestamps: true });

// Prevent duplicate reports for same staff+date
reportSchema.index({ staffId: 1, date: 1 }, { unique: true });
reportSchema.index({ stallId: 1, date: 1 });
reportSchema.index({ status: 1 });
reportSchema.index({ 'flags.severity': 1 });

// Server-side anti-cheat computation (override client-sent values)
reportSchema.pre('save', function (next) {
  const CUPS_PER_LITRE = 7.5;
  const MIN_PRICE = 10;
  const MAX_PRICE = 60;
  const MIN_UPI_RATIO = 0.20;

  const { openingStock, purchases, closingStock, sales, payments } = this;
  const flags = [];

  const milkUsed = (openingStock.milk + purchases.milk) - closingStock.milk;
  const expectedCups = milkUsed * CUPS_PER_LITRE;
  const totalCups = (sales.regularCups || 0) + (sales.specialCups || 0);
  const totalRevenue = (payments.upi || 0) + (payments.cash || 0);
  const revenuePerCup = totalCups > 0 ? totalRevenue / totalCups : 0;
  const upiRatio = totalRevenue > 0 ? payments.upi / totalRevenue : 0;
  const cupsDeviation = expectedCups > 0 ? Math.abs(totalCups - expectedCups) / expectedCups : 0;

  // Store computed values (server-authoritative)
  this.computed = {
    totalRevenue,
    expectedCupsFromMilk: Math.round(expectedCups),
    milkUsed,
    revenuePerCup,
    upiRatio,
    cupsVsMilkDeviation: cupsDeviation,
  };

  // Flag: milk vs cups mismatch >20%
  if (totalCups > 0 && expectedCups > 0 && cupsDeviation > 0.20) {
    flags.push({
      type: 'milk_mismatch',
      severity: cupsDeviation > 0.45 ? 'high' : 'medium',
      message: `${totalCups} cups reported but milk used suggests ~${Math.round(expectedCups)} cups (${(cupsDeviation * 100).toFixed(0)}% off)`,
      value: totalCups,
      expectedValue: Math.round(expectedCups),
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

  // Flag: low UPI ratio (only meaningful if revenue > ₹500)
  if (totalRevenue > 500 && upiRatio < MIN_UPI_RATIO) {
    flags.push({
      type: 'low_upi',
      severity: 'medium',
      message: `Only ${(upiRatio * 100).toFixed(0)}% via UPI — unusually low cash-heavy pattern`,
      value: upiRatio,
      expectedValue: MIN_UPI_RATIO,
    });
  }

  this.flags = flags;
  this.status = flags.some(f => f.severity === 'high') ? 'flagged' : 'submitted';

  next();
});

module.exports = mongoose.model('Report', reportSchema);

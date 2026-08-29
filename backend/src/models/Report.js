const mongoose = require('mongoose');
const { computeAntiCheatMetrics } = require('../utils/antiCheat');

const locationSchema = new mongoose.Schema({
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
}, { _id: false });

const stockSchema = new mongoose.Schema({
  milk: { type: Number, default: 0, min: 0 },         // litres
  sugar: { type: Number, default: 0, min: 0 },        // kg
  teaLeaves: { type: Number, default: 0, min: 0 },    // grams
  cups: { type: Number, default: 0, min: 0 },         // paper cup count
  kulhadCups: { type: Number, default: 0, min: 0 },   // kulhad cup count
  vegMomoPackets: { type: Number, default: 0, min: 0 },
  paneerMomoPackets: { type: Number, default: 0, min: 0 },
}, { _id: false });

const flagSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['milk_mismatch', 'momo_stock_mismatch', 'revenue_mismatch', 'momo_revenue_mismatch', 'low_upi', 'sales_drop', 'location_mismatch', 'missing_report'],
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
    vegMomoPackets: { type: Number, default: 0, min: 0 },
    paneerMomoPackets: { type: Number, default: 0, min: 0 },
  },
  sales: {
    regularCups: { type: Number, default: 0, min: 0 },
    specialCups: { type: Number, default: 0, min: 0 },
    kulhadCups: { type: Number, default: 0, min: 0 },
    vegMomoPackets: { type: Number, default: 0, min: 0 },
    paneerMomoPackets: { type: Number, default: 0, min: 0 },
    snacks: { type: Number, default: 0, min: 0 }, // ₹
  },
  payments: {
    upi: { type: Number, default: 0, min: 0 },
    cash: { type: Number, default: 0, min: 0 },
  },
  closingStock: stockSchema,

  photos: {
    cash: { type: String, required: true },
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
    totalMomoPackets: Number,
    expectedMomoFromStock: Number,
    momoStockDeviation: Number, // percentage
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
  const { computed, flags, status } = computeAntiCheatMetrics(this);
  this.computed = computed;
  this.flags = flags;
  this.status = status;
  next();
});

module.exports = mongoose.model('Report', reportSchema);

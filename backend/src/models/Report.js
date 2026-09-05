const mongoose = require('mongoose');
const { computeAntiCheatMetrics } = require('../utils/antiCheat');
const { mergeFlags, statusForFlags } = require('../utils/reportFlags');

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
    enum: ['milk_mismatch', 'momo_stock_mismatch', 'revenue_mismatch', 'momo_revenue_mismatch', 'low_upi', 'upi_undeclared', 'sales_drop', 'location_mismatch', 'missing_report'],
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
    snacks: { type: Number, default: 0, min: 0 },     // ₹
    cigarettes: { type: Number, default: 0, min: 0 }, // ₹
    vegMomoPackets: { type: Number, default: 0, min: 0 },
    paneerMomoPackets: { type: Number, default: 0, min: 0 },
  },
  sales: {
    regularCups: { type: Number, default: 0, min: 0 },
    specialCups: { type: Number, default: 0, min: 0 },
    kulhadCups: { type: Number, default: 0, min: 0 },
    vegMomoPackets: { type: Number, default: 0, min: 0 },
    paneerMomoPackets: { type: Number, default: 0, min: 0 },
    snacks: { type: Number, default: 0, min: 0 },     // ₹
    cigarettes: { type: Number, default: 0, min: 0 }, // ₹
  },
  payments: {
    upi: { type: Number, default: 0, min: 0 },
    cash: { type: Number, default: 0, min: 0 },
  },
  closingStock: stockSchema,

  // Required for staff submissions (enforced by the POST /reports validators);
  // an admin backfilling a past day has no photos to attach
  photos: {
    cash: { type: String },
    stock: { type: String },
    milkPacket: { type: String },
    // Optional — cart photo taken at closing time
    cartClosing: { type: String },
  },

  location: { type: locationSchema, required: true },

  // Set when an admin or moderator files the report on a staff member's behalf
  // for a past day — no photos or GPS exist for it
  isBackfill: { type: Boolean, default: false },
  enteredById: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  enteredByName: { type: String },

  // Every admin correction to a submitted report, kept in full: the figures a
  // staff member reported must stay traceable after someone changes them
  editHistory: [{
    editedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    editedByName: String,
    editedAt: { type: Date, default: Date.now },
    reason: String,
    changes: [{
      field: String,
      from: mongoose.Schema.Types.Mixed,
      to: mongoose.Schema.Types.Mixed,
      _id: false,
    }],
    _id: false,
  }],
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
  // Flags decided outside the figures — the GPS check, the UPI check against
  // the staff phone — survive the recompute instead of being wiped by it
  this.flags = mergeFlags(this.flags, flags);

  // An admin's verdict outlives a recompute — saving the document for an
  // unrelated reason (attaching the cart photo, say) must not quietly drop a
  // report back to "flagged" after it was reviewed or cleared. A route that
  // does want the verdict re-derived resets the status before saving.
  const adminDecided = this.status === 'reviewed' || this.status === 'cleared';
  if (!adminDecided) this.status = statusForFlags(this.flags, status);
  next();
});

module.exports = mongoose.model('Report', reportSchema);

const mongoose = require('mongoose');

const stallConfigSchema = new mongoose.Schema({
  stallId: { type: mongoose.Schema.Types.ObjectId, ref: 'Stall', required: true, unique: true },
  // Anti-cheat thresholds
  milkMismatchThresholdPct: { type: Number, default: 15 },  // % cups vs expected from milk
  upiMinRatioPct: { type: Number, default: 20 },             // minimum % revenue via UPI
  salesDropThresholdPct: { type: Number, default: 50 },      // % drop from 7-day avg
  locationRadiusMeters: { type: Number, default: 200 },      // GPS radius
  missingReportAlertHour: { type: Number, default: 21 },     // 9pm: alert if no report
  // Payroll
  cupsIncentivePerCup: { type: Number, default: 1 },         // ₹ per cup for staff
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedByName: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('StallConfig', stallConfigSchema);

const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
  key: { type: String, required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  active: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
  isDefault: { type: Boolean, default: false },
  recipe: { type: String, default: '' },
}, { _id: false });

const DEFAULT_MENU_ITEMS = [
  { key: 'regularChai', name: 'Regular Chai', price: 15, active: true, sortOrder: 0, isDefault: true },
  { key: 'specialChai', name: 'Special Chai', price: 25, active: true, sortOrder: 1, isDefault: true },
  { key: 'kulhadChai', name: 'Kulhad Chai', price: 20, active: true, sortOrder: 2, isDefault: true },
  { key: 'vegMomo', name: 'Veg Momo', price: 40, active: true, sortOrder: 3, isDefault: true },
  { key: 'paneerMomo', name: 'Paneer Momo', price: 60, active: true, sortOrder: 4, isDefault: true },
];

const stallConfigSchema = new mongoose.Schema({
  stallId: { type: mongoose.Schema.Types.ObjectId, ref: 'Stall', required: true, unique: true },
  // Anti-cheat thresholds
  milkMismatchThresholdPct: { type: Number, default: 15 },
  upiMinRatioPct: { type: Number, default: 20 },
  salesDropThresholdPct: { type: Number, default: 50 },
  locationRadiusMeters: { type: Number, default: 200 },
  missingReportAlertHour: { type: Number, default: 21 },
  // Payroll
  cupsIncentivePerCup: { type: Number, default: 1 },
  momoIncentivePerPacket: { type: Number, default: 5 },
  // Menu & pricing
  menuItems: { type: [menuItemSchema], default: DEFAULT_MENU_ITEMS },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedByName: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('StallConfig', stallConfigSchema);

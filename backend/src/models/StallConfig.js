const mongoose = require('mongoose');

// A serving size an item can be sold in (half plate / full plate). stockFactor
// is how much of the item's stock unit one serving consumes, so plate sales
// still reconcile against the packet-based opening/closing stock.
const menuPortionSchema = new mongoose.Schema({
  key: { type: String, required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  stockFactor: { type: Number, default: 1, min: 0 },
}, { _id: false });

const menuItemSchema = new mongoose.Schema({
  key: { type: String, required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  active: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
  isDefault: { type: Boolean, default: false },
  recipe: { type: String, default: '' },
  // When non-empty the item is sold per portion and `price` is unused
  portions: { type: [menuPortionSchema], default: undefined },
  // Explicitly false when an admin chose a single price for an item that would
  // otherwise default to plate pricing — keeps the backfill below from undoing it
  portioned: { type: Boolean, default: undefined },
}, { _id: false });

const DEFAULT_MOMO_PORTIONS = (fullPrice) => [
  { key: 'half', name: 'Half Plate', price: Math.round(fullPrice / 2 / 5) * 5 || Math.round(fullPrice / 2), stockFactor: 0.5 },
  { key: 'full', name: 'Full Plate', price: fullPrice, stockFactor: 1 },
];

const DEFAULT_MENU_ITEMS = [
  { key: 'regularChai', name: 'Regular Chai', price: 15, active: true, sortOrder: 0, isDefault: true },
  { key: 'specialChai', name: 'Special Chai', price: 25, active: true, sortOrder: 1, isDefault: true },
  { key: 'kulhadChai', name: 'Kulhad Chai', price: 20, active: true, sortOrder: 2, isDefault: true },
  { key: 'vegMomo', name: 'Veg Momo', price: 40, active: true, sortOrder: 3, isDefault: true, portions: DEFAULT_MOMO_PORTIONS(40) },
  { key: 'paneerMomo', name: 'Paneer Momo', price: 60, active: true, sortOrder: 4, isDefault: true, portions: DEFAULT_MOMO_PORTIONS(60) },
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
  // Supply pricing & units
  milkCostPerPacket: { type: Number, default: 30 },
  milkMlPerPacket: { type: Number, default: 500 },
  // Momos are counted in pieces but sold by the plate; reports store
  // plate-equivalents, so this converts staff-entered piece counts.
  momoPiecesPerPlate: { type: Number, default: 10 },
  // Menu & pricing
  menuItems: { type: [menuItemSchema], default: DEFAULT_MENU_ITEMS },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedByName: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('StallConfig', stallConfigSchema);
module.exports.DEFAULT_MENU_ITEMS = DEFAULT_MENU_ITEMS;
module.exports.DEFAULT_MOMO_PORTIONS = DEFAULT_MOMO_PORTIONS;

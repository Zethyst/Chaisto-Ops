const mongoose = require('mongoose');

// ─── Stall ────────────────────────────────────────────────────────────────────
const stallSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    address: String,
  },
  staffIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  moderatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isActive: { type: Boolean, default: true },
  allowedRadiusMeters: { type: Number, default: 200 },
}, { timestamps: true });

const Stall = mongoose.model('Stall', stallSchema);

// ─── Inventory Item ──────────────────────────────────────────────────────────
const inventoryItemSchema = new mongoose.Schema({
  stallId: { type: mongoose.Schema.Types.ObjectId, ref: 'Stall', required: true },
  name: { type: String, required: true },
  unit: { type: String, required: true }, // litres, kg, grams, count, ₹
  currentStock: { type: Number, default: 0, min: 0 },
  minThreshold: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

const InventoryItem = mongoose.model('InventoryItem', inventoryItemSchema);

// ─── Inventory Transaction ───────────────────────────────────────────────────
const inventoryTransactionSchema = new mongoose.Schema({
  stallId: { type: mongoose.Schema.Types.ObjectId, ref: 'Stall', required: true },
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true },
  type: { type: String, enum: ['supply', 'usage', 'adjustment'], required: true },
  quantity: { type: Number, required: true },
  notes: String,
  reportId: { type: mongoose.Schema.Types.ObjectId, ref: 'Report' }, // linked to daily report
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

inventoryTransactionSchema.index({ stallId: 1, createdAt: -1 });

const InventoryTransaction = mongoose.model('InventoryTransaction', inventoryTransactionSchema);

module.exports = { Stall, InventoryItem, InventoryTransaction };

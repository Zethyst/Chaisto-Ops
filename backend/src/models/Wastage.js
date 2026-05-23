const mongoose = require('mongoose');

const wastageItemSchema = new mongoose.Schema({
  item: { type: String, enum: ['milk', 'sugar', 'teaLeaves', 'cups', 'other'], required: true },
  quantity: { type: Number, required: true, min: 0 },
  unit: { type: String, required: true }, // litres, kg, grams, count
  reason: { type: String, enum: ['expired', 'spilled', 'unsold', 'damaged', 'other'], required: true },
}, { _id: false });

const wastageSchema = new mongoose.Schema({
  stallId: { type: mongoose.Schema.Types.ObjectId, ref: 'Stall', required: true },
  loggedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  loggedByName: { type: String, required: true },
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  items: { type: [wastageItemSchema], required: true },
  totalEstimatedLoss: { type: Number, default: 0 }, // in ₹, admin can fill
  notes: { type: String, trim: true, maxlength: 300 },
}, { timestamps: true });

wastageSchema.index({ stallId: 1, date: 1 });

module.exports = mongoose.model('Wastage', wastageSchema);

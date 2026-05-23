const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  stallId: { type: mongoose.Schema.Types.ObjectId, ref: 'Stall', required: true },
  loggedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  loggedByName: { type: String, required: true },
  category: {
    type: String,
    enum: ['gas', 'supplies', 'maintenance', 'equipment', 'other'],
    required: true,
  },
  amount: { type: Number, required: true, min: 1 },
  description: { type: String, trim: true, maxlength: 200 },
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ }, // YYYY-MM-DD
}, { timestamps: true });

expenseSchema.index({ stallId: 1, date: 1 });
expenseSchema.index({ loggedBy: 1, date: 1 });

module.exports = mongoose.model('Expense', expenseSchema);

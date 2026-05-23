const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String, required: true },
  stallId: { type: mongoose.Schema.Types.ObjectId, ref: 'Stall', required: true },
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  status: {
    type: String,
    enum: ['present', 'absent', 'halfday', 'leave'],
    required: true,
  },
  leaveType: {
    type: String,
    enum: ['sick', 'casual', 'unpaid', null],
    default: null,
  },
  notes: { type: String, trim: true, maxlength: 200 },
  markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  markedByName: { type: String, required: true },
}, { timestamps: true });

attendanceSchema.index({ userId: 1, date: 1 }, { unique: true });
attendanceSchema.index({ stallId: 1, date: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);

const mongoose = require('mongoose');

// An in-progress daily report. Kept out of the Report collection because a
// draft is partial by definition — Report requires photos, location and
// submittedAt, none of which exist until the staff finishes. The draft holds
// the whole partial report as an opaque blob so adding report fields needs no
// migration here; it is deleted once the real report is submitted.
const reportDraftSchema = new mongoose.Schema({
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  stallId: { type: mongoose.Schema.Types.ObjectId, ref: 'Stall' },
  date: { type: String, required: true }, // YYYY-MM-DD
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

reportDraftSchema.index({ staffId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('ReportDraft', reportDraftSchema);

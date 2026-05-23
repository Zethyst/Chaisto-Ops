const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  actorName: { type: String, required: true },
  actorRole: { type: String, required: true },
  action: {
    type: String,
    enum: [
      'user_created', 'user_disabled', 'user_enabled', 'user_password_reset',
      'device_reset', 'report_reviewed', 'report_flagged', 'report_cleared',
      'config_changed', 'attendance_marked', 'expense_deleted',
      'stall_created', 'stall_updated', 'inventory_updated',
    ],
    required: true,
  },
  entity: { type: String }, // 'User', 'Report', 'Stall', 'StallConfig', etc.
  entityId: { type: String },
  details: { type: mongoose.Schema.Types.Mixed }, // free-form extra info
  ip: { type: String },
}, { timestamps: true });

auditLogSchema.index({ actorId: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);

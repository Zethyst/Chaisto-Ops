const mongoose = require('mongoose');

// A UPI payment that arrived on a staff member's phone, as read from the
// payment app's own notification on the device.
//
// This exists to answer one question: did money collected during the shift make
// it onto the day's report? The device sends only notifications it has already
// matched as a payment credit from a payment app, so a row here is always about
// a payment and never about anything else on the phone.
const paymentCaptureSchema = new mongoose.Schema({
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  staffName: String,
  stallId: { type: mongoose.Schema.Types.ObjectId, ref: 'Stall' },
  date: { type: String, required: true }, // YYYY-MM-DD, the stall's local day

  app: { type: String, required: true },  // the payment app's package name
  amount: { type: Number, required: true, min: 0 },
  title: String,
  text: String,

  capturedAt: { type: Date, required: true }, // when the phone saw it
  deviceId: String,

  // The device's own id for the notification. Unique per staff member, so a
  // capture re-sent after a failed sync is stored once.
  fingerprint: { type: String, required: true },
}, { timestamps: true });

paymentCaptureSchema.index({ staffId: 1, fingerprint: 1 }, { unique: true });
paymentCaptureSchema.index({ date: 1, staffId: 1 });
paymentCaptureSchema.index({ stallId: 1, date: 1 });

module.exports = mongoose.model('PaymentCapture', paymentCaptureSchema);

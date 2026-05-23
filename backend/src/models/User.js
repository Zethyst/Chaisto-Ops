const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, unique: true, match: /^\d{10}$/ },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['admin', 'moderator', 'staff'], required: true },
  stallId: { type: mongoose.Schema.Types.ObjectId, ref: 'Stall' },
  stallName: String,
  deviceId: { type: String, default: null },
  deviceName: { type: String, default: null },
  fcmToken: String, // for push notifications
  isActive: { type: Boolean, default: true },
  loginAttempts: { type: Number, default: 0 },
  lockUntil: Date,
  lastLogin: Date,
  lastLoginDevice: String,
  lastLoginIp: String,
  profilePhoto: String,
  monthlySalary: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
  this.password = await bcrypt.hash(this.password, rounds);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Account lock check
userSchema.virtual('isLocked').get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Increment login attempts, lock after MAX_ATTEMPTS
userSchema.methods.incLoginAttempts = async function () {
  const MAX = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
  const LOCK_MS = (parseInt(process.env.LOCK_TIME_MINUTES) || 15) * 60 * 1000;

  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({ $set: { loginAttempts: 1 }, $unset: { lockUntil: 1 } });
  }
  const updates = { $inc: { loginAttempts: 1 } };
  if (this.loginAttempts + 1 >= MAX && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + LOCK_MS };
  }
  return this.updateOne(updates);
};

// Remove sensitive fields from JSON output
userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  obj.id = obj._id.toString();
  delete obj.password;
  delete obj.loginAttempts;
  delete obj.lockUntil;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('User', userSchema);

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const reportRoutes = require('./routes/reports');
const userRoutes = require('./routes/users');
const stallRoutes = require('./routes/stalls');
const { scheduleJobs } = require('./services/scheduledJobs');

const app = express();
const PORT = process.env.PORT || 5000;

// Render, Fly, etc. sit behind a reverse proxy and send X-Forwarded-For. Required for
// express-rate-limit to trust req.ip; see ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.
if (process.env.TRUST_PROXY === 'false') {
  app.set('trust proxy', false);
} else {
  const n = Number(process.env.TRUST_PROXY);
  app.set('trust proxy', Number.isFinite(n) && n >= 0 ? n : 1);
}

// ─── Health check (before rate limit — platform probes + cheap sanity checks) ─
function healthPayload() {
  return {
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
  };
}
app.get('/health', (req, res) => res.json(healthPayload()));
app.get('/v1/health', (req, res) => res.json(healthPayload()));

// ─── Security Middleware ──────────────────────────────────────────────────────
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://chaisto-ops.com'] // Restrict in production
    : '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-device-id'],
}));

// Global rate limit: 100 requests per 15 min per IP
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests. Please slow down.' },
}));

app.use(express.json({ limit: '5mb' })); // generous for photo metadata
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/v1/auth', authRoutes);
app.use('/v1/reports', reportRoutes);
app.use('/v1/users', userRoutes);
app.use('/v1/stalls', stallRoutes);

app.use('/v1/inventory', require('./routes/inventory'));
app.use('/v1/notifications', require('./routes/notifications'));
app.use('/v1/expenses', require('./routes/expenses'));
app.use('/v1/wastage', require('./routes/wastage'));
app.use('/v1/attendance', require('./routes/attendance'));
app.use('/v1/payroll', require('./routes/payroll'));
app.use('/v1/audit-logs', require('./routes/auditLogs'));
app.use('/v1/stall-config', require('./routes/stallConfig'));
app.use('/v1/ai', require('./routes/ai'));

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use('*', (req, res) =>
  res.status(404).json({ error: `Route ${req.originalUrl} not found` })
);

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message, err.stack?.split('\n')[1]);
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ error: 'Invalid ID format' });
  }
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// ─── MongoDB + Server Start ───────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 10000,
}).then(() => {
  console.log('✅ MongoDB connected');
  // Bind all IPv4 interfaces so phones on the LAN can reach you via http://<your-ip>:PORT
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 ChaistoOps API running on port ${PORT}`);
    console.log(`   Environment: ${process.env.NODE_ENV}`);
    scheduleJobs();
  });
}).catch(err => {
  console.error('❌ MongoDB connection failed:', err.message);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received — shutting down gracefully');
  await mongoose.connection.close();
  process.exit(0);
});

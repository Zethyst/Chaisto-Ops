const admin = require('firebase-admin');
const User = require('../models/User');
const Notification = require('../models/Notification');

let firebaseApp;
try {
  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
} catch (err) {
  if (err.code !== 'app/duplicate-app') console.error('Firebase init error:', err.message);
}

const messaging = admin.messaging();

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function pushToToken(token, title, body, data = {}) {
  if (!token) return;
  try {
    await messaging.send({
      token,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      android: { priority: 'high', notification: { sound: 'default', channelId: 'chaisto-ops-default' } },
      apns: { payload: { aps: { sound: 'default', badge: 1 } } },
    });
  } catch (err) {
    if (!err.message?.includes('registration-token-not-registered')) {
      console.error('FCM push error:', err.message);
    }
  }
}

async function saveAndPushToUser(userId, type, title, body, data = {}) {
  try {
    await Notification.create({ userId, type, title, message: body, data, read: false });
    const user = await User.findById(userId).select('fcmToken');
    if (user?.fcmToken) await pushToToken(user.fcmToken, title, body, data);
  } catch (err) {
    console.error('saveAndPushToUser error:', err.message);
  }
}

async function saveAndPushToRole(role, type, title, body, data = {}) {
  try {
    const users = await User.find({ role, isActive: true }).select('_id fcmToken');
    await Promise.all(users.map((u) =>
      Notification.create({ userId: u._id, type, title, message: body, data, read: false })
    ));

    const tokens = users.map((u) => u.fcmToken).filter(Boolean);
    if (!tokens.length) return;

    const BATCH = 500;
    for (let i = 0; i < tokens.length; i += BATCH) {
      try {
        await messaging.sendEachForMulticast({
          tokens: tokens.slice(i, i + BATCH),
          notification: { title, body },
          data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
          android: { priority: 'high' },
        });
      } catch (err) {
        console.error('FCM multicast error:', err.message);
      }
    }
  } catch (err) {
    console.error('saveAndPushToRole error:', err.message);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

const notificationService = {
  notifyAdminReportSubmitted: async (report, staffName) => {
    const cups = (report.sales?.regularCups || 0) + (report.sales?.specialCups || 0);
    const title = '📋 Report Submitted';
    const body = `${staffName} submitted today's report — ${cups} cups, ₹${Math.round(report.computed?.totalRevenue || 0)}`;
    const data = { type: 'report_submitted', reportId: report._id.toString() };
    await saveAndPushToRole('admin', 'report_submitted', title, body, data);
    await saveAndPushToRole('moderator', 'report_submitted', title, body, data);
  },

  notifyAdminSuspiciousActivity: async (report) => {
    const highFlags = (report.flags || []).filter((f) => f.severity === 'high');
    if (!highFlags.length) return;
    const title = '🚨 Suspicious Activity Detected';
    const body = `${report.staffName}: ${highFlags[0].message}`;
    const data = { type: 'suspicious_activity', reportId: report._id.toString(), severity: 'high' };
    await saveAndPushToRole('admin', 'suspicious_activity', title, body, data);
  },

  notifyAdminMissingReport: async (staffName, stallName) => {
    const title = '⏰ Missing Report Alert';
    const body = `${staffName} at ${stallName} has not submitted today's report`;
    await saveAndPushToRole('admin', 'missing_report', title, body, {});
  },

  remindStaffReport: async (userId) => {
    await saveAndPushToUser(
      userId,
      'reminder',
      '⏰ Daily Report Reminder',
      "Don't forget to submit your closing report before 11 PM tonight",
      { type: 'reminder' }
    );
  },

  notifyStaffLowStock: async (userId, itemName, currentStock, unit) => {
    await saveAndPushToUser(
      userId,
      'low_stock',
      '📦 Low Stock Alert',
      `${itemName} is running low — only ${currentStock} ${unit} remaining. Inform your moderator.`,
      { type: 'low_stock' }
    );
  },
};

module.exports = notificationService;

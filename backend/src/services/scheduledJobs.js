const cron = require('node-cron');
const User = require('../models/User');
const Report = require('../models/Report');
const notificationService = require('./notificationService');

const scheduleJobs = () => {
  // ─── 9 PM: Remind staff who haven't submitted yet ────────────────────────
  cron.schedule('0 21 * * *', async () => {
    console.log('[CRON] Running 9PM report reminder...');
    try {
      const today = new Date().toISOString().split('T')[0];
      const staffUsers = await User.find({ role: 'staff', isActive: true });

      for (const user of staffUsers) {
        const submitted = await Report.findOne({ staffId: user._id, date: today });
        if (!submitted) {
          await notificationService.remindStaffReport(user._id);
          console.log(`[CRON] Reminded: ${user.name}`);
        }
      }
    } catch (err) {
      console.error('[CRON] Reminder error:', err.message);
    }
  }, { timezone: 'Asia/Kolkata' });

  // ─── 11:30 PM: Alert admin about missing reports ─────────────────────────
  cron.schedule('30 23 * * *', async () => {
    console.log('[CRON] Checking for missing reports...');
    try {
      const today = new Date().toISOString().split('T')[0];
      const staffUsers = await User.find({ role: 'staff', isActive: true }).populate('stallId', 'name');

      for (const user of staffUsers) {
        const submitted = await Report.findOne({ staffId: user._id, date: today });
        if (!submitted) {
          const stallName = user.stallId?.name || 'Unknown Stall';
          await notificationService.notifyAdminMissingReport(user.name, stallName);
          console.log(`[CRON] Missing report alert: ${user.name} at ${stallName}`);
        }
      }
    } catch (err) {
      console.error('[CRON] Missing report check error:', err.message);
    }
  }, { timezone: 'Asia/Kolkata' });

  // ─── 8 AM: Daily summary push to admin ───────────────────────────────────
  cron.schedule('0 8 * * *', async () => {
    console.log('[CRON] Sending daily morning summary...');
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];

      const [reports] = await Report.aggregate([
        { $match: { date: dateStr } },
        {
          $group: {
            _id: null,
            totalCups: { $sum: { $add: ['$sales.regularCups', '$sales.specialCups'] } },
            totalMomoPackets: { $sum: { $add: ['$sales.vegMomoPackets', '$sales.paneerMomoPackets'] } },
            totalRevenue: { $sum: '$computed.totalRevenue' },
            flagCount: { $sum: { $cond: [{ $gt: [{ $size: '$flags' }, 0] }, 1, 0] } },
          },
        },
      ]);

      if (reports) {
        const { notificationService: ns } = require('./notificationService');
        // Custom summary notification would go here
        console.log(`[CRON] Yesterday summary: ${reports.totalCups} cups, ${reports.totalMomoPackets} momo packets, ₹${Math.round(reports.totalRevenue)}, ${reports.flagCount} flags`);
      }
    } catch (err) {
      console.error('[CRON] Morning summary error:', err.message);
    }
  }, { timezone: 'Asia/Kolkata' });

  console.log('[CRON] All scheduled jobs registered (IST timezone)');
};

module.exports = { scheduleJobs };

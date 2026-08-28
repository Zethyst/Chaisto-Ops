const express = require('express');
const mongoose = require('mongoose');
const Report = require('../models/Report');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const { allRoles, adminOrModerator } = require('../middleware/auth');

const router = express.Router();

// GET /v1/payroll/me — current staff's own monthly payroll breakdown
router.get('/me', ...allRoles, async (req, res) => {
  const { month } = req.query; // YYYY-MM
  if (!month) return res.status(400).json({ error: 'month (YYYY-MM) required' });

  try {
    const user = await User.findById(req.user._id).select('monthlySalary name stallId');

    const [cupAgg] = await Report.aggregate([
      {
        $match: {
          staffId: req.user._id,
          date: { $gte: `${month}-01`, $lte: `${month}-31` },
          status: { $in: ['submitted', 'reviewed', 'flagged'] },
        },
      },
      {
        $group: {
          _id: null,
          totalCups: { $sum: { $add: ['$sales.regularCups', '$sales.specialCups'] } },
          totalMomoPackets: { $sum: { $add: ['$sales.vegMomoPackets', '$sales.paneerMomoPackets'] } },
          totalRevenue: { $sum: '$computed.totalRevenue' },
          reportCount: { $sum: 1 },
        },
      },
    ]);

    const attendance = await Attendance.find({
      userId: req.user._id,
      date: { $gte: `${month}-01`, $lte: `${month}-31` },
    });

    const presentDays = attendance.filter((a) => a.status === 'present').length;
    const halfdayDays = attendance.filter((a) => a.status === 'halfday').length;
    const leaveDays = attendance.filter((a) => a.status === 'leave').length;
    const absentDays = attendance.filter((a) => a.status === 'absent').length;

    const baseSalary = user?.monthlySalary || 0;
    const totalCups = cupAgg?.totalCups || 0;
    const cupsIncentive = totalCups * 1; // ₹1 per cup
    const totalMomoPackets = cupAgg?.totalMomoPackets || 0;
    const momoIncentive = totalMomoPackets * 5; // ₹5 per momo packet

    res.json({
      staffId: req.user._id,
      staffName: req.user.name,
      month,
      baseSalary,
      totalCups,
      cupsIncentive,
      totalMomoPackets,
      momoIncentive,
      totalRevenue: cupAgg?.totalRevenue || 0,
      reportCount: cupAgg?.reportCount || 0,
      totalPay: baseSalary + cupsIncentive + momoIncentive,
      attendance: { presentDays, halfdayDays, leaveDays, absentDays },
    });
  } catch (err) {
    console.error('Payroll/me error:', err);
    res.status(500).json({ error: 'Could not fetch payroll' });
  }
});

// GET /v1/payroll — all staff payroll for a month (admin/mod)
router.get('/', ...adminOrModerator, async (req, res) => {
  const { month, stallId } = req.query;
  if (!month) return res.status(400).json({ error: 'month (YYYY-MM) required' });

  try {
    const staffFilter = { role: 'staff', isActive: true };
    if (stallId) staffFilter.stallId = mongoose.Types.ObjectId(stallId);

    const staffList = await User.find(staffFilter).select('name stallId stallName monthlySalary');

    const cupAggs = await Report.aggregate([
      {
        $match: {
          date: { $gte: `${month}-01`, $lte: `${month}-31` },
          status: { $in: ['submitted', 'reviewed', 'flagged'] },
          ...(stallId ? { stallId: mongoose.Types.ObjectId(stallId) } : {}),
        },
      },
      {
        $group: {
          _id: '$staffId',
          totalCups: { $sum: { $add: ['$sales.regularCups', '$sales.specialCups'] } },
          totalMomoPackets: { $sum: { $add: ['$sales.vegMomoPackets', '$sales.paneerMomoPackets'] } },
          totalRevenue: { $sum: '$computed.totalRevenue' },
          reportCount: { $sum: 1 },
        },
      },
    ]);

    const cupsMap = {};
    cupAggs.forEach((a) => { cupsMap[a._id.toString()] = a; });

    const payroll = staffList.map((s) => {
      const data = cupsMap[s._id.toString()] || { totalCups: 0, totalMomoPackets: 0, totalRevenue: 0, reportCount: 0 };
      const baseSalary = s.monthlySalary || 0;
      const cupsIncentive = data.totalCups * 1;
      const momoIncentive = (data.totalMomoPackets || 0) * 5;
      return {
        staffId: s._id,
        staffName: s.name,
        stallName: s.stallName,
        baseSalary,
        totalCups: data.totalCups,
        cupsIncentive,
        totalMomoPackets: data.totalMomoPackets || 0,
        momoIncentive,
        totalRevenue: data.totalRevenue,
        reportCount: data.reportCount,
        totalPay: baseSalary + cupsIncentive + momoIncentive,
      };
    });

    payroll.sort((a, b) => b.totalCups - a.totalCups);
    res.json(payroll);
  } catch (err) {
    console.error('Payroll error:', err);
    res.status(500).json({ error: 'Could not fetch payroll' });
  }
});

// PATCH /v1/payroll/salary/:userId — set base salary (admin only)
router.patch('/salary/:userId', async (req, res) => {
  // inline auth to avoid circular import issues
  const jwt = require('jsonwebtoken');
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
  const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
  const actor = await User.findById(decoded.userId);
  if (!actor || actor.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

  try {
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { monthlySalary: req.body.monthlySalary },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: user._id, name: user.name, monthlySalary: user.monthlySalary });
  } catch {
    res.status(500).json({ error: 'Could not update salary' });
  }
});

module.exports = router;

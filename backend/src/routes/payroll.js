const express = require('express');
const mongoose = require('mongoose');
const Report = require('../models/Report');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const StallConfig = require('../models/StallConfig');
const { allRoles, adminOrModerator } = require('../middleware/auth');

const router = express.Router();

const DEFAULT_CUPS_INCENTIVE = 1;
const DEFAULT_MOMO_INCENTIVE = 5;
const DEFAULT_MOMO_PIECES_PER_PLATE = 10;

// GET /v1/payroll/me — current staff's own monthly payroll breakdown
router.get('/me', ...allRoles, async (req, res) => {
  const { month } = req.query; // YYYY-MM
  if (!month) return res.status(400).json({ error: 'month (YYYY-MM) required' });

  try {
    const user = await User.findById(req.user._id).select('monthlySalary name stallId');
    const stallConfig = user?.stallId ? await StallConfig.findOne({ stallId: user.stallId }) : null;
    const cupRate = stallConfig?.cupsIncentivePerCup ?? DEFAULT_CUPS_INCENTIVE;
    const momoRate = stallConfig?.momoIncentivePerPacket ?? DEFAULT_MOMO_INCENTIVE;
    // Reports store momos as plate-equivalents; staff count them in pieces
    const piecesPerPlate = stallConfig?.momoPiecesPerPlate ?? DEFAULT_MOMO_PIECES_PER_PLATE;

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
    const cupsIncentive = totalCups * cupRate;
    const totalMomoPackets = cupAgg?.totalMomoPackets || 0;
    const momoIncentive = totalMomoPackets * momoRate;

    res.json({
      staffId: req.user._id,
      staffName: req.user.name,
      month,
      baseSalary,
      totalCups,
      cupsIncentive,
      cupRate,
      // `totalMomoPackets` is plate-equivalents and can be fractional; pieces
      // is what the staff actually counted and is what the app displays
      totalMomoPackets,
      totalMomoPlates: totalMomoPackets,
      totalMomoPieces: Math.round(totalMomoPackets * piecesPerPlate),
      momoPiecesPerPlate: piecesPerPlate,
      momoIncentive,
      momoRate,
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

    const stallIds = [...new Set(staffList.map((s) => s.stallId?.toString()).filter(Boolean))];
    const stallConfigs = await StallConfig.find({ stallId: { $in: stallIds } });
    const configMap = {};
    stallConfigs.forEach((c) => { configMap[c.stallId.toString()] = c; });
    const ratesFor = (staffStallId) => {
      const c = staffStallId ? configMap[staffStallId.toString()] : null;
      return {
        cupRate: c?.cupsIncentivePerCup ?? DEFAULT_CUPS_INCENTIVE,
        momoRate: c?.momoIncentivePerPacket ?? DEFAULT_MOMO_INCENTIVE,
        piecesPerPlate: c?.momoPiecesPerPlate ?? DEFAULT_MOMO_PIECES_PER_PLATE,
      };
    };

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
      const { cupRate, momoRate, piecesPerPlate } = ratesFor(s.stallId);
      const cupsIncentive = data.totalCups * cupRate;
      const momoIncentive = (data.totalMomoPackets || 0) * momoRate;
      return {
        staffId: s._id,
        staffName: s.name,
        stallName: s.stallName,
        baseSalary,
        totalCups: data.totalCups,
        cupsIncentive,
        cupRate,
        totalMomoPackets: data.totalMomoPackets || 0,
        totalMomoPlates: data.totalMomoPackets || 0,
        totalMomoPieces: Math.round((data.totalMomoPackets || 0) * piecesPerPlate),
        momoPiecesPerPlate: piecesPerPlate,
        momoIncentive,
        momoRate,
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

const express = require('express');
const { body, validationResult } = require('express-validator');
const StallConfig = require('../models/StallConfig');
const AuditLog = require('../models/AuditLog');
const { allRoles, adminOrModerator } = require('../middleware/auth');

const router = express.Router();

const DEFAULT_MENU_ITEMS = [
  { key: 'regularChai', name: 'Regular Chai', price: 15, active: true, sortOrder: 0, isDefault: true },
  { key: 'specialChai', name: 'Special Chai', price: 25, active: true, sortOrder: 1, isDefault: true },
  { key: 'kulhadChai', name: 'Kulhad Chai', price: 20, active: true, sortOrder: 2, isDefault: true },
  { key: 'vegMomo', name: 'Veg Momo', price: 40, active: true, sortOrder: 3, isDefault: true },
  { key: 'paneerMomo', name: 'Paneer Momo', price: 60, active: true, sortOrder: 4, isDefault: true },
];

// GET /v1/stall-config/:stallId
router.get('/:stallId', ...allRoles, async (req, res) => {
  try {
    let config = await StallConfig.findOne({ stallId: req.params.stallId });
    if (!config) {
      config = {
        stallId: req.params.stallId,
        milkMismatchThresholdPct: 15,
        upiMinRatioPct: 20,
        salesDropThresholdPct: 50,
        locationRadiusMeters: 200,
        missingReportAlertHour: 21,
        cupsIncentivePerCup: 1,
        momoIncentivePerPacket: 5,
        menuItems: DEFAULT_MENU_ITEMS,
      };
    } else {
      // Backfill momo menu items for stalls configured before momo sales were added
      const existingKeys = new Set(config.menuItems.map((i) => i.key));
      const missingDefaults = DEFAULT_MENU_ITEMS.filter((d) => !existingKeys.has(d.key));
      if (missingDefaults.length > 0) {
        config.menuItems.push(...missingDefaults);
        await config.save();
      }
    }
    res.json(config);
  } catch {
    res.status(500).json({ error: 'Could not fetch stall config' });
  }
});

// PATCH /v1/stall-config/:stallId — upsert config (admin/mod)
router.patch('/:stallId', ...adminOrModerator, [
  body('milkMismatchThresholdPct').optional().isFloat({ min: 5, max: 50 }),
  body('upiMinRatioPct').optional().isFloat({ min: 0, max: 100 }),
  body('salesDropThresholdPct').optional().isFloat({ min: 10, max: 90 }),
  body('locationRadiusMeters').optional().isInt({ min: 50, max: 2000 }),
  body('missingReportAlertHour').optional().isInt({ min: 17, max: 23 }),
  body('cupsIncentivePerCup').optional().isFloat({ min: 0, max: 10 }),
  body('momoIncentivePerPacket').optional().isFloat({ min: 0, max: 20 }),
  body('menuItems').optional().isArray(),
  body('menuItems.*.key').optional().isString(),
  body('menuItems.*.name').optional().isString().trim().isLength({ min: 1, max: 50 }),
  body('menuItems.*.price').optional().isFloat({ min: 0, max: 10000 }),
  body('menuItems.*.active').optional().isBoolean(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const prev = await StallConfig.findOne({ stallId: req.params.stallId });

    const config = await StallConfig.findOneAndUpdate(
      { stallId: req.params.stallId },
      {
        ...req.body,
        updatedBy: req.user._id,
        updatedByName: req.user.name,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await AuditLog.create({
      actorId: req.user._id,
      actorName: req.user.name,
      actorRole: req.user.role,
      action: 'config_changed',
      entity: 'StallConfig',
      entityId: req.params.stallId,
      details: { previous: prev?.toObject() || {}, updated: req.body },
      ip: req.ip,
    });

    res.json(config);
  } catch (err) {
    res.status(500).json({ error: 'Could not update stall config' });
  }
});

module.exports = router;

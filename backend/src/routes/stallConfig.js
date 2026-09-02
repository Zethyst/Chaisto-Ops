const express = require('express');
const { body, validationResult } = require('express-validator');
const StallConfig = require('../models/StallConfig');
const AuditLog = require('../models/AuditLog');
const { allRoles, adminOrModerator } = require('../middleware/auth');

const router = express.Router();

const { DEFAULT_MENU_ITEMS, DEFAULT_MOMO_PORTIONS } = StallConfig;

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
        milkCostPerPacket: 30,
        milkMlPerPacket: 500,
        momoPiecesPerPlate: 10,
        menuItems: DEFAULT_MENU_ITEMS,
      };
    } else {
      let dirty = false;
      // Backfill momo menu items for stalls configured before momo sales were added
      const existingKeys = new Set(config.menuItems.map((i) => i.key));
      const missingDefaults = DEFAULT_MENU_ITEMS.filter((d) => !existingKeys.has(d.key));
      if (missingDefaults.length > 0) {
        config.menuItems.push(...missingDefaults);
        dirty = true;
      }
      // Backfill half/full plate portions for momo items priced before plates
      // existed — but never for an item an admin set to a single price
      config.menuItems.forEach((item) => {
        if (['vegMomo', 'paneerMomo'].includes(item.key)
          && item.portioned !== false
          && !item.portions?.length) {
          item.portions = DEFAULT_MOMO_PORTIONS(item.price);
          dirty = true;
        }
      });
      if (dirty) {
        config.markModified('menuItems');
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
  body('milkCostPerPacket').optional().isFloat({ min: 0, max: 1000 }),
  body('milkMlPerPacket').optional().isFloat({ min: 50, max: 5000 }),
  body('momoPiecesPerPlate').optional().isFloat({ min: 1, max: 100 }),
  body('menuItems').optional().isArray(),
  body('menuItems.*.key').optional().isString(),
  body('menuItems.*.name').optional().isString().trim().isLength({ min: 1, max: 50 }),
  body('menuItems.*.price').optional().isFloat({ min: 0, max: 10000 }),
  body('menuItems.*.active').optional().isBoolean(),
  body('menuItems.*.portioned').optional().isBoolean(),
  body('menuItems.*.portions').optional().isArray({ max: 6 }),
  body('menuItems.*.portions.*.key').optional().isString().trim().isLength({ min: 1, max: 20 }),
  body('menuItems.*.portions.*.name').optional().isString().trim().isLength({ min: 1, max: 30 }),
  body('menuItems.*.portions.*.price').optional().isFloat({ min: 0, max: 10000 }),
  body('menuItems.*.portions.*.stockFactor').optional().isFloat({ min: 0, max: 100 }),
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

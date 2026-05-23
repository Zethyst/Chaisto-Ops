const express = require('express');
const { Stall } = require('../models/Stall');
const { adminOrModerator } = require('../middleware/auth');

const router = express.Router();

// GET /v1/stalls — list active stalls
router.get('/', ...adminOrModerator, async (req, res) => {
  try {
    const stalls = await Stall.find({ isActive: true }).select('name location');
    res.json(stalls.map((s) => ({
      id: s._id,
      name: s.name,
      address: s.location?.address,
      latitude: s.location?.latitude,
      longitude: s.location?.longitude,
    })));
  } catch {
    res.status(500).json({ error: 'Could not fetch stalls' });
  }
});

module.exports = router;

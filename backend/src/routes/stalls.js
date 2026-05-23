const express = require('express');
const { Stall } = require('../models/Stall');
const { adminOrModerator, adminOnly } = require('../middleware/auth');

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

// POST /v1/stalls — create a stall (admin only)
router.post('/', ...adminOnly, async (req, res) => {
  try {
    const { name, latitude, longitude, address, allowedRadiusMeters } = req.body;
    if (!name || latitude == null || longitude == null) {
      return res.status(400).json({ error: 'name, latitude, and longitude are required' });
    }
    const stall = await Stall.create({
      name,
      location: { latitude: Number(latitude), longitude: Number(longitude), address },
      allowedRadiusMeters: allowedRadiusMeters ?? 200,
    });
    res.status(201).json({ id: stall._id, name: stall.name, latitude, longitude, address });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /v1/stalls/:id — update stall location/name (admin only)
router.patch('/:id', ...adminOnly, async (req, res) => {
  try {
    const { name, latitude, longitude, address, allowedRadiusMeters, isActive } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (isActive != null) updates.isActive = isActive;
    if (allowedRadiusMeters != null) updates.allowedRadiusMeters = allowedRadiusMeters;
    if (latitude != null || longitude != null || address != null) {
      const stall = await Stall.findById(req.params.id);
      if (!stall) return res.status(404).json({ error: 'Stall not found' });
      updates['location.latitude'] = latitude ?? stall.location?.latitude;
      updates['location.longitude'] = longitude ?? stall.location?.longitude;
      updates['location.address'] = address ?? stall.location?.address;
    }
    const stall = await Stall.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });
    if (!stall) return res.status(404).json({ error: 'Stall not found' });
    res.json({ id: stall._id, name: stall.name, latitude: stall.location?.latitude, longitude: stall.location?.longitude, address: stall.location?.address });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

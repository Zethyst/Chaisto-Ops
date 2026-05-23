require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const { Stall } = require('../models/Stall');

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // ─── Create default stall ────────────────────────────────────────────────
  let stall = await Stall.findOne({ name: 'Chaisto Civil Lines' });
  if (!stall) {
    stall = await Stall.create({
      name: 'Chaisto Civil Lines',
      location: {
        latitude: 25.4673,
        longitude: 81.8457,
        address: 'Civil Lines, Prayagraj, UP 211001',
      },
      allowedRadiusMeters: 200,
    });
    console.log('✅ Stall created:', stall.name);
  } else {
    console.log('ℹ️  Stall already exists:', stall.name);
  }

  // ─── Create admin account ────────────────────────────────────────────────
  const adminPhone = process.env.ADMIN_PHONE || '8318876136';
  let admin = await User.findOne({ phone: adminPhone });

  if (!admin) {
    admin = await User.create({
      name: process.env.ADMIN_NAME || 'Chaisto Admin',
      phone: adminPhone,
      password: process.env.ADMIN_DEFAULT_PASSWORD || 'Chaisto@Admin2024',
      role: 'admin',
      isActive: true,
    });
    console.log('\n🎉 Admin account created!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  Phone:    +91 ${adminPhone}`);
    console.log(`  Password: ${process.env.ADMIN_DEFAULT_PASSWORD || 'Chaisto@Admin2024'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  CHANGE THIS PASSWORD IMMEDIATELY after first login!\n');
  } else {
    console.log('ℹ️  Admin account already exists:', adminPhone);
  }

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});

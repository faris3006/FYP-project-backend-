const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
require('dotenv').config();

async function createAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL || 'mankulim625@gmail.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'MamuKulim44@';
  const adminName = process.env.ADMIN_NAME || 'Admin User';
  const adminPhone = process.env.ADMIN_PHONE || '0000000000';

  if (!adminEmail || !adminPassword) {
    console.error('ADMIN_EMAIL and ADMIN_PASSWORD must be provided.');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.DB_URI);
    console.log('Connected to database');

    const existingAdmin = await User.findOne({ email: adminEmail });
    if (existingAdmin) {
      console.log('Admin user already exists');
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    const adminUser = new User({
      name: adminName,
      phone: adminPhone,
      email: adminEmail,
      password: hashedPassword,
      role: 'admin',
      isVerified: true,
    });

    await adminUser.save();
    console.log(`Admin user created for ${adminEmail}`);
    process.exit(0);
  } catch (err) {
    console.error('Error creating admin user:', err);
    process.exit(1);
  }
}

createAdmin();

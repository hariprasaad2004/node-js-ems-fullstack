const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Missing MONGODB_URI in .env');
    process.exit(1);
  }

  await mongoose.connect(uri);

  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@company.com').toLowerCase();
  const adminName = process.env.ADMIN_NAME || 'Admin User';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';

  const employeeEmail = (process.env.EMPLOYEE_EMAIL || 'employee@company.com').toLowerCase();
  const employeeName = process.env.EMPLOYEE_NAME || 'Employee User';
  const employeePassword = process.env.EMPLOYEE_PASSWORD || 'Employee@123';

  const existingAdmin = await User.findOne({ email: adminEmail });
  if (existingAdmin) {
    console.log('Admin already exists:', adminEmail);
  } else {
    const adminHash = await bcrypt.hash(adminPassword, 10);
    await User.create({
      role: 'admin',
      name: adminName,
      email: adminEmail,
      passwordHash: adminHash,
      status: 'active'
    });
    console.log('Admin created:', adminEmail);
    console.log('Admin password:', adminPassword);
  }

  const existingEmployee = await User.findOne({ email: employeeEmail });
  if (existingEmployee) {
    console.log('Employee already exists:', employeeEmail);
  } else {
    const employeeHash = await bcrypt.hash(employeePassword, 10);
    await User.create({
      role: 'employee',
      name: employeeName,
      email: employeeEmail,
      passwordHash: employeeHash,
      status: 'active'
    });
    console.log('Employee created:', employeeEmail);
    console.log('Employee password:', employeePassword);
  }

  process.exit(0);
}

run().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});

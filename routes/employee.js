const express = require('express');
const path = require('path');
const User = require('../models/User');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

const toSafeEmployee = (user) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
  department: user.department || '',
  title: user.title || '',
  phone: user.phone || '',
  address: user.address || '',
  salary: user.salary || 0,
  status: user.status,
  createdAt: user.createdAt
});

router.get('/employee', requireAuth, requireRole('employee'), (req, res) => {
  return res.sendFile(path.join(__dirname, '..', 'views', 'employee.html'));
});

router.get('/api/employee/me', requireAuth, requireRole('employee'), async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    return res.json(toSafeEmployee(user));
  } catch (err) {
    return res.status(500).json({ message: 'Failed to load profile.' });
  }
});

router.put('/api/employee/me', requireAuth, requireRole('employee'), async (req, res) => {
  try {
    const { phone, address } = req.body;
    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (phone !== undefined) user.phone = phone;
    if (address !== undefined) user.address = address;

    await user.save();
    return res.json(toSafeEmployee(user));
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update profile.' });
  }
});

module.exports = router;

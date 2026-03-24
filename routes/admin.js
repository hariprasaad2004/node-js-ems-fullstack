const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
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

router.get('/admin', requireAuth, requireRole('admin'), (req, res) => {
  return res.sendFile(path.join(__dirname, '..', 'views', 'admin.html'));
});

router.get('/api/admin/employees', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const employees = await User.find({ role: 'employee' }).sort({ createdAt: -1 });
    return res.json(employees.map(toSafeEmployee));
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch employees.' });
  }
});

router.post('/api/admin/employees', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { name, email, password, department, title, phone, address, salary, status } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: 'Email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const employee = await User.create({
      role: 'employee',
      name,
      email: email.toLowerCase(),
      passwordHash,
      department,
      title,
      phone,
      address,
      salary: Number.isFinite(Number(salary)) ? Number(salary) : undefined,
      status: status || 'active'
    });

    return res.status(201).json(toSafeEmployee(employee));
  } catch (err) {
    return res.status(500).json({ message: 'Failed to create employee.' });
  }
});

router.put('/api/admin/employees/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password, department, title, phone, address, salary, status } = req.body;

    const employee = await User.findOne({ _id: id, role: 'employee' });
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found.' });
    }

    if (email && email.toLowerCase() !== employee.email) {
      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing && existing._id.toString() !== employee._id.toString()) {
        return res.status(409).json({ message: 'Email already exists.' });
      }
    }

    if (name) employee.name = name;
    if (email) employee.email = email.toLowerCase();
    if (department !== undefined) employee.department = department;
    if (title !== undefined) employee.title = title;
    if (phone !== undefined) employee.phone = phone;
    if (address !== undefined) employee.address = address;
    if (salary !== undefined) employee.salary = Number.isFinite(Number(salary)) ? Number(salary) : employee.salary;
    if (status) employee.status = status;
    if (password) employee.passwordHash = await bcrypt.hash(password, 10);

    await employee.save();
    return res.json(toSafeEmployee(employee));
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update employee.' });
  }
});

router.delete('/api/admin/employees/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const employee = await User.findOne({ _id: id, role: 'employee' });
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found.' });
    }

    await employee.deleteOne();
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to delete employee.' });
  }
});

module.exports = router;

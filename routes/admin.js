const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/LeaveRequest');
const Task = require('../models/Task');
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

const toSafeAttendance = (record) => ({
  id: record._id.toString(),
  date: record.dateKey,
  checkInAt: record.checkInAt,
  checkOutAt: record.checkOutAt,
  employee: record.employee
    ? {
        id: record.employee._id?.toString?.() || record.employee.toString(),
        name: record.employee.name,
        email: record.employee.email,
        department: record.employee.department || '',
        title: record.employee.title || ''
      }
    : null
});

const toSafeLeave = (leave) => ({
  id: leave._id.toString(),
  fromDate: leave.fromDate,
  toDate: leave.toDate,
  reason: leave.reason || '',
  status: leave.status,
  createdAt: leave.createdAt,
  employee: leave.employee
    ? {
        id: leave.employee._id?.toString?.() || leave.employee.toString(),
        name: leave.employee.name,
        email: leave.employee.email,
        department: leave.employee.department || ''
      }
    : null
});

const toSafeTask = (task) => ({
  id: task._id.toString(),
  details: task.details,
  status: task.status,
  createdAt: task.createdAt,
  employee: task.employee
    ? {
        id: task.employee._id?.toString?.() || task.employee.toString(),
        name: task.employee.name,
        email: task.employee.email,
        department: task.employee.department || ''
      }
    : null,
  assignedBy: task.assignedBy
    ? {
        id: task.assignedBy._id?.toString?.() || task.assignedBy.toString(),
        name: task.assignedBy.name,
        email: task.assignedBy.email
      }
    : null
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

router.get('/api/admin/attendance', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const records = await Attendance.find()
      .sort({ checkInAt: -1 })
      .limit(30)
      .populate('employee', 'name email department title');
    return res.json(records.map(toSafeAttendance));
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch attendance.' });
  }
});

router.get('/api/admin/leave', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const leaves = await LeaveRequest.find()
      .sort({ createdAt: -1 })
      .limit(30)
      .populate('employee', 'name email department');
    return res.json(leaves.map(toSafeLeave));
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch leave requests.' });
  }
});

router.patch('/api/admin/leave/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status.' });
    }

    const leave = await LeaveRequest.findById(id).populate('employee', 'name email department');
    if (!leave) {
      return res.status(404).json({ message: 'Leave request not found.' });
    }

    leave.status = status;
    leave.reviewedBy = req.session.userId;
    leave.reviewedAt = new Date();
    await leave.save();

    return res.json(toSafeLeave(leave));
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update leave request.' });
  }
});

router.get('/api/admin/tasks', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const tasks = await Task.find()
      .sort({ createdAt: -1 })
      .limit(30)
      .populate('employee', 'name email department')
      .populate('assignedBy', 'name email');
    return res.json(tasks.map(toSafeTask));
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch tasks.' });
  }
});

router.post('/api/admin/tasks', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { employeeId, details } = req.body;
    if (!employeeId || !details || !String(details).trim()) {
      return res.status(400).json({ message: 'Employee and task details are required.' });
    }

    const employee = await User.findOne({ _id: employeeId, role: 'employee' });
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found.' });
    }

    const task = await Task.create({
      employee: employee._id,
      assignedBy: req.session.userId,
      details: String(details).trim()
    });

    await task.populate('employee', 'name email department');
    await task.populate('assignedBy', 'name email');

    return res.status(201).json(toSafeTask(task));
  } catch (err) {
    return res.status(500).json({ message: 'Failed to assign task.' });
  }
});

module.exports = router;

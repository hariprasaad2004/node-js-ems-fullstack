const express = require('express');
const path = require('path');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/LeaveRequest');
const Task = require('../models/Task');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

const rootDir = path.join(__dirname, '..', '..');

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

const formatDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toSafeAttendance = (attendance) => ({
  id: attendance._id.toString(),
  date: attendance.dateKey,
  checkInAt: attendance.checkInAt,
  checkOutAt: attendance.checkOutAt
});

const toSafeLeave = (leave) => ({
  id: leave._id.toString(),
  fromDate: leave.fromDate,
  toDate: leave.toDate,
  reason: leave.reason || '',
  status: leave.status,
  createdAt: leave.createdAt
});

const toSafeTask = (task) => ({
  id: task._id.toString(),
  details: task.details,
  status: task.status,
  createdAt: task.createdAt,
  assignedBy: task.assignedBy
    ? {
        id: task.assignedBy._id?.toString?.() || task.assignedBy.toString(),
        name: task.assignedBy.name,
        email: task.assignedBy.email
      }
    : null
});

router.get('/employee', requireAuth, requireRole('employee'), (req, res) => {
  return res.sendFile(path.join(rootDir, 'frontend', 'views', 'employee.html'));
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

router.get('/api/employee/attendance', requireAuth, requireRole('employee'), async (req, res) => {
  try {
    const records = await Attendance.find({ employee: req.session.userId })
      .sort({ checkInAt: -1 })
      .limit(20);
    return res.json(records.map(toSafeAttendance));
  } catch (err) {
    return res.status(500).json({ message: 'Failed to load attendance.' });
  }
});

router.post('/api/employee/attendance/check-in', requireAuth, requireRole('employee'), async (req, res) => {
  try {
    const now = new Date();
    const dateKey = formatDateKey(now);
    const existing = await Attendance.findOne({ employee: req.session.userId, dateKey });
    if (existing) {
      if (!existing.checkOutAt) {
        return res.status(409).json({ message: 'Already checked in today.' });
      }
      return res.status(409).json({ message: 'Attendance already recorded for today.' });
    }

    const record = await Attendance.create({
      employee: req.session.userId,
      dateKey,
      checkInAt: now
    });

    return res.status(201).json(toSafeAttendance(record));
  } catch (err) {
    return res.status(500).json({ message: 'Failed to check in.' });
  }
});

router.post(
  '/api/employee/attendance/check-out',
  requireAuth,
  requireRole('employee'),
  async (req, res) => {
    try {
      const now = new Date();
      const dateKey = formatDateKey(now);
      const record = await Attendance.findOne({ employee: req.session.userId, dateKey });
      if (!record) {
        return res.status(400).json({ message: 'No check-in found for today.' });
      }
      if (record.checkOutAt) {
        return res.status(409).json({ message: 'Already checked out today.' });
      }

      record.checkOutAt = now;
      await record.save();
      return res.json(toSafeAttendance(record));
    } catch (err) {
      return res.status(500).json({ message: 'Failed to check out.' });
    }
  }
);

router.get('/api/employee/leave', requireAuth, requireRole('employee'), async (req, res) => {
  try {
    const leaves = await LeaveRequest.find({ employee: req.session.userId })
      .sort({ createdAt: -1 })
      .limit(20);
    return res.json(leaves.map(toSafeLeave));
  } catch (err) {
    return res.status(500).json({ message: 'Failed to load leave requests.' });
  }
});

router.post('/api/employee/leave', requireAuth, requireRole('employee'), async (req, res) => {
  try {
    const { fromDate, toDate, reason } = req.body;
    if (!fromDate || !toDate) {
      return res.status(400).json({ message: 'From and To dates are required.' });
    }

    const from = new Date(fromDate);
    const to = new Date(toDate);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return res.status(400).json({ message: 'Invalid date format.' });
    }
    if (from > to) {
      return res.status(400).json({ message: 'From date cannot be after To date.' });
    }

    const leave = await LeaveRequest.create({
      employee: req.session.userId,
      fromDate: from,
      toDate: to,
      reason: reason ? String(reason).trim() : ''
    });

    return res.status(201).json(toSafeLeave(leave));
  } catch (err) {
    return res.status(500).json({ message: 'Failed to submit leave request.' });
  }
});

router.get('/api/employee/tasks', requireAuth, requireRole('employee'), async (req, res) => {
  try {
    const tasks = await Task.find({ employee: req.session.userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('assignedBy', 'name email');
    return res.json(tasks.map(toSafeTask));
  } catch (err) {
    return res.status(500).json({ message: 'Failed to load tasks.' });
  }
});

module.exports = router;

const express = require('express');
const path = require('path');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/LeaveRequest');
const Task = require('../models/Task');
const { requireAuth, requireRole, getRoleSession } = require('../middleware/auth');

const router = express.Router();

const rootDir = path.join(__dirname, '..', '..');
const frontendIndex = path.join(rootDir, 'frontend', 'dist', 'index.html');

const toSafeEmployee = (user) => ({ // Sanitize employee data for API responses.
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
  department: user.department || '',
  title: user.title || '',
  phone: user.phone || '',
  address: user.address || '',
  salary: user.salary || 0,
  profileImage: user.profileImage || '',
  status: user.status,
  createdAt: user.createdAt
});

const formatDateKey = (date = new Date()) => { // Format a date into YYYY-MM-DD for attendance keys.
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toSafeAttendance = (attendance) => ({ // Sanitize attendance record for API responses.
  id: attendance._id.toString(),
  date: attendance.dateKey,
  checkInAt: attendance.checkInAt,
  checkOutAt: attendance.checkOutAt
});

const toSafeLeave = (leave) => ({ // Sanitize leave request for API responses.
  id: leave._id.toString(),
  fromDate: leave.fromDate,
  toDate: leave.toDate,
  category: leave.category || 'casual',
  reason: leave.reason || '',
  status: leave.status,
  createdAt: leave.createdAt,
  updatedAt: leave.updatedAt
});

const normalizeTaskStatus = (status) => (status === 'assigned' ? 'planning' : status); // Normalize task status to UI-friendly values.

const toSafeTask = (task) => ({ // Sanitize task records for API responses.
  id: task._id.toString(),
  details: task.details,
  status: normalizeTaskStatus(task.status),
  dueAt: task.dueAt || null,
  createdAt: task.createdAt,
  updatedAt: task.updatedAt,
  assignedBy: task.assignedBy
    ? {
        id: task.assignedBy._id?.toString?.() || task.assignedBy.toString(),
        name: task.assignedBy.name,
        email: task.assignedBy.email
      }
    : null
});

router.get('/employee', (req, res) => { // Serve the SPA for the employee route with role checks.
  const employeeSession = getRoleSession(req, 'employee');
  if (!employeeSession?.userId) {
    return res.redirect('/login');
  }
  return res.sendFile(frontendIndex);
});

router.get('/api/employee/me', requireAuth, requireRole('employee'), async (req, res) => { // Fetch employee profile.
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    return res.json(toSafeEmployee(user));
  } catch (err) {
    return res.status(500).json({ message: 'Failed to load profile.' });
  }
});

router.put('/api/employee/me', requireAuth, requireRole('employee'), async (req, res) => { // Update employee profile.
  try {
    const { phone, address } = req.body;
    const user = await User.findById(req.userId);
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

router.get('/api/employee/attendance', requireAuth, requireRole('employee'), async (req, res) => { // List attendance records.
  try {
    const records = await Attendance.find({ employee: req.userId })
      .sort({ checkInAt: -1 })
      .limit(20);
    return res.json(records.map(toSafeAttendance));
  } catch (err) {
    return res.status(500).json({ message: 'Failed to load attendance.' });
  }
});

router.post('/api/employee/attendance/check-in', requireAuth, requireRole('employee'), async (req, res) => { // Check in employee.
  try {
    const now = new Date();
    const dateKey = formatDateKey(now);
    const existing = await Attendance.findOne({ employee: req.userId, dateKey });
    if (existing) {
      const message = existing.checkOutAt
        ? 'Attendance already recorded for today.'
        : 'Already checked in today.';
      return res.status(200).json({ ...toSafeAttendance(existing), message });
    }

    const record = await Attendance.create({
      employee: req.userId,
      dateKey,
      checkInAt: now
    });

    return res.status(201).json(toSafeAttendance(record));
  } catch (err) {
    if (err && err.code === 11000) {
      const dateKey = formatDateKey();
      const existing = await Attendance.findOne({ employee: req.userId, dateKey });
      if (existing) {
        return res.status(200).json({
          ...toSafeAttendance(existing),
          message: 'Attendance already recorded for today.'
        });
      }
    }
    return res.status(500).json({ message: 'Failed to check in.' });
  }
});

router.post(
  '/api/employee/attendance/check-out',
  requireAuth,
  requireRole('employee'),
  async (req, res) => { // Check out employee.
    try {
      const now = new Date();
      const dateKey = formatDateKey(now);
      const record = await Attendance.findOne({ employee: req.userId, dateKey });
      if (!record) {
        return res.status(400).json({ message: 'No check-in found for today.' });
      }
      if (record.checkOutAt) {
        return res
          .status(200)
          .json({ ...toSafeAttendance(record), message: 'Already checked out today.' });
      }

      record.checkOutAt = now;
      await record.save();
      return res.json(toSafeAttendance(record));
    } catch (err) {
      return res.status(500).json({ message: 'Failed to check out.' });
    }
  }
);

router.get('/api/employee/leave', requireAuth, requireRole('employee'), async (req, res) => { // List leave requests.
  try {
    const leaves = await LeaveRequest.find({ employee: req.userId })
      .sort({ createdAt: -1 })
      .limit(20);
    return res.json(leaves.map(toSafeLeave));
  } catch (err) {
    return res.status(500).json({ message: 'Failed to load leave requests.' });
  }
});

router.post('/api/employee/leave', requireAuth, requireRole('employee'), async (req, res) => { // Submit a leave request.
  try {
    const { fromDate, toDate, reason, category } = req.body;
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

    const leaveCategory = category || 'casual';
    if (!['sick', 'casual', 'emergency'].includes(leaveCategory)) {
      return res.status(400).json({ message: 'Invalid leave category.' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const fromDay = new Date(from);
    fromDay.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((fromDay - today) / (1000 * 60 * 60 * 24));
    const casualLeadDays = 2;
    if (leaveCategory === 'casual' && diffDays < casualLeadDays) {
      return res
        .status(400)
        .json({ message: 'Casual leave must be requested at least 2 days in advance.' });
    }

    const leave = await LeaveRequest.create({
      employee: req.userId,
      fromDate: from,
      toDate: to,
      category: leaveCategory,
      reason: reason ? String(reason).trim() : ''
    });

    return res.status(201).json(toSafeLeave(leave));
  } catch (err) {
    return res.status(500).json({ message: 'Failed to submit leave request.' });
  }
});

router.get('/api/employee/tasks', requireAuth, requireRole('employee'), async (req, res) => { // List assigned tasks.
  try {
    const tasks = await Task.find({ employee: req.userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('assignedBy', 'name email');
    return res.json(tasks.map(toSafeTask));
  } catch (err) {
    return res.status(500).json({ message: 'Failed to load tasks.' });
  }
});

router.patch('/api/employee/tasks/:id', requireAuth, requireRole('employee'), async (req, res) => { // Update task status.
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['planning', 'processing', 'completed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid task status.' });
    }

    const task = await Task.findOne({ _id: id, employee: req.userId }).populate(
      'assignedBy',
      'name email'
    );
    if (!task) {
      return res.status(404).json({ message: 'Task not found.' });
    }

    task.status = status;
    await task.save();
    return res.json(toSafeTask(task));
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update task status.' });
  }
});

module.exports = router;


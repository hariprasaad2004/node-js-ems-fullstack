const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
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
  status: user.status,
  createdAt: user.createdAt
});

const formatDateKey = (date = new Date()) => { // Format a date into YYYY-MM-DD for attendance keys.
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toSafeAttendance = (record) => ({ // Sanitize attendance record for API responses.
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

const toSafeLeave = (leave) => ({ // Sanitize leave request for API responses.
  id: leave._id.toString(),
  fromDate: leave.fromDate,
  toDate: leave.toDate,
  category: leave.category || 'casual',
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

const normalizeTaskStatus = (status) => (status === 'assigned' ? 'planning' : status); // Normalize task status to UI-friendly values.

const toSafeTask = (task) => ({ // Sanitize task records for API responses.
  id: task._id.toString(),
  details: task.details,
  status: normalizeTaskStatus(task.status),
  dueAt: task.dueAt || null,
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

router.get('/admin', (req, res) => { // Serve the SPA for the admin route with role checks.
  const adminSession = getRoleSession(req, 'admin');
  if (!adminSession?.userId) {
    return res.redirect('/login');
  }
  return res.sendFile(frontendIndex);
});

router.get('/api/admin/employees', requireAuth, requireRole('admin'), async (req, res) => { // List employees for admin view.
  try {
    const employees = await User.find({ role: 'employee' }).sort({ createdAt: -1 });
    return res.json(employees.map(toSafeEmployee));
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch employees.' });
  }
});

router.post('/api/admin/employees', requireAuth, requireRole('admin'), async (req, res) => { // Create a new employee.
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

router.put('/api/admin/employees/:id', requireAuth, requireRole('admin'), async (req, res) => { // Update an employee.
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

router.delete('/api/admin/employees/:id', requireAuth, requireRole('admin'), async (req, res) => { // Delete an employee.
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

router.get('/api/admin/attendance', requireAuth, requireRole('admin'), async (req, res) => { // Fetch recent attendance records.
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

router.get('/api/admin/attendance/summary', requireAuth, requireRole('admin'), async (req, res) => { // Summarize today's attendance across employees.
  try {
    const dateKey = typeof req.query.date === 'string' && req.query.date ? req.query.date : formatDateKey();
    const [employees, records] = await Promise.all([
      User.find({ role: 'employee' }).sort({ createdAt: -1 }),
      Attendance.find({ dateKey })
    ]);

    const recordMap = new Map(
      records.map((record) => [record.employee.toString(), record])
    );

    const summary = employees.map((employee) => {
      const record = recordMap.get(employee._id.toString());
      let status = 'not_checked_in';
      let checkInAt = null;
      let checkOutAt = null;
      if (record) {
        checkInAt = record.checkInAt;
        checkOutAt = record.checkOutAt;
        status = record.checkOutAt ? 'checked_out' : 'checked_in';
      }
      return {
        employee: {
          id: employee._id.toString(),
          name: employee.name,
          email: employee.email,
          department: employee.department || '',
          title: employee.title || ''
        },
        status,
        date: dateKey,
        checkInAt,
        checkOutAt
      };
    });

    return res.json(summary);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch attendance summary.' });
  }
});

router.post('/api/admin/attendance/check-in', requireAuth, requireRole('admin'), async (req, res) => { // Admin-triggered employee check-in.
  try {
    const { employeeId } = req.body;
    if (!employeeId) {
      return res.status(400).json({ message: 'Employee is required.' });
    }

    const employee = await User.findOne({ _id: employeeId, role: 'employee' });
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found.' });
    }

    const now = new Date();
    const dateKey = formatDateKey(now);
    const existing = await Attendance.findOne({ employee: employeeId, dateKey });
    if (existing) {
      const message = existing.checkOutAt
        ? 'Attendance already recorded for today.'
        : 'Employee already checked in today.';
      return res.status(200).json({ ...toSafeAttendance(existing), message });
    }

    const record = await Attendance.create({
      employee: employeeId,
      dateKey,
      checkInAt: now
    });

    return res.status(201).json(toSafeAttendance(record));
  } catch (err) {
    if (err && err.code === 11000) {
      const dateKey = formatDateKey();
      const existing = await Attendance.findOne({ employee: employeeId, dateKey });
      if (existing) {
        return res.status(200).json({
          ...toSafeAttendance(existing),
          message: 'Attendance already recorded for today.'
        });
      }
    }
    return res.status(500).json({ message: 'Failed to check in employee.' });
  }
});

router.post('/api/admin/attendance/check-out', requireAuth, requireRole('admin'), async (req, res) => { // Admin-triggered employee check-out.
  try {
    const { employeeId } = req.body;
    if (!employeeId) {
      return res.status(400).json({ message: 'Employee is required.' });
    }

    const employee = await User.findOne({ _id: employeeId, role: 'employee' });
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found.' });
    }

    const now = new Date();
    const dateKey = formatDateKey(now);
    const record = await Attendance.findOne({ employee: employeeId, dateKey });
    if (!record) {
      return res.status(400).json({ message: 'No check-in found for today.' });
    }
    if (record.checkOutAt) {
      return res.status(200).json({
        ...toSafeAttendance(record),
        message: 'Employee already checked out today.'
      });
    }

    record.checkOutAt = now;
    await record.save();

    return res.json(toSafeAttendance(record));
  } catch (err) {
    return res.status(500).json({ message: 'Failed to check out employee.' });
  }
});

router.get('/api/admin/leave', requireAuth, requireRole('admin'), async (req, res) => { // List leave requests.
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

router.patch('/api/admin/leave/:id', requireAuth, requireRole('admin'), async (req, res) => { // Approve or reject a leave request.
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
    leave.reviewedBy = req.userId;
    leave.reviewedAt = new Date();
    await leave.save();

    return res.json(toSafeLeave(leave));
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update leave request.' });
  }
});

router.get('/api/admin/tasks', requireAuth, requireRole('admin'), async (req, res) => { // List recent tasks.
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

router.post('/api/admin/tasks', requireAuth, requireRole('admin'), async (req, res) => { // Assign a task to an employee.
  try {
    const { employeeId, details, dueAt } = req.body;
    if (!employeeId || !details || !String(details).trim()) {
      return res.status(400).json({ message: 'Employee and task details are required.' });
    }
    if (!dueAt) {
      return res.status(400).json({ message: 'Due time is required.' });
    }

    const parsedDueAt = new Date(dueAt);
    if (Number.isNaN(parsedDueAt.getTime())) {
      return res.status(400).json({ message: 'Invalid due time.' });
    }

    const employee = await User.findOne({ _id: employeeId, role: 'employee' });
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found.' });
    }

    const task = await Task.create({
      employee: employee._id,
      assignedBy: req.userId,
      details: String(details).trim(),
      status: 'planning',
      dueAt: parsedDueAt
    });

    await task.populate('employee', 'name email department');
    await task.populate('assignedBy', 'name email');

    return res.status(201).json(toSafeTask(task));
  } catch (err) {
    return res.status(500).json({ message: 'Failed to assign task.' });
  }
});

module.exports = router;


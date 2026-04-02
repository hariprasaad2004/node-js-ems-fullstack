const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/LeaveRequest');
const Task = require('../models/Task');
const EODReport = require('../models/EODReport');
const { requireAuth, requireRole, getRoleSession } = require('../middleware/auth');

const router = express.Router();

const rootDir = path.join(__dirname, '..', '..');
const frontendIndex = path.join(rootDir, 'frontend', 'dist', 'index.html');
const adminRoles = ['admin', 'manager'];
const leadRoles = ['admin', 'manager', 'teamlead'];
const staffRoles = ['employee', 'teamlead', 'manager'];
const managerScopedRoles = ['employee', 'teamlead'];
const creatableRoles = ['employee', 'teamlead', 'manager']; // admins may create managers too
const taskAssignRoles = ['admin', 'teamlead'];

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
  role: leave.roleAtRequest || leave.employee?.role || 'employee',
  createdAt: leave.createdAt,
  updatedAt: leave.updatedAt,
  employee: leave.employee
    ? {
        id: leave.employee._id?.toString?.() || leave.employee.toString(),
        name: leave.employee.name,
        email: leave.employee.email,
        role: leave.roleAtRequest || leave.employee.role,
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
  updatedAt: task.updatedAt,
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

const toSafeEod = (report) => ({ // Sanitize end-of-day reports.
  id: report._id.toString(),
  date: report.date,
  dateKey: report.dateKey,
  session1: report.session1 || '',
  session2: report.session2 || '',
  status: report.status || 'completed',
  createdAt: report.createdAt,
  employee: report.employee
    ? {
        id: report.employee._id?.toString?.() || report.employee.toString(),
        name: report.employee.name,
        email: report.employee.email,
        department: report.employee.department || ''
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

router.get('/manager', (req, res) => { // Serve the SPA for the manager route with role checks.
  const managerSession = getRoleSession(req, 'manager');
  if (!managerSession?.userId) {
    return res.redirect('/login');
  }
  return res.sendFile(frontendIndex);
});

router.get('/teamlead', (req, res) => { // Serve the SPA for the team lead route with role checks.
  const leadSession = getRoleSession(req, 'teamlead');
  if (!leadSession?.userId) {
    return res.redirect('/login');
  }
  return res.sendFile(frontendIndex);
});

router.get('/api/admin/employees', requireAuth, requireRole(leadRoles), async (req, res) => { // List employees for admin/manager/lead view.
  try {
    const scope = req.userRole === 'admin' ? staffRoles : managerScopedRoles;
    const employees = await User.find({ role: { $in: scope } }).sort({ createdAt: -1 });
    return res.json(employees.map(toSafeEmployee));
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch employees.' });
  }
});

router.post('/api/admin/employees', requireAuth, requireRole(adminRoles), async (req, res) => { // Create a new employee.
  try {
    const {
      name,
      email,
      password,
      role,
      department,
      title,
      phone,
      address,
      salary,
      status,
      profileImage
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: 'Email already exists.' });
    }

    const allowedRoles = req.userRole === 'admin' ? creatableRoles : managerScopedRoles;
    const cleanRole = allowedRoles.includes(role) ? role : 'employee';

    const passwordHash = await bcrypt.hash(password, 10);

    const employee = await User.create({
      role: cleanRole,
      name,
      email: email.toLowerCase(),
      passwordHash,
      department,
      title,
      phone,
      address,
      salary: Number.isFinite(Number(salary)) ? Number(salary) : undefined,
      profileImage: profileImage || '',
      status: status || 'active'
    });

    return res.status(201).json(toSafeEmployee(employee));
  } catch (err) {
    return res.status(500).json({ message: 'Failed to create employee.' });
  }
});

router.put('/api/admin/employees/:id', requireAuth, requireRole(adminRoles), async (req, res) => { // Update an employee.
  try {
    const { id } = req.params;
    const {
      name,
      email,
      password,
      department,
      title,
      phone,
      address,
      salary,
      status,
      profileImage
    } = req.body;

    const allowedRoles = req.userRole === 'admin' ? staffRoles : managerScopedRoles;
    const employee = await User.findOne({ _id: id, role: { $in: allowedRoles } });
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found.' });
    }

    if (employee.role === 'manager') {
      return res.status(403).json({ message: 'Managers cannot be edited by admin.' });
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
    if (role) {
      if (!allowedRoles.includes(role) || role === 'manager') {
        return res.status(403).json({ message: 'Role change not permitted.' });
      }
      employee.role = role;
    }
    if (password) employee.passwordHash = await bcrypt.hash(password, 10);
    if (profileImage !== undefined) employee.profileImage = profileImage;

    await employee.save();
    return res.json(toSafeEmployee(employee));
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update employee.' });
  }
});

router.delete('/api/admin/employees/:id', requireAuth, requireRole(adminRoles), async (req, res) => { // Delete an employee.
  try {
    const { id } = req.params;
    const allowedRoles = req.userRole === 'admin' ? staffRoles : managerScopedRoles;
    const employee = await User.findOne({ _id: id, role: { $in: allowedRoles } });
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found.' });
    }
    if (employee.role === 'manager') {
      return res.status(403).json({ message: 'Managers cannot be deleted by admin.' });
    }

    await employee.deleteOne();
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to delete employee.' });
  }
});

router.get('/api/admin/attendance', requireAuth, requireRole(leadRoles), async (req, res) => { // Fetch recent attendance records.
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

router.get('/api/admin/attendance/summary', requireAuth, requireRole(leadRoles), async (req, res) => { // Summarize today's attendance across employees.
  try {
    const dateKey = typeof req.query.date === 'string' && req.query.date ? req.query.date : formatDateKey();
    const attendanceScope = ['employee', 'teamlead']; // exclude managers from attendance summary
    const [employees, records] = await Promise.all([
      User.find({ role: { $in: attendanceScope } }).sort({ createdAt: -1 }),
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

router.post('/api/admin/attendance/check-in', requireAuth, requireRole(adminRoles), async (req, res) => { // Admin-triggered employee check-in.
  try {
    const { employeeId } = req.body;
    if (!employeeId) {
      return res.status(400).json({ message: 'Employee is required.' });
    }

    const allowedRoles = req.userRole === 'admin' ? staffRoles : managerScopedRoles;
    const employee = await User.findOne({ _id: employeeId, role: { $in: allowedRoles } });
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

router.post('/api/admin/attendance/check-out', requireAuth, requireRole(adminRoles), async (req, res) => { // Admin-triggered employee check-out.
  try {
    const { employeeId } = req.body;
    if (!employeeId) {
      return res.status(400).json({ message: 'Employee is required.' });
    }

    const allowedRoles = req.userRole === 'admin' ? staffRoles : managerScopedRoles;
    const employee = await User.findOne({ _id: employeeId, role: { $in: allowedRoles } });
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

router.get('/api/admin/leave', requireAuth, requireRole(leadRoles), async (req, res) => { // List leave requests with role-based visibility and optional status filter.
  try {
    const { status } = req.query;
    const allowedStatuses = ['pending', 'approved', 'rejected'];
    const match = {};
    if (status && allowedStatuses.includes(status)) {
      match.status = status;
    }

    const leaves = await LeaveRequest.find(match)
      .sort({ createdAt: -1 })
      .limit(30)
      .populate('employee', 'name email role department');

    // Visibility rules:
    // - Admin leave requests (employee.role === 'admin') are only visible to managers.
    // - Team leads can see only employee/teamlead leave requests.
    // - Managers see all.
    // - Admins see everything except admin leave requests (so their own requests are routed to managers).
    const filtered = leaves.filter((leave) => {
      const role = leave.employee?.role;
      if (role === 'admin') {
        return req.userRole === 'manager';
      }
      if (req.userRole === 'teamlead') {
        return role === 'employee' || role === 'teamlead';
      }
      return true; // manager or admin for non-admin employees
    });

    return res.json(filtered.map(toSafeLeave));
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch leave requests.' });
  }
});

router.patch('/api/admin/leave/:id', requireAuth, requireRole(leadRoles), async (req, res) => { // Approve or reject a leave request with role-based permissions.
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status.' });
    }

    const leave = await LeaveRequest.findById(id).populate('employee', 'name email role department');
    if (!leave) {
      return res.status(404).json({ message: 'Leave request not found.' });
    }

    const employeeRole = leave.employee?.role;
    // Only managers can act on admin leave requests.
    if (employeeRole === 'admin' && req.userRole !== 'manager') {
      return res.status(403).json({ message: 'Only managers can process admin leave requests.' });
    }
    // Team leads can only process employee/teamlead leave requests.
    if (req.userRole === 'teamlead' && employeeRole !== 'employee' && employeeRole !== 'teamlead') {
      return res.status(403).json({ message: 'You can only process team/employee leave requests.' });
    }
    // Prevent self-approval.
    if (leave.employee?._id?.toString?.() === req.userId) {
      return res.status(403).json({ message: 'You cannot approve your own leave request.' });
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

router.get('/api/admin/tasks', requireAuth, requireRole(leadRoles), async (req, res) => { // List recent tasks.
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

router.post('/api/admin/tasks', requireAuth, requireRole(taskAssignRoles), async (req, res) => { // Assign a task to an employee.
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

    // Admins may only assign tasks to employees (not managers or team leads).
    const allowedRoles = req.userRole === 'admin' ? ['employee'] : managerScopedRoles;
    const employee = await User.findOne({ _id: employeeId, role: { $in: allowedRoles } });
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

router.get('/api/admin/eods', requireAuth, requireRole(leadRoles), async (req, res) => { // List EODs with analytics.
  try {
    const { employeeId } = req.query;
    const match = {};
    if (employeeId) {
      match.employee = employeeId;
    }

    const reports = await EODReport.find(match)
      .sort({ date: -1 })
      .limit(80)
      .populate('employee', 'name email department');

    const now = new Date();
    const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);

    const [totals] = await EODReport.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          completed: {
            $sum: {
              $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
            }
          },
          inProgress: {
            $sum: {
              $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0]
            }
          },
          lastDate: { $max: '$date' }
        }
      }
    ]);

    const [recent] = await EODReport.aggregate([
      {
        $match: {
          ...match,
          date: { $gte: sevenDaysAgo }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          completed: {
            $sum: {
              $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
            }
          }
        }
      }
    ]);

    const perEmployee = await EODReport.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$employee',
          total: { $sum: 1 },
          completed: {
            $sum: {
              $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
            }
          },
          inProgress: {
            $sum: {
              $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0]
            }
          },
          lastDate: { $max: '$date' }
        }
      },
      { $sort: { completed: -1, total: -1 } },
      { $limit: 25 }
    ]);

    const employeeIds = perEmployee.map((item) => item._id).filter(Boolean);
    const users = await User.find({ _id: { $in: employeeIds } }, 'name email department');
    const userMap = new Map(users.map((user) => [user._id.toString(), user]));

    const totalCount = totals?.total || 0;
    const completedCount = totals?.completed || 0;
    const inProgressCount = totals?.inProgress || 0;

    const summary = {
      total: totalCount,
      completed: completedCount,
      inProgress: inProgressCount,
      completionRate: totalCount ? Math.round((completedCount / totalCount) * 100) : 0,
      lastSubmittedAt: totals?.lastDate || null,
      last7Days: {
        total: recent?.total || 0,
        completed: recent?.completed || 0,
        completionRate: recent?.total
          ? Math.round((recent.completed / recent.total) * 100)
          : 0
      },
      perEmployee: perEmployee.map((item) => {
        const user = userMap.get(item._id?.toString?.() || '');
        const completionRate = item.total ? Math.round((item.completed / item.total) * 100) : 0;
        return {
          employeeId: item._id?.toString?.() || '',
          name: user?.name || 'Employee',
          email: user?.email || '',
          department: user?.department || '',
          total: item.total,
          completed: item.completed,
          inProgress: item.inProgress,
          completionRate,
          lastDate: item.lastDate
        };
      })
    };

    return res.json({
      reports: reports.map(toSafeEod),
      summary
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch EOD reports.' });
  }
});

module.exports = router;

import { useEffect, useMemo, useState } from 'react';
import { apiRequest, readJson } from '../api/client.js';
import Sidebar from '../components/Sidebar.jsx';
import { useBodyClass } from '../hooks/useBodyClass.js';
import { formatDate, formatDateTime, formatEmployeeLabel, formatStatus } from '../utils/format.js';

const navItems = [
  { id: 'overview', label: 'Overview' },
  { id: 'employees', label: 'Employees' },
  { id: 'leave', label: 'Leave' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'policies', label: 'Policies' }
];

const initialFormState = {
  name: '',
  email: '',
  password: '',
  department: '',
  title: '',
  phone: '',
  address: '',
  salary: '',
  profileImage: '',
  status: 'active'
};

const initialTaskState = {
  employeeId: '',
  details: '',
  dueAt: ''
};

const MAX_IMAGE_SIZE = 1_500_000; // 1.5 MB

const getTaskDate = (task) => {
  if (task?.dueAt) return new Date(task.dueAt);
  if (task?.createdAt) return new Date(task.createdAt);
  return null;
};

const toTime = (value) => {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
};

const getDayStart = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const getNextDayStart = (date) => {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return next;
};

const getWeekStart = (date) => {
  const day = date.getDay();
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - day);
};

const getNextWeekStart = (date) => {
  const start = getWeekStart(date);
  const next = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  return next;
};

const getMonthStart = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

const getNextMonthStart = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 1);

export default function AdminDashboard() { // Admin dashboard UI and data operations.
  useBodyClass('page-dashboard');

  const [activeSection, setActiveSection] = useState('overview');
  const [isDark, setIsDark] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [employeeError, setEmployeeError] = useState('');
  const [attendance, setAttendance] = useState([]);
  const [attendanceError, setAttendanceError] = useState('');
  const [leaves, setLeaves] = useState([]);
  const [leaveError, setLeaveError] = useState('');
  const [tasks, setTasks] = useState([]);
  const [taskError, setTaskError] = useState('');
  const [formData, setFormData] = useState(initialFormState);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [formStatus, setFormStatus] = useState({ message: '', isError: false });
  const [leaveStatus, setLeaveStatus] = useState({ message: '', isError: false });
  const [taskStatus, setTaskStatus] = useState({ message: '', isError: false });
  const [taskForm, setTaskForm] = useState(initialTaskState);
  const [infoEmployee, setInfoEmployee] = useState(null);
  const [statNow, setStatNow] = useState(() => new Date());
  const notificationCount = 3;

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');

  const stats = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((emp) => emp.status === 'active').length;
    const recentCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recent = employees.filter((emp) => {
      if (!emp.createdAt) return false;
      return new Date(emp.createdAt).getTime() >= recentCutoff;
    }).length;
    return { total, active, inactive: total - active, recent };
  }, [employees]);

  const departments = useMemo(() => {
    const unique = new Set();
    employees.forEach((emp) => {
      if (emp.department) unique.add(emp.department);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [employees]);

  const departmentBreakdown = useMemo(() => {
    const total = employees.length;
    const tally = new Map();
    employees.forEach((emp) => {
      const key = emp.department?.trim() || 'Unassigned';
      tally.set(key, (tally.get(key) || 0) + 1);
    });
    return Array.from(tally.entries())
      .map(([name, count]) => ({
        name,
        count,
        percent: total ? Math.round((count / total) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count);
  }, [employees]);

  const recentHires = useMemo(() => {
    if (employees.length === 0) return [];
    const withDates = employees.filter((emp) => emp.createdAt);
    const base = withDates.length ? withDates : employees;
    return base
      .slice()
      .sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt))
      .slice(0, 4);
  }, [employees]);

  const upcomingTasks = useMemo(() => {
    const now = Date.now();
    return tasks
      .filter((task) => task.dueAt && toTime(task.dueAt) >= now)
      .slice()
      .sort((a, b) => toTime(a.dueAt) - toTime(b.dueAt))
      .slice(0, 4);
  }, [tasks]);

  const pendingLeaves = useMemo(() => {
    return leaves
      .filter((leave) => leave.status === 'pending')
      .slice()
      .sort((a, b) => toTime(a.fromDate) - toTime(b.fromDate))
      .slice(0, 4);
  }, [leaves]);

  const filteredEmployees = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return employees.filter((emp) => {
      if (statusFilter !== 'all' && emp.status !== statusFilter) {
        return false;
      }
      if (departmentFilter !== 'all' && emp.department !== departmentFilter) {
        return false;
      }
      if (!term) return true;
      return (
        emp.name?.toLowerCase().includes(term) ||
        emp.email?.toLowerCase().includes(term) ||
        emp.title?.toLowerCase().includes(term) ||
        emp.department?.toLowerCase().includes(term)
      );
    });
  }, [employees, searchTerm, statusFilter, departmentFilter]);

  useEffect(() => {
    const now = new Date();
    const nextTimes = [
      getNextDayStart(now),
      getNextWeekStart(now),
      getNextMonthStart(now)
    ];
    const next = new Date(Math.min(...nextTimes.map((value) => value.getTime())));
    const delay = Math.max(next.getTime() - now.getTime(), 1000);
    const timer = window.setTimeout(() => setStatNow(new Date()), delay);
    return () => window.clearTimeout(timer);
  }, [statNow]);

  useEffect(() => {
    const { classList } = document.body;
    if (isDark) {
      classList.add('theme-dark');
    } else {
      classList.remove('theme-dark');
    }
    return () => {
      classList.remove('theme-dark');
    };
  }, [isDark]);

  const rangeStats = useMemo(() => {
    const now = statNow;
    const dayStart = getDayStart(now);
    const dayEnd = getNextDayStart(now);
    const weekStart = getWeekStart(now);
    const weekEnd = getNextWeekStart(now);
    const monthStart = getMonthStart(now);
    const monthEnd = getNextMonthStart(now);

    const calc = (start, end) => {
      const items = tasks.filter((task) => {
        const date = getTaskDate(task);
        return date && date >= start && date < end;
      });
      const completed = items.filter((task) => task.status === 'completed').length;
      const total = items.length;
      const pending = total - completed;
      const performance = total ? Math.round((completed / total) * 100) : 0;
      return { total, pending, completed, performance };
    };

    return {
      day: calc(dayStart, dayEnd),
      week: calc(weekStart, weekEnd),
      month: calc(monthStart, monthEnd),
      nextDay: dayEnd,
      nextWeek: weekEnd,
      nextMonth: monthEnd
    };
  }, [tasks, statNow]);

  useEffect(() => {
    loadEmployees();
    loadLeaves();
    loadTasks();
  }, []);

  async function loadEmployees() { // Fetch employees and refresh summary data.
    setEmployeeError('');
    const res = await apiRequest('/api/admin/employees');
    const data = await readJson(res);

    if (!res.ok) {
      setEmployeeError(data?.message || 'Failed to load employees.');
      setEmployees([]);
      return;
    }

    const list = Array.isArray(data) ? data : [];
    setEmployees(list);
    await loadAttendance();
  }

  async function loadAttendance() { // Fetch attendance summary data.
    setAttendanceError('');
    const res = await apiRequest('/api/admin/attendance/summary');
    const data = await readJson(res);

    if (!res.ok) {
      setAttendanceError(data?.message || 'Failed to load attendance.');
      setAttendance([]);
      return;
    }

    setAttendance(Array.isArray(data) ? data : []);
  }

  async function loadLeaves() { // Fetch leave request data.
    setLeaveError('');
    const res = await apiRequest('/api/admin/leave');
    const data = await readJson(res);

    if (!res.ok) {
      setLeaveError(data?.message || 'Failed to load leave requests.');
      setLeaves([]);
      return;
    }

    setLeaves(Array.isArray(data) ? data : []);
  }

  async function loadTasks() { // Fetch assigned tasks.
    setTaskError('');
    const res = await apiRequest('/api/admin/tasks');
    const data = await readJson(res);

    if (!res.ok) {
      setTaskError(data?.message || 'Failed to load tasks.');
      setTasks([]);
      return;
    }

    setTasks(Array.isArray(data) ? data : []);
  }

  const handleFormChange = (event) => { // Track Add/Edit form input changes.
    const { id, value } = event.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleImageChange = (event) => { // Read profile image and store as data URL.
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_IMAGE_SIZE) {
      setFormStatus({ message: 'Image must be under 1.5 MB.', isError: true });
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFormData((prev) => ({ ...prev, profileImage: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleTaskChange = (event) => { // Track task assignment form input changes.
    const { name, value } = event.target;
    setTaskForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => { // Create or update an employee.
    event.preventDefault();
    setFormStatus({ message: 'Saving...', isError: false });

    const payload = {
      name: formData.name.trim(),
      email: formData.email.trim(),
      password: formData.password.trim(),
      department: formData.department.trim(),
      title: formData.title.trim(),
      phone: formData.phone.trim(),
      address: formData.address.trim(),
      salary: formData.salary.trim(),
      profileImage: formData.profileImage || '',
      status: formData.status
    };

    if (editingId && !payload.password) {
      delete payload.password;
    }

    const res = await apiRequest(
      editingId ? `/api/admin/employees/${editingId}` : '/api/admin/employees',
      {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify(payload)
      }
    );
    const data = await readJson(res);

    if (!res.ok) {
      setFormStatus({ message: data?.message || 'Failed to save.', isError: true });
      return;
    }

    setFormStatus({
      message: editingId ? 'Employee updated.' : 'Employee created.',
      isError: false
    });
    setEditingId(null);
    setFormData(initialFormState);
    await loadEmployees();
  };

  const handleEdit = (employee) => { // Populate form for editing an employee.
    setShowForm(true);
    setEditingId(employee.id);
    setFormData({
      name: employee.name || '',
      email: employee.email || '',
      password: '',
      department: employee.department || '',
      title: employee.title || '',
      phone: employee.phone || '',
      address: employee.address || '',
      salary: employee.salary ? String(employee.salary) : '',
      profileImage: employee.profileImage || '',
      status: employee.status || 'active'
    });
    setFormStatus({ message: `Editing ${employee.name}`, isError: false });
  };

  const handleCancelEdit = () => { // Reset form and exit edit mode.
    setEditingId(null);
    setFormData(initialFormState);
    setFormStatus({ message: 'Edit canceled.', isError: false });
  };

  const handleToggleForm = () => { // Show or hide the Add/Edit form.
    setShowForm((prev) => {
      const next = !prev;
      if (next) {
        setEditingId(null);
        setFormData(initialFormState);
        setFormStatus({ message: '', isError: false });
      }
      return next;
    });
  };

  const handleCloseForm = () => { // Close the form modal and reset state.
    setShowForm(false);
    setEditingId(null);
    setFormData(initialFormState);
    setFormStatus({ message: '', isError: false });
  };

  const handleToggleTaskForm = () => { // Show or hide the assign task form.
    setShowTaskForm((prev) => {
      const next = !prev;
      if (next) {
        setTaskStatus({ message: '', isError: false });
      }
      return next;
    });
  };

  const handleCloseTaskForm = () => { // Close the task modal and reset state.
    setShowTaskForm(false);
    setTaskForm(initialTaskState);
    setTaskStatus({ message: '', isError: false });
  };

  const getTaskStatusTone = (status) => {
    const value = status?.toLowerCase() || '';
    if (value === 'completed') return 'status-completed';
    if (value === 'pending') return 'status-pending';
    if (value === 'planning') return 'status-planning';
    if (value === 'in-progress' || value === 'in progress') return 'status-progress';
    return 'status-default';
  };

  const getTaskDueTone = (task) => {
    if (!task?.dueAt) return 'due-none';
    const dueDate = new Date(task.dueAt);
    if (Number.isNaN(dueDate.getTime())) return 'due-none';
    const now = new Date();
    const statusValue = task.status?.toLowerCase() || '';
    if (statusValue === 'completed') return 'due-ok';
    const diff = dueDate.getTime() - now.getTime();
    if (diff < 0) return 'due-overdue';
    if (diff <= 24 * 60 * 60 * 1000) return 'due-soon';
    return 'due-upcoming';
  };

  const getTaskDueText = (task) => {
    if (!task?.dueAt) return 'No due time';
    const formatted = formatDateTime(task.dueAt);
    return formatted === '-' ? 'No due time' : formatted;
  };

  const getTaskInitials = (name) => {
    if (!name) return 'UN';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('');
  };

  const handleOpenInfo = (employee) => { // Open employee info modal.
    setInfoEmployee(employee);
  };

  const handleCloseInfo = () => { // Close employee info modal.
    setInfoEmployee(null);
  };

  const handleDelete = async (employee) => { // Delete an employee after confirmation.
    if (!window.confirm('Delete this employee?')) return;

    const res = await apiRequest(`/api/admin/employees/${employee.id}`, { method: 'DELETE' });
    const data = await readJson(res);

    if (!res.ok) {
      setFormStatus({ message: data?.message || 'Failed to delete.', isError: true });
      return;
    }

    setFormStatus({ message: 'Employee deleted.', isError: false });
    await loadEmployees();
  };

  const handleLeaveAction = async (leaveId, action) => { // Approve or reject leave requests.
    setLeaveStatus({ message: 'Updating leave request...', isError: false });
    const res = await apiRequest(`/api/admin/leave/${leaveId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: action })
    });
    const data = await readJson(res);

    if (!res.ok) {
      setLeaveStatus({ message: data?.message || 'Failed to update leave.', isError: true });
      return;
    }

    setLeaveStatus({ message: `Leave request ${action}.`, isError: false });
    await loadLeaves();
  };

  const handleAssignTask = async (event) => { // Assign a task to an employee.
    event.preventDefault();
    setTaskStatus({ message: 'Assigning...', isError: false });

    const payload = {
      employeeId: taskForm.employeeId,
      details: taskForm.details.trim(),
      dueAt: taskForm.dueAt
    };

    if (!payload.employeeId) {
      setTaskStatus({ message: 'Select an employee first.', isError: true });
      return;
    }
    if (!payload.details) {
      setTaskStatus({ message: 'Enter task details.', isError: true });
      return;
    }
    if (!payload.dueAt) {
      setTaskStatus({ message: 'Select a due time.', isError: true });
      return;
    }

    const res = await apiRequest('/api/admin/tasks', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const data = await readJson(res);

    if (!res.ok) {
      setTaskStatus({ message: data?.message || 'Failed to assign task.', isError: true });
      return;
    }

    setTaskStatus({ message: 'Task assigned.', isError: false });
    setTaskForm(initialTaskState);
    await loadTasks();
  };

  const handleLogout = async () => { // Logout and redirect to login.
    await apiRequest('/logout', {
      method: 'POST',
      body: JSON.stringify({ role: 'admin' })
    });
    window.location.assign('/login');
  };

  const renderEmployeeOverview = (idPrefix) => (
    <>
      <div className="employee-metrics">
        <div className="metric-card metric-total">
          <div className="metric-label">Total Employees</div>
          <div className="metric-value">{stats.total}</div>
        </div>
        <div className="metric-card metric-new">
          <div className="metric-label">New (30 Days)</div>
          <div className="metric-value">{stats.recent}</div>
        </div>
        <div className="metric-card metric-active">
          <div className="metric-label">Active</div>
          <div className="metric-value">{stats.active}</div>
        </div>
        <div className="metric-card metric-inactive">
          <div className="metric-label">Inactive</div>
          <div className="metric-value">{stats.inactive}</div>
        </div>
      </div>



      <div className="overview-stats">
        <div className="stat-block" data-kind="day">
          <div className="stat-header">
            <h3>Day Stats</h3>
            <span className="stat-refresh">Refreshes Daily</span>
          </div>
          <div className="stat-body">
            <div className="stat-row">
            <div>
              <span>Tasks Today</span>
              <strong>{rangeStats.day.total}</strong>
            </div>
            <div>
              <span>Pending</span>
              <strong>{rangeStats.day.pending}</strong>
            </div>
          </div>
            <div className="stat-performance">
              <div className="stat-performance-header">
                <span>Performance</span>
                <strong>{rangeStats.day.performance}%</strong>
              </div>
              <div
                className="stat-bar"
                style={{ '--percent': rangeStats.day.performance }}
              >
                <span className="stat-bar-fill" />
              </div>
            </div>
          </div>
          <div className="stat-next">Next refresh: {formatDateTime(rangeStats.nextDay)}</div>
        </div>

        <div className="stat-block" data-kind="week">
          <div className="stat-header">
            <h3>Week Stats</h3>
            <span className="stat-refresh">Refreshes Sunday</span>
          </div>
          <div className="stat-body">
            <div className="stat-row">
            <div>
              <span>Tasks This Week</span>
              <strong>{rangeStats.week.total}</strong>
            </div>
            <div>
              <span>Pending</span>
              <strong>{rangeStats.week.pending}</strong>
            </div>
          </div>
            <div className="stat-performance">
              <div className="stat-performance-header">
                <span>Performance</span>
                <strong>{rangeStats.week.performance}%</strong>
              </div>
              <div
                className="stat-bar"
                style={{ '--percent': rangeStats.week.performance }}
              >
                <span className="stat-bar-fill" />
              </div>
            </div>
          </div>
          <div className="stat-next">Next refresh: {formatDateTime(rangeStats.nextWeek)}</div>
        </div>

        <div className="stat-block" data-kind="month">
          <div className="stat-header">
            <h3>Month Stats</h3>
            <span className="stat-refresh">Refreshes Month End</span>
          </div>
          <div className="stat-body">
            <div className="stat-row">
            <div>
              <span>Finished</span>
              <strong>{rangeStats.month.completed}</strong>
            </div>
            <div>
              <span>Pending</span>
              <strong>{rangeStats.month.pending}</strong>
            </div>
          </div>
            <div className="stat-performance">
              <div className="stat-performance-header">
                <span>Performance</span>
                <strong>{rangeStats.month.performance}%</strong>
              </div>
              <div
                className="stat-bar"
                style={{ '--percent': rangeStats.month.performance }}
              >
                <span className="stat-bar-fill" />
              </div>
            </div>
          </div>
          <div className="stat-next">Next refresh: {formatDateTime(rangeStats.nextMonth)}</div>
        </div>
      </div>

      <div className="overview-grid">
        <div className="overview-card">
          <div className="overview-card-header">
            <h3>Recent Hires</h3>
            <span className="helper">Latest additions</span>
          </div>
          <div className="mini-list">
            {recentHires.length === 0 ? (
              <p className="helper">No employees yet.</p>
            ) : (
              recentHires.map((employee) => (
                <div
                  className="mini-item"
                  key={`${idPrefix}-hire-${employee.id || employee.email || employee.name}`}
                >
                  <div>
                    <div className="mini-title">{employee.name || 'Employee'}</div>
                    <div className="mini-sub">
                      {employee.title || employee.department || 'New hire'}
                    </div>
                  </div>
                  <div className="mini-meta">
                    {employee.createdAt ? formatDate(employee.createdAt) : '—'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="overview-card">
          <div className="overview-card-header">
            <h3>Upcoming Tasks</h3>
            <span className="helper">Due soon</span>
          </div>
          <div className="mini-list">
            {upcomingTasks.length === 0 ? (
              <p className="helper">No upcoming tasks scheduled.</p>
            ) : (
              upcomingTasks.map((task) => (
                <div className="mini-item" key={`${idPrefix}-task-${task.id}`}>
                  <div>
                    <div className="mini-title">{task.details || 'Task'}</div>
                    <div className="mini-sub">
                      {task.employee?.name || 'Unassigned'}
                    </div>
                  </div>
                  <div className="mini-side">
                    <span className={`task-pill ${getTaskStatusTone(task.status)}`}>
                      {formatStatus(task.status)}
                    </span>
                    <span className="mini-meta">
                      {task.dueAt ? formatDateTime(task.dueAt) : 'No due time'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="overview-card">
          <div className="overview-card-header">
            <h3>Pending Leaves</h3>
            <span className="helper">Awaiting approval</span>
          </div>
          <div className="mini-list">
            {pendingLeaves.length === 0 ? (
              <p className="helper">No pending leave requests.</p>
            ) : (
              pendingLeaves.map((leave) => (
                <div className="mini-item" key={`${idPrefix}-leave-${leave.id}`}>
                  <div>
                    <div className="mini-title">{leave.employee?.name || 'Employee'}</div>
                    <div className="mini-sub">{leave.category || 'Leave request'}</div>
                  </div>
                  <div className="mini-meta">
                    {formatDate(leave.fromDate)} - {formatDate(leave.toDate)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="dashboard">
      <Sidebar
        title="Admin"
        items={navItems}
        activeSection={activeSection}
        onSelect={setActiveSection}
        onLogout={handleLogout}
      />

      <main className="content">
        <div className="content-card page-hero">
          <div className="toolbar">
            <div>
              <h1 className="page-title">Admin Dashboard</h1>
              <p className="helper">Manage employees, roles, and active status.</p>
            </div>
            <div className="toolbar-actions">
              <button
                className="icon-button"
                type="button"
                aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
                onClick={() => setIsDark((prev) => !prev)}
                title={isDark ? 'Light theme' : 'Dark theme'}
              >
                {isDark ? (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M12 4.5a.75.75 0 0 1 .75-.75h.5a.75.75 0 0 1 0 1.5h-.5A.75.75 0 0 1 12 4.5Zm6.36 1.64a.75.75 0 0 1 1.06 0l.35.35a.75.75 0 0 1-1.06 1.06l-.35-.35a.75.75 0 0 1 0-1.06ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 1.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm7.5 3.5a.75.75 0 0 1 .75-.75h.5a.75.75 0 0 1 0 1.5h-.5A.75.75 0 0 1 19.5 12Zm-1.14 6.36a.75.75 0 0 1 1.06 0l.35.35a.75.75 0 0 1-1.06 1.06l-.35-.35a.75.75 0 0 1 0-1.06ZM12 18.75a.75.75 0 0 1 .75-.75h.5a.75.75 0 0 1 0 1.5h-.5a.75.75 0 0 1-.75-.75ZM4.5 12a.75.75 0 0 1 .75-.75h.5a.75.75 0 0 1 0 1.5h-.5A.75.75 0 0 1 4.5 12Zm1.14-5.86a.75.75 0 0 1 1.06 0l.35.35a.75.75 0 0 1-1.06 1.06l-.35-.35a.75.75 0 0 1 0-1.06Zm.35 12.27a.75.75 0 0 1 1.06 0l.35.35a.75.75 0 0 1-1.06 1.06l-.35-.35a.75.75 0 0 1 0-1.06Z"
                      fill="currentColor"
                    />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M21 14.5A8.5 8.5 0 0 1 9.5 3a.75.75 0 0 0-.83.93 6.5 6.5 0 1 0 9.4 9.4.75.75 0 0 0 .93-.83Z"
                      fill="currentColor"
                    />
                  </svg>
                )}
              </button>
              <button className="icon-button" type="button" aria-label="Notifications">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M12 3a6 6 0 0 0-6 6v2.2c0 .7-.28 1.37-.78 1.86L4 14.3V16h16v-1.7l-1.22-1.24a2.64 2.64 0 0 1-.78-1.86V9a6 6 0 0 0-6-6Zm0 18a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 21Z"
                    fill="currentColor"
                  />
                </svg>
                {notificationCount > 0 ? (
                  <span className="icon-badge">{notificationCount}</span>
                ) : null}
              </button>
              <div className="admin-profile" aria-label="Admin profile">
                <div className="admin-avatar">A</div>
                <div className="admin-meta">
                  <span className="admin-name">Admin</span>
                  <span className="admin-role">Administrator</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <section
          className={`section ${activeSection === 'overview' ? 'active' : ''}`}
          data-section="overview"
        >
          <div className="content-card overview-panel">{renderEmployeeOverview('overview')}</div>
        </section>

        <section
          className={`section ${activeSection === 'employees' ? 'active' : ''}`}
          data-section="employees"
        >
          <div className="grid-2">
            <div className="content-card employee-panel">
              <div className="employee-header">
                <div>
                  <h2 className="content-title">Employee</h2>
                  <p className="helper">Manage team members, roles, and status.</p>
                </div>
                <button className="btn-primary" type="button" onClick={handleToggleForm}>
                  {showForm ? 'Hide Form' : 'Add Employee'}
                </button>
              </div>

              {employeeError ? (
                <div className="notice">{employeeError}</div>
              ) : filteredEmployees.length === 0 ? (
                <div className="notice">No employees match your filters.</div>
              ) : (
                <div className="employee-grid">
                  {filteredEmployees.map((employee) => {
                    const initials = employee.name
                      ? employee.name
                          .split(' ')
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((part) => part[0])
                          .join('')
                          .toUpperCase()
                      : 'EM';
                    const idSuffix = employee.id ? employee.id.slice(-6).toUpperCase() : 'N/A';
                    return (
                      <div className="employee-card" key={employee.id}>
                        <div className="employee-card-top">
                          <button
                            className="card-menu"
                            type="button"
                            aria-label="Employee info"
                            onClick={() => handleOpenInfo(employee)}
                          >
                            ...
                          </button>
                        </div>
                        <div className="employee-avatar">
                          {employee.profileImage ? (
                            <img src={employee.profileImage} alt={employee.name} />
                          ) : (
                            initials
                          )}
                        </div>
                        <h3 className="employee-name">{employee.name}</h3>
                        <p className="employee-role">{employee.title || 'Employee'}</p>
                        <div className="employee-id">ID: {idSuffix}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </section>

        {showForm ? (
          <div className="modal active" aria-hidden={!showForm}>
            <div className="modal-backdrop" onClick={handleCloseForm} />
            <div
              className="modal-card form-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="employee-form-title"
            >
              <div className="modal-header">
                <div>
                  <h3 id="employee-form-title">
                    {editingId ? 'Edit Employee' : 'Add Employee'}
                  </h3>
                  <p className="helper">
                    {editingId
                      ? 'Update employee details and status.'
                      : 'Fill in employee details to add them to the system.'}
                  </p>
                </div>
                <button className="btn-ghost modal-close" type="button" onClick={handleCloseForm}>
                  Close
                </button>
              </div>

              <form className="form-grid modal-grid" onSubmit={handleSubmit}>
                <div className="span-2 image-field">
                  <label htmlFor="profileImage">Profile Image</label>
                  <div className="image-input">
                    <div className="image-preview">
                      {formData.profileImage ? (
                        <img src={formData.profileImage} alt="Profile preview" />
                      ) : (
                        <span>Upload</span>
                      )}
                    </div>
                    <input
                      id="profileImage"
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                    />
                  </div>
                  <p className="helper">PNG/JPG up to 1.5 MB.</p>
                </div>
                <div>
                  <label htmlFor="name">Full Name</label>
                  <input
                    id="name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={handleFormChange}
                  />
                </div>
                <div>
                  <label htmlFor="email">Email</label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={handleFormChange}
                  />
                </div>
                <div>
                  <label htmlFor="password">Password</label>
                  <input
                    id="password"
                    type="text"
                    placeholder={
                      editingId ? 'Leave blank to keep existing password' : 'Set initial password'
                    }
                    value={formData.password}
                    onChange={handleFormChange}
                  />
                </div>
                <div>
                  <label htmlFor="department">Department</label>
                  <input
                    id="department"
                    type="text"
                    value={formData.department}
                    onChange={handleFormChange}
                  />
                </div>
                <div>
                  <label htmlFor="title">Job Title</label>
                  <input
                    id="title"
                    type="text"
                    value={formData.title}
                    onChange={handleFormChange}
                  />
                </div>
                <div>
                  <label htmlFor="phone">Phone</label>
                  <input
                    id="phone"
                    type="text"
                    value={formData.phone}
                    onChange={handleFormChange}
                  />
                </div>
                <div className="span-2">
                  <label htmlFor="address">Address</label>
                  <textarea
                    id="address"
                    value={formData.address}
                    onChange={handleFormChange}
                  />
                </div>
                <div>
                  <label htmlFor="salary">Salary</label>
                  <input
                    id="salary"
                    type="number"
                    value={formData.salary}
                    onChange={handleFormChange}
                  />
                </div>
                <div>
                  <label htmlFor="status">Status</label>
                  <select id="status" value={formData.status} onChange={handleFormChange}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="span-2 form-actions">
                  <button className="btn-primary" type="submit">
                    {editingId ? 'Update Employee' : 'Add Employee'}
                  </button>
                  {editingId ? (
                    <button className="btn-ghost" type="button" onClick={handleCancelEdit}>
                      Cancel Edit
                    </button>
                  ) : null}
                  <p
                    className="helper"
                    style={{ color: formStatus.isError ? '#c13e2d' : '#0e7c7b' }}
                  >
                    {formStatus.message}
                  </p>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {showTaskForm ? (
          <div className="modal active" aria-hidden={!showTaskForm}>
            <div className="modal-backdrop" onClick={handleCloseTaskForm} />
            <div
              className="modal-card form-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="task-form-title"
            >
              <div className="modal-header">
                <div>
                  <h3 id="task-form-title">Assign Task</h3>
                  <p className="helper">Select an employee and set a due time.</p>
                </div>
                <button className="btn-ghost modal-close" type="button" onClick={handleCloseTaskForm}>
                  Close
                </button>
              </div>

              <form className="form-grid" onSubmit={handleAssignTask}>
                <div>
                  <label htmlFor="task-employee">Employee</label>
                  <select
                    id="task-employee"
                    name="employeeId"
                    value={taskForm.employeeId}
                    onChange={handleTaskChange}
                    disabled={employees.length === 0}
                  >
                    <option value="">
                      {employees.length === 0 ? 'No employees available' : 'Select employee'}
                    </option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {formatEmployeeLabel(employee)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="task-details">Task</label>
                  <textarea
                    id="task-details"
                    name="details"
                    placeholder="Describe the task"
                    value={taskForm.details}
                    onChange={handleTaskChange}
                  />
                </div>
                <div>
                  <label htmlFor="task-due">Due Time</label>
                  <input
                    id="task-due"
                    name="dueAt"
                    type="datetime-local"
                    value={taskForm.dueAt}
                    onChange={handleTaskChange}
                  />
                </div>
                <button className="btn-primary" type="submit">
                  Assign
                </button>
                <p
                  className="helper"
                  style={{ color: taskStatus.isError ? '#c13e2d' : '#0e7c7b' }}
                >
                  {taskStatus.message}
                </p>
              </form>
            </div>
          </div>
        ) : null}

        {infoEmployee ? (
          <div className="modal active" aria-hidden={!infoEmployee}>
            <div className="modal-backdrop" onClick={handleCloseInfo} />
            <div
              className="modal-card info-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="employee-info-title"
            >
              <div className="modal-header">
                <div>
                  <h3 id="employee-info-title">Employee Details</h3>
                  <p className="helper">{infoEmployee.name}</p>
                </div>
                <button className="btn-ghost modal-close" type="button" onClick={handleCloseInfo}>
                  Close
                </button>
              </div>

              <div className="info-grid">
                <div>
                  <span>Employee ID</span>
                  <strong>{infoEmployee.id ? infoEmployee.id.slice(-6).toUpperCase() : 'N/A'}</strong>
                </div>
                <div>
                  <span>Status</span>
                  <strong>{infoEmployee.status}</strong>
                </div>
                <div>
                  <span>Title</span>
                  <strong>{infoEmployee.title || '-'}</strong>
                </div>
                <div>
                  <span>Department</span>
                  <strong>{infoEmployee.department || '-'}</strong>
                </div>
                <div>
                  <span>Email</span>
                  <strong>{infoEmployee.email}</strong>
                </div>
                <div>
                  <span>Phone</span>
                  <strong>{infoEmployee.phone || '-'}</strong>
                </div>
                <div>
                  <span>Address</span>
                  <strong>{infoEmployee.address || '-'}</strong>
                </div>
                <div>
                  <span>Join Date</span>
                  <strong>
                    {infoEmployee.createdAt ? formatDate(infoEmployee.createdAt) : '-'}
                  </strong>
                </div>
              </div>

              <div className="form-actions">
                <button
                  className="btn-ghost"
                  type="button"
                  onClick={() => {
                    handleCloseInfo();
                    handleEdit(infoEmployee);
                  }}
                >
                  Edit
                </button>
                <button
                  className="btn-danger"
                  type="button"
                  onClick={() => {
                    handleCloseInfo();
                    handleDelete(infoEmployee);
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <section
          className={`section ${activeSection === 'leave' ? 'active' : ''}`}
          data-section="leave"
        >
          <div className="content-card">
            <h2 className="content-title">Leave Requests</h2>
            <p className="helper">Track and approve leave requests from employees.</p>
            <p
              className="helper"
              style={{ color: leaveStatus.isError ? '#c13e2d' : '#0e7c7b' }}
            >
              {leaveStatus.message}
            </p>
            <table className="table table-responsive">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Category</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {leaveError ? (
                  <tr>
                    <td colSpan="7">{leaveError}</td>
                  </tr>
                ) : leaves.length === 0 ? (
                  <tr>
                    <td colSpan="7">No leave requests yet.</td>
                  </tr>
                ) : (
                  leaves.map((leave) => (
                    <tr key={leave.id}>
                      <td data-label="Employee">
                        {leave.employee
                          ? `${leave.employee.name} (${leave.employee.email})`
                          : 'Unknown'}
                      </td>
                      <td data-label="Category">{leave.category || 'casual'}</td>
                      <td data-label="From">{formatDate(leave.fromDate)}</td>
                      <td data-label="To">{formatDate(leave.toDate)}</td>
                      <td data-label="Reason">{leave.reason || '-'}</td>
                      <td data-label="Status">{leave.status}</td>
                      <td data-label="Action">
                        {leave.status === 'pending' ? (
                          <div className="action-row">
                            <button
                              className="btn-ghost"
                              type="button"
                              onClick={() => handleLeaveAction(leave.id, 'approved')}
                            >
                              Approve
                            </button>
                            <button
                              className="btn-danger"
                              type="button"
                              onClick={() => handleLeaveAction(leave.id, 'rejected')}
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section
          className={`section ${activeSection === 'attendance' ? 'active' : ''}`}
          data-section="attendance"
        >
          <div className="content-card">
            <h2 className="content-title">Attendance Snapshot</h2>
            <p className="helper">Monitor daily check-ins and hours.</p>
            <table className="table table-responsive">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Status</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                </tr>
              </thead>
              <tbody>
                {attendanceError ? (
                  <tr>
                    <td colSpan="4">{attendanceError}</td>
                  </tr>
                ) : attendance.length === 0 ? (
                  <tr>
                    <td colSpan="4">Attendance data will appear here.</td>
                  </tr>
                ) : (
                  attendance.map((record, index) => (
                    <tr key={`${record.employee?.id || 'unknown'}-${index}`}>
                      <td data-label="Employee">
                        {record.employee
                          ? `${record.employee.name} (${record.employee.email})`
                          : 'Unknown'}
                      </td>
                      <td data-label="Status">{formatStatus(record.status)}</td>
                      <td data-label="Check In">{formatDateTime(record.checkInAt)}</td>
                      <td data-label="Check Out">{formatDateTime(record.checkOutAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section
          className={`section ${activeSection === 'tasks' ? 'active' : ''}`}
          data-section="tasks"
        >
          <div className="content-card">
            <div className="employee-header">
              <div>
                <h2 className="content-title">Assign Task</h2>
                <p className="helper">Assign tasks and track progress.</p>
              </div>
              <button className="btn-primary" type="button" onClick={handleToggleTaskForm}>
                Assign Task
              </button>
            </div>
            {taskError ? (
              <div className="notice">{taskError}</div>
            ) : tasks.length === 0 ? (
              <div className="notice">No tasks assigned yet.</div>
            ) : (
              <div className="task-list">
                {tasks.map((task) => {
                  const statusTone = getTaskStatusTone(task.status);
                  const dueTone = getTaskDueTone(task);
                  const employeeName = task.employee?.name || 'Unknown';
                  const employeeEmail = task.employee?.email || '';
                  const initials = getTaskInitials(employeeName);
                  return (
                    <article className="task-card" key={task.id}>
                      <div className="task-card-top">
                        <span className={`task-pill ${statusTone}`}>
                          {formatStatus(task.status)}
                        </span>
                      </div>
                      <div className="task-avatar" aria-hidden="true">
                        {initials}
                      </div>
                      <h3 className="task-employee">{employeeName}</h3>
                      <p className="task-email">{employeeEmail || 'No email'}</p>
                      <p className="task-details">{task.details || '-'}</p>
                      <div className="task-meta">
                        <div className="task-meta-item">
                          <span>Due</span>
                          <strong className={`task-due ${dueTone}`}>{getTaskDueText(task)}</strong>
                        </div>
                        <div className="task-meta-item">
                          <span>Assigned</span>
                          <strong>{formatDateTime(task.createdAt)}</strong>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section
          className={`section ${activeSection === 'policies' ? 'active' : ''}`}
          data-section="policies"
        >
          <div className="content-card">
            <h2 className="content-title">Company Policies</h2>
            <ul className="policy-list">
              <li>Code of Conduct</li>
              <li>Leave & Attendance Guidelines</li>
              <li>Security & Data Access</li>
              <li>Remote Work Policy</li>
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}


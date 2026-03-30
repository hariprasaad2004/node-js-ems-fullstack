import { useEffect, useMemo, useRef, useState } from 'react';
import { apiRequest, readJson } from '../api/client.js';
import Sidebar from '../components/Sidebar.jsx';
import { useBodyClass } from '../hooks/useBodyClass.js';
import { formatDate, formatDateTime, formatDuration } from '../utils/format.js';

const navItems = [
  { id: 'profile', label: 'Profile' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'leave', label: 'Leave' },
  { id: 'tasks', label: 'Tasks' }
];

const initialLeaveForm = {
  category: 'casual',
  fromDate: '',
  toDate: '',
  reason: ''
};

const toTime = (value) => {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
};

export default function EmployeeDashboard() { // Employee dashboard UI and data operations.
  useBodyClass('page-dashboard');

  const [activeSection, setActiveSection] = useState('profile');
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState('');
  const [attendance, setAttendance] = useState([]);
  const [attendanceError, setAttendanceError] = useState('');
  const [attendanceStatus, setAttendanceStatus] = useState({ message: '', isError: false });
  const [leaves, setLeaves] = useState([]);
  const [leaveError, setLeaveError] = useState('');
  const [leaveStatus, setLeaveStatus] = useState({ message: '', isError: false });
  const [leaveForm, setLeaveForm] = useState(initialLeaveForm);
  const [tasks, setTasks] = useState([]);
  const [taskError, setTaskError] = useState('');
  const [taskStatus, setTaskStatus] = useState({ message: '', isError: false });
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [isDark, setIsDark] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [lastSeenAt, setLastSeenAt] = useState(0);
  const notificationRef = useRef(null);
  const storageKey = 'ems-employee-lastSeenAt';

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

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return;
    const value = Number(stored);
    if (!Number.isNaN(value)) {
      setLastSeenAt(value);
    }
  }, []);

  useEffect(() => {
    loadProfile();
    loadAttendance();
    loadLeaves();
    loadTasks();
  }, []);

  const notifications = useMemo(() => {
    const items = [];

    tasks.forEach((task) => {
      const time = toTime(task.createdAt) || toTime(task.dueAt);
      items.push({
        id: `task-${task.id}`,
        type: 'task',
        title: 'New task assigned',
        description: task.details || 'Task assigned by admin.',
        time,
        timeLabel: time ? formatDateTime(time) : '-'
      });
    });

    leaves.forEach((leave) => {
      if (leave.status !== 'approved' && leave.status !== 'rejected') return;
      const time = toTime(leave.updatedAt) || toTime(leave.createdAt);
      const statusLabel = leave.status === 'approved' ? 'approved' : 'rejected';
      items.push({
        id: `leave-${leave.id}-${statusLabel}`,
        type: 'leave',
        title: `Leave request ${statusLabel}`,
        description: `${formatDate(leave.fromDate)} - ${formatDate(leave.toDate)}`,
        time,
        timeLabel: time ? formatDateTime(time) : '-'
      });
    });

    return items.sort((a, b) => b.time - a.time).slice(0, 8);
  }, [tasks, leaves]);

  const unreadNotifications = useMemo(() => {
    return notifications.filter((item) => item.time > lastSeenAt);
  }, [notifications, lastSeenAt]);

  const unreadCount = unreadNotifications.length;

  const attendanceStats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - 6);

    let totalMinutes = 0;
    let weekMinutes = 0;
    let days = 0;
    let lastCheckIn = 0;
    let lastCheckOut = 0;

    attendance.forEach((record) => {
      const checkIn = toTime(record.checkInAt);
      const checkOut = toTime(record.checkOutAt);
      if (checkIn) lastCheckIn = Math.max(lastCheckIn, checkIn);
      if (checkOut) lastCheckOut = Math.max(lastCheckOut, checkOut);
      if (checkIn && checkOut) {
        const minutes = Math.max(0, Math.round((checkOut - checkIn) / 60000));
        totalMinutes += minutes;
        days += 1;
        if (checkIn >= weekStart.getTime()) {
          weekMinutes += minutes;
        }
      }
    });

    return { totalMinutes, weekMinutes, days, lastCheckIn, lastCheckOut };
  }, [attendance]);

  const taskSummary = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(
      (task) => (task.status || '').toLowerCase() === 'completed'
    ).length;
    const pending = Math.max(0, total - completed);
    const completionRate = total ? Math.round((completed / total) * 100) : 0;
    return { total, completed, pending, completionRate };
  }, [tasks]);

  const formatHours = (minutes) => {
    if (!minutes) return '0.0';
    return (minutes / 60).toFixed(1);
  };

  useEffect(() => {
    if (!showNotifications) return undefined;
    const handleClick = (event) => {
      if (!notificationRef.current) return;
      if (notificationRef.current.contains(event.target)) return;
      handleCloseNotifications();
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [showNotifications]);

  const markNotificationsSeen = () => {
    const now = Date.now();
    setLastSeenAt(now);
    window.localStorage.setItem(storageKey, String(now));
  };

  const handleCloseNotifications = () => {
    setShowNotifications(false);
    markNotificationsSeen();
  };

  const handleToggleNotifications = () => {
    setShowNotifications((prev) => {
      const next = !prev;
      if (prev && !next) {
        markNotificationsSeen();
      }
      return next;
    });
  };

  async function loadProfile() { // Fetch employee profile.
    setProfileError('');
    const res = await apiRequest('/api/employee/me');
    const data = await readJson(res);

    if (!res.ok) {
      setProfileError(data?.message || 'No profile found.');
      setProfile(null);
      return;
    }

    setProfile(data);
  }

  async function loadAttendance() { // Fetch employee attendance records.
    setAttendanceError('');
    const res = await apiRequest('/api/employee/attendance');
    const data = await readJson(res);

    if (!res.ok) {
      setAttendanceError(data?.message || 'Failed to load attendance.');
      setAttendance([]);
      return;
    }

    setAttendance(Array.isArray(data) ? data : []);
  }

  async function loadLeaves() { // Fetch employee leave requests.
    setLeaveError('');
    const res = await apiRequest('/api/employee/leave');
    const data = await readJson(res);

    if (!res.ok) {
      setLeaveError(data?.message || 'Failed to load leave requests.');
      setLeaves([]);
      return;
    }

    setLeaves(Array.isArray(data) ? data : []);
  }

  async function loadTasks() { // Fetch employee tasks.
    setTaskError('');
    const res = await apiRequest('/api/employee/tasks');
    const data = await readJson(res);

    if (!res.ok) {
      setTaskError(data?.message || 'Failed to load tasks.');
      setTasks([]);
      return;
    }

    setTasks(Array.isArray(data) ? data : []);
  }

  const handleLeaveChange = (event) => { // Track leave form input changes.
    const { name, value } = event.target;
    setLeaveForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCheckIn = async () => { // Record employee check-in.
    setAttendanceStatus({ message: 'Checking in...', isError: false });
    const res = await apiRequest('/api/employee/attendance/check-in', { method: 'POST' });
    const data = await readJson(res);

    if (!res.ok) {
      setAttendanceStatus({ message: data?.message || 'Failed to check in.', isError: true });
      return;
    }

    if (data?.message) {
      const suffix = data.checkInAt ? ` at ${formatDateTime(data.checkInAt)}` : '';
      setAttendanceStatus({ message: `${data.message}${suffix}`, isError: false });
    } else {
      setAttendanceStatus({
        message: `Checked in at ${formatDateTime(data.checkInAt)}.`,
        isError: false
      });
    }
    await loadAttendance();
  };

  const handleCheckOut = async () => { // Record employee check-out.
    setAttendanceStatus({ message: 'Checking out...', isError: false });
    const res = await apiRequest('/api/employee/attendance/check-out', { method: 'POST' });
    const data = await readJson(res);

    if (!res.ok) {
      setAttendanceStatus({ message: data?.message || 'Failed to check out.', isError: true });
      return;
    }

    if (data?.message) {
      const suffix = data.checkOutAt ? ` at ${formatDateTime(data.checkOutAt)}` : '';
      setAttendanceStatus({ message: `${data.message}${suffix}`, isError: false });
    } else {
      setAttendanceStatus({
        message: `Checked out at ${formatDateTime(data.checkOutAt)}.`,
        isError: false
      });
    }
    await loadAttendance();
  };

  const handleLeaveSubmit = async (event) => { // Submit a leave request.
    event.preventDefault();
    setLeaveStatus({ message: 'Submitting...', isError: false });

    if (!leaveForm.fromDate || !leaveForm.toDate) {
      setLeaveStatus({ message: 'Select both From and To dates.', isError: true });
      return;
    }

    if (leaveForm.category === 'casual') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const fromDay = new Date(leaveForm.fromDate);
      fromDay.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((fromDay - today) / (1000 * 60 * 60 * 24));
      const casualLeadDays = 2;
      if (diffDays < casualLeadDays) {
        setModalMessage(
          'Casual leave must be requested at least 2 days in advance. Please choose a later date or another category.'
        );
        setModalOpen(true);
        setLeaveStatus({ message: 'Casual leave needs 2 days advance notice.', isError: true });
        return;
      }
    }

    const payload = {
      category: leaveForm.category,
      fromDate: leaveForm.fromDate,
      toDate: leaveForm.toDate,
      reason: leaveForm.reason.trim()
    };

    const res = await apiRequest('/api/employee/leave', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const data = await readJson(res);

    if (!res.ok) {
      setLeaveStatus({ message: data?.message || 'Failed to submit leave request.', isError: true });
      return;
    }

    setLeaveStatus({ message: 'Leave request submitted.', isError: false });
    setLeaveForm(initialLeaveForm);
    await loadLeaves();
  };

  const handleTaskStatusChange = async (taskId, nextStatus) => { // Update task status.
    const res = await apiRequest(`/api/employee/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: nextStatus })
    });
    const data = await readJson(res);

    if (!res.ok) {
      setTaskStatus({ message: data?.message || 'Failed to update task status.', isError: true });
      await loadTasks();
      return;
    }

    setTasks((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, status: data.status } : task))
    );
    setTaskStatus({ message: 'Task status updated.', isError: false });
  };

  const handleLogout = async () => { // Logout and redirect to login.
    await apiRequest('/logout', {
      method: 'POST',
      body: JSON.stringify({ role: 'employee' })
    });
    window.location.assign('/login');
  };

  return (
    <>
      <div className="dashboard">
        <Sidebar
          title="Employee"
          items={navItems}
          activeSection={activeSection}
          onSelect={setActiveSection}
          onLogout={handleLogout}
        />

        <main className="content">
          <div className="content-card page-hero">
            <div className="toolbar">
              <div>
                <h1 className="page-title">Employee Dashboard</h1>
                <p className="helper">View your profile and update personal contact info.</p>
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
                <div className="notification-wrapper" ref={notificationRef}>
                  <button
                    className={`icon-button ${showNotifications ? 'is-open' : ''}`}
                    type="button"
                    aria-label="Notifications"
                    aria-expanded={showNotifications}
                    onClick={handleToggleNotifications}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M12 3a6 6 0 0 0-6 6v2.2c0 .7-.28 1.37-.78 1.86L4 14.3V16h16v-1.7l-1.22-1.24a2.64 2.64 0 0 1-.78-1.86V9a6 6 0 0 0-6-6Zm0 18a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 21Z"
                        fill="currentColor"
                      />
                    </svg>
                    {unreadCount > 0 ? (
                      <span className="icon-badge">{unreadCount}</span>
                    ) : null}
                  </button>
                  {showNotifications ? (
                    <div className="notification-panel" role="dialog" aria-label="Notifications">
                      <div className="notification-header">
                        <span>Notifications</span>
                        <span className="notification-total">
                          {unreadNotifications.length}
                        </span>
                      </div>
                      {unreadNotifications.length === 0 ? (
                        <p className="helper">No notifications yet.</p>
                      ) : (
                        <div className="notification-list">
                          {unreadNotifications.map((item) => (
                            <div
                              className="notification-item"
                              data-type={item.type}
                              key={item.id}
                            >
                              <div className="notification-text">
                                <div className="notification-title">{item.title}</div>
                                <div className="notification-desc">{item.description}</div>
                              </div>
                              <div className="notification-time">{item.timeLabel}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
                <div className="admin-profile" aria-label="Employee profile">
                  <div className="admin-avatar">
                    {profile?.name ? profile.name.charAt(0).toUpperCase() : 'E'}
                  </div>
                  <div className="admin-meta">
                    <span className="admin-name">{profile?.name || 'Employee'}</span>
                    <span className="admin-role">
                      ID: {profile?.id ? profile.id.slice(-6).toUpperCase() : '—'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <section
            className={`section ${activeSection === 'profile' ? 'active' : ''}`}
            data-section="profile"
          >
            <div className="content-card">
              <h2 className="content-title">Work Overview</h2>
              <p className="helper">Your total hours, weekly focus, and task progress.</p>
              {profileError ? <div className="notice">{profileError}</div> : null}

              <div className="stats">
                <div className="stat-card">
                  <div className="metric-label">Total Hours</div>
                  <div className="stat-value">
                    {formatHours(attendanceStats.totalMinutes)}h
                  </div>
                  <div className="helper">All time</div>
                </div>
                <div className="stat-card">
                  <div className="metric-label">This Week</div>
                  <div className="stat-value">
                    {formatHours(attendanceStats.weekMinutes)}h
                  </div>
                  <div className="helper">Last 7 days</div>
                </div>
                <div className="stat-card">
                  <div className="metric-label">Avg / Day</div>
                  <div className="stat-value">
                    {formatHours(
                      attendanceStats.days
                        ? attendanceStats.totalMinutes / attendanceStats.days
                        : 0
                    )}
                    h
                  </div>
                  <div className="helper">{attendanceStats.days} days tracked</div>
                </div>
                <div className="stat-card">
                  <div className="metric-label">Tasks Done</div>
                  <div className="stat-value">{taskSummary.completed}</div>
                  <div className="helper">{taskSummary.pending} pending</div>
                </div>
              </div>

              <div className="overview-card employee-insights">
                <div className="overview-card-header">
                  <h3>Work Insights</h3>
                  <span className="helper">Progress snapshot</span>
                </div>
                <div className="stat-performance">
                  <div className="stat-performance-header">
                    <span>Task Completion</span>
                    <strong>{taskSummary.completionRate}%</strong>
                  </div>
                  <div
                    className="stat-bar"
                    style={{ '--percent': taskSummary.completionRate }}
                  >
                    <span className="stat-bar-fill" />
                  </div>
                </div>
                <div className="stat-row">
                  <div>
                    <span>Completed</span>
                    <strong>{taskSummary.completed}</strong>
                  </div>
                  <div>
                    <span>Pending</span>
                    <strong>{taskSummary.pending}</strong>
                  </div>
                </div>
                <div className="stat-next">
                  Last check-in:{' '}
                  {attendanceStats.lastCheckIn
                    ? formatDateTime(attendanceStats.lastCheckIn)
                    : '-'}
                </div>
                <div className="stat-next">
                  Last check-out:{' '}
                  {attendanceStats.lastCheckOut
                    ? formatDateTime(attendanceStats.lastCheckOut)
                    : '-'}
                </div>
              </div>
            </div>
          </section>

          <section
            className={`section ${activeSection === 'attendance' ? 'active' : ''}`}
            data-section="attendance"
          >
            <div className="content-card">
              <h2 className="content-title">Attendance</h2>
              <div className="action-row">
                <button className="btn-primary" type="button" onClick={handleCheckIn}>
                  Check In
                </button>
                <button className="btn-ghost" type="button" onClick={handleCheckOut}>
                  Check Out
                </button>
              </div>
              <p
                className="helper"
                style={{ color: attendanceStatus.isError ? '#c13e2d' : '#0e7c7b' }}
              >
                {attendanceStatus.message}
              </p>
              <table className="table table-responsive">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Check In</th>
                    <th>Check Out</th>
                    <th>Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceError ? (
                    <tr>
                      <td colSpan="4">{attendanceError}</td>
                    </tr>
                  ) : attendance.length === 0 ? (
                    <tr>
                      <td colSpan="4">No attendance yet.</td>
                    </tr>
                  ) : (
                    attendance.map((record) => (
                    <tr key={record.id}>
                      <td data-label="Date">{record.date}</td>
                      <td data-label="Check In">{formatDateTime(record.checkInAt)}</td>
                      <td data-label="Check Out">{formatDateTime(record.checkOutAt)}</td>
                      <td data-label="Hours">
                        {formatDuration(record.checkInAt, record.checkOutAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
          </section>

          <section
            className={`section ${activeSection === 'leave' ? 'active' : ''}`}
            data-section="leave"
          >
            <div className="content-card">
              <h2 className="content-title">Leave Request</h2>
              <form className="form-grid" onSubmit={handleLeaveSubmit}>
                <div>
                  <label htmlFor="leave-category">Category</label>
                  <select
                    id="leave-category"
                    name="category"
                    value={leaveForm.category}
                    onChange={handleLeaveChange}
                  >
                    <option value="sick">Sick</option>
                    <option value="casual">Casual</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="leave-from">From</label>
                  <input
                    id="leave-from"
                    name="fromDate"
                    type="date"
                    value={leaveForm.fromDate}
                    onChange={handleLeaveChange}
                  />
                </div>
                <div>
                  <label htmlFor="leave-to">To</label>
                  <input
                    id="leave-to"
                    name="toDate"
                    type="date"
                    value={leaveForm.toDate}
                    onChange={handleLeaveChange}
                  />
                </div>
                <div>
                  <label htmlFor="leave-reason">Reason</label>
                  <textarea
                    id="leave-reason"
                    name="reason"
                    placeholder="Reason for leave"
                    value={leaveForm.reason}
                    onChange={handleLeaveChange}
                  />
                </div>
                <button className="btn-primary" type="submit">
                  Submit
                </button>
                <p
                  className="helper"
                  style={{ color: leaveStatus.isError ? '#c13e2d' : '#0e7c7b' }}
                >
                  {leaveStatus.message}
                </p>
              </form>
              <table className="table table-responsive">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Status</th>
                    <th>Requested</th>
                  </tr>
                </thead>
                <tbody>
                  {leaveError ? (
                    <tr>
                      <td colSpan="5">{leaveError}</td>
                    </tr>
                  ) : leaves.length === 0 ? (
                    <tr>
                      <td colSpan="5">No leave requests yet.</td>
                    </tr>
                  ) : (
                    leaves.map((leave) => (
                    <tr key={leave.id}>
                      <td data-label="Category">{leave.category || 'casual'}</td>
                      <td data-label="From">{formatDate(leave.fromDate)}</td>
                      <td data-label="To">{formatDate(leave.toDate)}</td>
                      <td data-label="Status">{leave.status}</td>
                      <td data-label="Requested">{formatDateTime(leave.createdAt)}</td>
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
              <h2 className="content-title">My Tasks</h2>
              <table className="table table-responsive">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Status</th>
                    <th>Due Time</th>
                    <th>Assigned By</th>
                    <th>Assigned On</th>
                  </tr>
                </thead>
                <tbody>
                  {taskError ? (
                    <tr>
                      <td colSpan="5">{taskError}</td>
                    </tr>
                  ) : tasks.length === 0 ? (
                    <tr>
                      <td colSpan="5">No tasks assigned yet.</td>
                    </tr>
                  ) : (
                    tasks.map((task) => {
                      const assignedBy = task.assignedBy
                        ? `${task.assignedBy.name || 'Admin'} (${task.assignedBy.email || ''})`
                        : 'Admin';
                      const statusValue = task.status || 'planning';
                      return (
                        <tr key={task.id}>
                          <td data-label="Task">{task.details}</td>
                          <td data-label="Status">
                            <select
                              value={statusValue}
                              onChange={(event) =>
                                handleTaskStatusChange(task.id, event.target.value)
                              }
                            >
                              <option value="planning">Planning</option>
                              <option value="processing">Processing</option>
                              <option value="completed">Completed</option>
                            </select>
                          </td>
                          <td data-label="Due Time">{formatDateTime(task.dueAt)}</td>
                          <td data-label="Assigned By">{assignedBy}</td>
                          <td data-label="Assigned On">{formatDateTime(task.createdAt)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
              <p
                className="helper"
                style={{ color: taskStatus.isError ? '#c13e2d' : '#0e7c7b' }}
              >
                {taskStatus.message}
              </p>
            </div>
          </section>
        </main>
      </div>

      <div className={`modal ${modalOpen ? 'active' : ''}`} aria-hidden={!modalOpen}>
        <div className="modal-backdrop" onClick={() => setModalOpen(false)} />
        <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="leave-modal-title">
          <h3 id="leave-modal-title">Leave Request Notice</h3>
          <p className="helper">{modalMessage}</p>
          <button className="btn-primary" type="button" onClick={() => setModalOpen(false)}>
            Okay
          </button>
        </div>
      </div>
    </>
  );
}


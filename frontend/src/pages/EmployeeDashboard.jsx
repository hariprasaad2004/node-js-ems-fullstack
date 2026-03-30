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

  const taskTiming = useMemo(() => {
    let total = 0;
    let onTime = 0;
    let late = 0;
    tasks.forEach((task) => {
      if ((task.status || '').toLowerCase() !== 'completed') return;
      const dueAt = toTime(task.dueAt);
      const completedAt = toTime(task.completedAt) || toTime(task.updatedAt);
      if (!dueAt || !completedAt) return;
      total += 1;
      if (completedAt <= dueAt) {
        onTime += 1;
      } else {
        late += 1;
      }
    });
    const percent = total ? Math.round((onTime / total) * 100) : 0;
    return { total, onTime, late, percent };
  }, [tasks]);

  const formatHours = (minutes) => {
    if (!minutes) return '0.0';
    return (minutes / 60).toFixed(1);
  };

  const formatDateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const attendanceByDate = useMemo(() => {
    const map = new Map();
    attendance.forEach((record) => {
      if (record.date) {
        map.set(record.date, record);
      }
    });
    return map;
  }, [attendance]);

  const approvedLeaveDates = useMemo(() => {
    const set = new Set();
    leaves.forEach((leave) => {
      if (leave.status !== 'approved') return;
      const start = new Date(leave.fromDate);
      const end = new Date(leave.toDate);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      for (let day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
        const key = formatDateKey(day);
        set.add(key);
      }
    });
    return set;
  }, [leaves]);

  const tasksCompletedByDate = useMemo(() => {
    const map = new Map();
    tasks.forEach((task) => {
      if ((task.status || '').toLowerCase() !== 'completed') return;
      const completedAt = toTime(task.completedAt) || toTime(task.updatedAt);
      if (!completedAt) return;
      const key = formatDateKey(new Date(completedAt));
      const list = map.get(key) || [];
      list.push(task);
      map.set(key, list);
    });
    return map;
  }, [tasks]);

  const calendarDays = useMemo(() => {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const monthLabel = today.toLocaleString(undefined, { month: 'long', year: 'numeric' });
    const startWeekday = monthStart.getDay();
    const daysInMonth = monthEnd.getDate();
    const todayKey = formatDateKey(today);
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const now = new Date();
    const nowHour = now.getHours() + now.getMinutes() / 60;

    const cells = [];
    for (let i = 0; i < startWeekday; i += 1) {
      cells.push({ key: `empty-${i}`, empty: true });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(today.getFullYear(), today.getMonth(), day);
      const key = formatDateKey(date);
      const record = attendanceByDate.get(key);
      const onLeave = approvedLeaveDates.has(key);
      const tasksDone = tasksCompletedByDate.get(key) || [];
      const isToday = key === todayKey;
      const isPast = date < todayStart;
      const isFuture = date > todayStart;

      let status = 'pending';
      let mark = '';
      let tooltip = '';
      let details = null;

      if (onLeave) {
        status = 'leave';
        mark = '\u2715';
        tooltip = 'Leave approved';
      } else if (record?.checkInAt) {
        const checkInDate = new Date(record.checkInAt);
        const checkInHour = checkInDate.getHours() + checkInDate.getMinutes() / 60;
        const withinWindow = checkInHour >= 9 && checkInHour <= 19;
        status = withinWindow ? 'present' : 'absent';
        mark = withinWindow ? '\u2713' : '\u2715';
        tooltip = withinWindow ? 'Present' : 'Absent';
        const hasCheckout = Boolean(record.checkOutAt);
        const workedLabel = hasCheckout
          ? formatDuration(record.checkInAt, record.checkOutAt)
          : 'In progress';
        details = {
          checkInLabel: formatDateTime(record.checkInAt),
          checkOutLabel: hasCheckout ? formatDateTime(record.checkOutAt) : 'In progress',
          workedLabel,
          tasksDone
        };
      } else if (isPast || (isToday && nowHour >= 19)) {
        status = 'absent';
        mark = '\u2715';
        tooltip = 'Absent';
      } else if (isFuture) {
        status = 'pending';
      }

      if (!details && tasksDone.length) {
        details = {
          checkInLabel: '-',
          checkOutLabel: '-',
          workedLabel: '-',
          tasksDone
        };
      }

      cells.push({
        key,
        date,
        day,
        status,
        mark,
        tooltip,
        details,
        isToday,
        empty: false
      });
    }

    return { monthLabel, cells };
  }, [attendanceByDate, approvedLeaveDates, tasksCompletedByDate, formatDateTime, formatDuration]);

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
                <div className="stat-performance">
                  <div className="stat-performance-header">
                    <span>On-Time Accuracy</span>
                    <strong>{taskTiming.percent}%</strong>
                  </div>
                  <div className="stat-bar" style={{ '--percent': taskTiming.percent }}>
                    <span className="stat-bar-fill" />
                  </div>
                </div>
                {taskTiming.total > 0 ? (
                  <div className="stat-row">
                    <div>
                      <span>On Time</span>
                      <strong>{taskTiming.onTime}</strong>
                    </div>
                    <div>
                      <span>Late</span>
                      <strong>{taskTiming.late}</strong>
                    </div>
                  </div>
                ) : (
                  <div className="helper">No due-date completions yet.</div>
                )}
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
              {attendanceError ? (
                <div className="notice">{attendanceError}</div>
              ) : (
                <div className="attendance-calendar">
                  <div className="calendar-header">
                    <div>
                      <h3>{calendarDays.monthLabel}</h3>
                      <p className="helper">
                        Present (9am - 7pm) - Absent/Leave
                      </p>
                    </div>
                  </div>
                  <div className="calendar-weekdays">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                      <span key={day}>{day}</span>
                    ))}
                  </div>
                  <div className="calendar-grid">
                    {calendarDays.cells.map((cell) => (
                      <div
                        key={cell.key}
                        className={`calendar-cell ${cell.empty ? 'is-empty' : ''} ${
                          cell.status ? `is-${cell.status}` : ''
                        } ${cell.isToday ? 'is-today' : ''}`}
                        title={cell.details ? '' : cell.tooltip || ''}
                      >
                        {cell.empty ? null : (
                          <>
                            <span className="calendar-date">{cell.day}</span>
                            <span className="calendar-mark">{cell.mark}</span>
                            {cell.details ? (
                              <div className="calendar-tooltip" role="tooltip">
                                <div className="tooltip-title">
                                  {formatDate(cell.date)}
                                </div>
                                <div className="tooltip-row">
                                  <span>Check in</span>
                                  <strong>{cell.details.checkInLabel}</strong>
                                </div>
                                <div className="tooltip-row">
                                  <span>Check out</span>
                                  <strong>{cell.details.checkOutLabel}</strong>
                                </div>
                                <div className="tooltip-row">
                                  <span>Working hours</span>
                                  <strong>{cell.details.workedLabel}</strong>
                                </div>
                                <div className="tooltip-subtitle">Tasks done</div>
                                {cell.details.tasksDone.length ? (
                                  <ul className="tooltip-list">
                                    {cell.details.tasksDone.slice(0, 3).map((task) => (
                                      <li key={task.id}>
                                        {task.details || 'Task completed'}
                                      </li>
                                    ))}
                                    {cell.details.tasksDone.length > 3 ? (
                                      <li className="tooltip-muted">
                                        +{cell.details.tasksDone.length - 3} more
                                      </li>
                                    ) : null}
                                  </ul>
                                ) : (
                                  <div className="tooltip-empty">No tasks completed.</div>
                                )}
                              </div>
                            ) : null}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
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


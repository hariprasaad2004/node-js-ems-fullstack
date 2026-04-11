import { useEffect, useMemo, useRef, useState } from 'react';
import { apiRequest, readJson } from '../api/client.js';
import Sidebar from '../components/Sidebar.jsx';
import ChatWidget from '../components/ChatWidget.jsx';
import SettingsModal from '../components/SettingsModal.jsx';
import { useBodyClass } from '../hooks/useBodyClass.js';
import { formatDate, formatDateTime, formatDuration, formatStatus } from '../utils/format.js';

const navItems = [
  { id: 'profile', label: 'Profile' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'leave', label: 'Leave' },
  { id: 'eod', label: 'EOD' },
  { id: 'tasks', label: 'Tasks' }
];

const initialLeaveForm = {
  category: 'casual',
  fromDate: '',
  toDate: '',
  reason: ''
};

const getTodayInput = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const initialEodForm = {
  date: getTodayInput(),
  session1: '',
  session2: '',
  status: 'completed'
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
  const [eods, setEods] = useState([]);
  const [eodError, setEodError] = useState('');
  const [eodStatus, setEodStatus] = useState({ message: '', isError: false });
  const [eodForm, setEodForm] = useState(initialEodForm);
  const [tasks, setTasks] = useState([]);
  const [taskError, setTaskError] = useState('');
  const [taskStatus, setTaskStatus] = useState({ message: '', isError: false });
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [isDark] = useState(true); // locked dark theme
  const [showNotifications, setShowNotifications] = useState(false);
  const [lastSeenAt, setLastSeenAt] = useState(0);
  const notificationRef = useRef(null);
  const storageKey = 'ems-employee-lastSeenAt';

  useEffect(() => {
    const { classList } = document.body;
    classList.add('theme-dark');
    return () => {
      classList.remove('theme-dark');
    };
  }, []);

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
    loadEods();
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

  const eodStats = useMemo(() => {
    const total = eods.length;
    const completed = eods.filter(
      (entry) => (entry.status || '').toLowerCase() === 'completed'
    ).length;
    const inProgress = eods.filter(
      (entry) => (entry.status || '').toLowerCase() === 'in_progress'
    ).length;

    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - 6);
    const last7 = eods.filter((entry) => {
      const value = new Date(entry.date);
      return value >= cutoff;
    });
    const last7Completed = last7.filter(
      (entry) => (entry.status || '').toLowerCase() === 'completed'
    ).length;

    const dateSet = new Set(
      eods.map((entry) => entry.dateKey || formatDateKey(new Date(entry.date)))
    );
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let cursor = new Date(today); dateSet.has(formatDateKey(cursor)); ) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    const completionRate = total ? Math.round((completed / total) * 100) : 0;
    const last7Rate = last7.length ? Math.round((last7Completed / last7.length) * 100) : 0;
    return {
      total,
      completed,
      inProgress,
      completionRate,
      last7Total: last7.length,
      last7Rate,
      streak
    };
  }, [eods]);

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
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
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
        isWeekend,
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

  async function loadEods() { // Fetch employee end-of-day submissions.
    setEodError('');
    const res = await apiRequest('/api/employee/eods');
    const data = await readJson(res);

    if (!res.ok) {
      setEodError(data?.message || 'Failed to load EOD reports.');
      setEods([]);
      return;
    }

    setEods(Array.isArray(data) ? data : []);
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

  const handleEodChange = (event) => { // Track EOD form input changes.
    const { name, value } = event.target;
    setEodForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleEodSubmit = async (event) => { // Submit or update EOD.
    event.preventDefault();
    setEodStatus({ message: 'Submitting...', isError: false });

    if (!eodForm.date) {
      setEodStatus({ message: 'Pick a date first.', isError: true });
      return;
    }

    const payload = {
      date: eodForm.date,
      session1: String(eodForm.session1 || '').trim(),
      session2: String(eodForm.session2 || '').trim(),
      status: eodForm.status || 'completed'
    };

    const res = await apiRequest('/api/employee/eods', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const data = await readJson(res);

    if (!res.ok) {
      setEodStatus({ message: data?.message || 'Failed to submit EOD.', isError: true });
      return;
    }

    setEodStatus({ message: 'EOD saved.', isError: false });
    setEodForm((prev) => ({ ...initialEodForm, date: prev.date || initialEodForm.date }));
    await loadEods();
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
              <SettingsModal />
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
                <div className="insight-grid">
                  <div className="insight-card">
                    <div className="insight-header">
                      <span className="metric-label">Task Completion</span>
                      <span className="helper">Completed vs pending</span>
                    </div>
                    <div
                      className="progress-ring"
                      style={{ '--percent': taskSummary.completionRate, '--ring': 'var(--accent)' }}
                    >
                      <span className="progress-ring-value">
                        {taskSummary.completionRate}%
                      </span>
                    </div>
                    <div className="insight-stat-row">
                      <div>
                        <span>Completed</span>
                        <strong>{taskSummary.completed}</strong>
                      </div>
                      <div>
                        <span>Pending</span>
                        <strong>{taskSummary.pending}</strong>
                      </div>
                    </div>
                  </div>
                  <div className="insight-card">
                    <div className="insight-header">
                      <span className="metric-label">On-Time Accuracy</span>
                      <span className="helper">Tasks finished on time</span>
                    </div>
                    <div
                      className="progress-ring"
                      style={{ '--percent': taskTiming.percent, '--ring': 'var(--success)' }}
                    >
                      <span className="progress-ring-value">
                        {taskTiming.percent}%
                      </span>
                    </div>
                    {taskTiming.total > 0 ? (
                      <div className="insight-stat-row">
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
                        } ${cell.isToday ? 'is-today' : ''} ${
                          cell.isWeekend ? 'is-weekend' : ''
                        }`}
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
            className={`section ${activeSection === 'eod' ? 'active' : ''}`}
            data-section="eod"
          >
            <div className="grid-2">
              <div className="content-card">
                <div className="employee-header">
                  <div>
                    <h2 className="content-title">End of Day Report</h2>
                    <p className="helper">Capture forenoon, afternoon, and completion status.</p>
                  </div>
                </div>

                <div className="insight-row">
                  <div className="insight-chip">
                    <span>Completion rate</span>
                    <strong>{eodStats.completionRate}%</strong>
                  </div>
                  <div className="insight-chip">
                    <span>Last 7 days</span>
                    <strong>{eodStats.last7Rate}%</strong>
                  </div>
                  <div className="insight-chip">
                    <span>Streak</span>
                    <strong>{eodStats.streak} days</strong>
                  </div>
                  <div className="insight-chip">
                    <span>Open</span>
                    <strong>{eodStats.inProgress}</strong>
                  </div>
                </div>

                <form className="form-grid" onSubmit={handleEodSubmit}>
                  <div>
                    <label htmlFor="eod-date">Date</label>
                    <input
                      id="eod-date"
                      name="date"
                      type="date"
                      value={eodForm.date}
                      onChange={handleEodChange}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="eod-status">Result Status</label>
                    <select
                      id="eod-status"
                      name="status"
                      value={eodForm.status}
                      onChange={handleEodChange}
                    >
                      <option value="completed">Completed</option>
                      <option value="in_progress">In Progress</option>
                    </select>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label htmlFor="eod-session1">Session 1 (Forenoon)</label>
                    <textarea
                      id="eod-session1"
                      name="session1"
                      placeholder="What did you achieve before lunch?"
                      value={eodForm.session1}
                      onChange={handleEodChange}
                      rows="3"
                    />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label htmlFor="eod-session2">Session 2 (Afternoon)</label>
                    <textarea
                      id="eod-session2"
                      name="session2"
                      placeholder="What did you complete after lunch?"
                      value={eodForm.session2}
                      onChange={handleEodChange}
                      rows="3"
                    />
                  </div>
                  <button className="btn-primary" type="submit">
                    Submit EOD
                  </button>
                  <p
                    className="helper"
                    style={{ color: eodStatus.isError ? '#c13e2d' : '#0e7c7b' }}
                  >
                    {eodStatus.message}
                  </p>
                </form>
              </div>

              <div className="content-card">
                <div className="employee-header">
                  <div>
                    <h2 className="content-title">EOD Timeline</h2>
                    <p className="helper">Recent submissions with both sessions.</p>
                  </div>
                </div>
                {eodError ? (
                  <div className="notice">{eodError}</div>
                ) : eods.length === 0 ? (
                  <div className="notice">Submit your first EOD to start the log.</div>
                ) : (
                  <div className="eod-timeline">
                    {eods.map((entry) => {
                      const statusTone =
                        (entry.status || '').toLowerCase() === 'completed'
                          ? 'status-completed'
                          : 'status-pending';
                      return (
                        <article className="eod-card" key={entry.id}>
                          <div className="eod-card-top">
                            <div>
                              <div className="eod-date">{formatDate(entry.date)}</div>
                              <span className={`pill ${statusTone}`}>
                                {formatStatus(entry.status)}
                              </span>
                            </div>
                            <div className="eod-meta">{formatDateTime(entry.createdAt)}</div>
                          </div>
                          <div className="eod-body">
                            <div className="eod-session">
                              <span>Session 1</span>
                              <p>{entry.session1 || 'Not filled'}</p>
                            </div>
                            <div className="eod-session">
                              <span>Session 2</span>
                              <p>{entry.session2 || 'Not filled'}</p>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section
            className={`section ${activeSection === 'tasks' ? 'active' : ''}`}
            data-section="tasks"
          >
            <div className="content-card">
              <h2 className="content-title">My Tasks</h2>
              {taskError ? (
                <div className="notice">{taskError}</div>
              ) : tasks.length === 0 ? (
                <div className="notice">No tasks assigned yet.</div>
              ) : (
                <div className="task-card-grid">
                  {tasks.map((task) => {
                    const assignedBy = task.assignedBy
                      ? `${task.assignedBy.name || 'Admin'} (${task.assignedBy.email || ''})`
                      : 'Admin';
                    const statusValue = task.status || 'planning';
                    return (
                      <div className="task-card" key={task.id}>
                        <div className="task-card-header">
                          <div>
                            <div className="task-title">{task.details}</div>
                            <div className="task-meta">
                              Due: {formatDateTime(task.dueAt) || '-'}
                            </div>
                          </div>
                          <select
                            className="task-status"
                            value={statusValue}
                            onChange={(event) =>
                              handleTaskStatusChange(task.id, event.target.value)
                            }
                          >
                            <option value="planning">Planning</option>
                            <option value="processing">Processing</option>
                            <option value="completed">Completed</option>
                          </select>
                        </div>
                        <div className="task-card-row">
                          <span>Assigned By</span>
                          <strong>{assignedBy}</strong>
                        </div>
                        <div className="task-card-row">
                          <span>Assigned On</span>
                          <strong>{formatDateTime(task.createdAt) || '-'}</strong>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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
      <ChatWidget />
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


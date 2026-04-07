import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar.jsx';
import { apiRequest, readJson } from '../api/client.js';
import { useBodyClass } from '../hooks/useBodyClass.js';
import { formatDate, formatDateTime, formatEmployeeLabel, formatStatus } from '../utils/format.js';

const navItems = [
  { id: 'overview', label: 'Overview' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'leave', label: 'Leave' },
  { id: 'task-monitor', label: 'Task Monitor' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'team', label: 'Team' },
  { id: 'eod', label: 'EOD' }
];

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

const getInitial = (name = '') => {
  const trimmed = String(name).trim();
  if (!trimmed) return 'M';
  return trimmed.charAt(0).toUpperCase();
};

const getTaskDate = (task) => {
  if (task?.dueAt) return new Date(task.dueAt);
  if (task?.createdAt) return new Date(task.createdAt);
  return null;
};

const getTaskStatusTone = (status = '') => {
  const value = status.toLowerCase();
  if (value === 'completed') return 'status-completed';
  if (value === 'pending') return 'status-pending';
  if (value === 'planning') return 'status-planning';
  if (value === 'processing' || value === 'in-progress' || value === 'in_progress')
    return 'status-progress';
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

export default function ManagerDashboard() { // Manager view focused on oversight/approvals.
  useBodyClass('page-dashboard');

  const [activeSection, setActiveSection] = useState('overview');
  const [isDark] = useState(true); // lock to dark theme like admin/employee
  const [employees, setEmployees] = useState([]);
  const [employeesError, setEmployeesError] = useState('');
  const [attendance, setAttendance] = useState([]);
  const [attendanceError, setAttendanceError] = useState('');
  const [leaves, setLeaves] = useState([]);
  const [leaveError, setLeaveError] = useState('');
  const [leaveStatus, setLeaveStatus] = useState('');
  const [tasks, setTasks] = useState([]);
  const [taskError, setTaskError] = useState('');
  const [eods, setEods] = useState([]);
  const [eodSummary, setEodSummary] = useState(null);
  const [eodError, setEodError] = useState('');
  const [eodForm, setEodForm] = useState(initialEodForm);
  const [eodStatus, setEodStatus] = useState({ message: '', isError: false });
  const [refreshing, setRefreshing] = useState(false);
  const visibleTasks = useMemo(() => {
    const notManager = (task) => {
      const role = (task.employee?.role || '').trim().toLowerCase();
      return role !== 'manager';
    };
    return tasks.filter(notManager);
  }, [tasks]);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setRefreshing(true);
    await Promise.all([loadEmployees(), loadAttendance(), loadLeaves(), loadTasks(), loadEods()]);
    setRefreshing(false);
  }

  async function loadEmployees() { // Fetch staff list.
    setEmployeesError('');
    const res = await apiRequest('/api/admin/employees');
    const data = await readJson(res);
    if (!res.ok) {
      setEmployeesError(data?.message || 'Failed to load employees.');
      setEmployees([]);
      return;
    }
    setEmployees(Array.isArray(data) ? data : []);
  }

  async function loadAttendance() { // Fetch attendance summary.
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

  async function loadLeaves() { // Fetch leave requests (pending + history).
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

  async function loadTasks() { // Fetch tasks across the org.
    setTaskError('');
    const res = await apiRequest('/api/admin/tasks');
    const data = await readJson(res);
    if (!res.ok) {
      setTaskError(data?.message || 'Failed to load tasks.');
      setTasks([]);
      return;
    }
    const cleaned = (Array.isArray(data) ? data : []).filter((task) => {
      const role = (task.employee?.role || '').trim().toLowerCase();
      return role !== 'manager';
    });
    setTasks(cleaned);
  }

  async function loadEods() { // Fetch EOD reports and summary.
    setEodError('');
    const res = await apiRequest('/api/admin/eods');
    const data = await readJson(res);
    if (!res.ok) {
      setEodError(data?.message || 'Failed to load EOD reports.');
      setEods([]);
      setEodSummary(null);
      return;
    }
    setEods(Array.isArray(data?.reports) ? data.reports : []);
    setEodSummary(data?.summary || null);
  }

  const handleEodChange = (field) => (event) => { // Track EOD form edits.
    setEodForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleEodSubmit = async (event) => { // Managers can submit their own EOD.
    event.preventDefault();
    setEodStatus({ message: '', isError: false });
    const res = await apiRequest('/api/employee/eods', {
      method: 'POST',
      body: JSON.stringify(eodForm)
    });
    const data = await readJson(res);
    if (!res.ok) {
      setEodStatus({ message: data?.message || 'Failed to submit EOD.', isError: true });
      return;
    }
    setEodStatus({ message: 'EOD saved.', isError: false });
    await loadEods();
  };

  async function handleLeaveAction(id, status) { // Approve or reject leave.
    setLeaveStatus('Updating leave request...');
    const res = await apiRequest(`/api/admin/leave/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
    const data = await readJson(res);
    if (!res.ok) {
      setLeaveStatus(data?.message || 'Update failed.');
      return;
    }
    setLeaveStatus(`Marked as ${status}.`);
    await loadLeaves();
  }

  const stats = useMemo(() => { // Quick org stats.
    const total = employees.length;
    const active = employees.filter((emp) => emp.status === 'active').length;
    const teams = new Set(employees.map((emp) => emp.department || ''));
    const teamCount = teams.has('') ? teams.size - 1 : teams.size;
    const leads = employees.filter((emp) => emp.role === 'teamlead').length;
    return { total, active, inactive: total - active, teamCount, leads };
  }, [employees]);

const attendanceCounts = useMemo(() => {
  const counts = { checked_in: 0, checked_out: 0, not_checked_in: 0 };
  attendance.forEach((row) => {
    counts[row.status] = (counts[row.status] || 0) + 1;
  });
  return counts;
}, [attendance]);

const attendanceChart = useMemo(() => {
  const counts = { present: 0, absent: 0, leave: 0 };
  const dayMap = new Map();
  attendance.forEach((record) => {
    const status = record.status;
    const bucket =
      status === 'checked_in' || status === 'checked_out'
        ? 'present'
        : status === 'on_leave'
          ? 'leave'
          : 'absent';
    counts[bucket] += 1;
    const dateKey = record.date || record.dateKey;
    if (dateKey) {
      const day = dayMap.get(dateKey) || { present: 0, total: 0 };
      if (bucket === 'present') day.present += 1;
      day.total += 1;
      dayMap.set(dateKey, day);
    }
  });
  const total = counts.present + counts.absent + counts.leave;
  const last7 = Array.from(dayMap.entries())
    .sort((a, b) => (a[0] > b[0] ? 1 : -1))
    .slice(-7)
    .map(([day, data]) => ({
      day,
      rate: data.total ? Math.round((data.present / data.total) * 100) : 0
    }));
  return { counts, total, last7 };
}, [attendance]);

const attendanceInsights = useMemo(() => {
  const total = attendance.length;
  const checkedIn = attendance.filter(
    (record) => record.status === 'checked_in' || record.status === 'checked_out'
  ).length;
  const checkedOut = attendance.filter((record) => record.status === 'checked_out').length;
  const missing = attendance.filter((record) => record.status === 'not_checked_in').length;
  const presenceRate = total ? Math.round((checkedIn / total) * 100) : 0;
  return { total, checkedIn, checkedOut, missing, presenceRate };
}, [attendance]);

const eodChart = useMemo(() => { // Last 7 days completion bars.
  const byDate = new Map();
  eods.forEach((entry) => {
    const key = entry.dateKey || (entry.date ? entry.date.slice(0, 10) : '');
    if (!key) return;
    const bucket = byDate.get(key) || { total: 0, completed: 0 };
    bucket.total += 1;
    if ((entry.status || '').toLowerCase() === 'completed') bucket.completed += 1;
    byDate.set(key, bucket);
  });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rows = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const bucket = byDate.get(key) || { total: 0, completed: 0 };
    const pct = bucket.total ? Math.round((bucket.completed / bucket.total) * 100) : 0;
    rows.push({
      key,
      label: `${d.getDate()}/${d.getMonth() + 1}`,
      percent: pct,
      total: bucket.total
    });
  }
  return rows;
}, [eods]);

const eodPeopleChart = useMemo(() => {
  const list = (eodSummary?.perEmployee || []).slice(0, 8);
  return list.map((item) => ({
    label: item.name || 'Employee',
    value: item.completionRate || 0,
    total: item.total || 0
  }));
}, [eodSummary]);

const [taskMonitorStatus, setTaskMonitorStatus] = useState('all');

const taskMonitor = useMemo(() => {
  const now = Date.now();
  const counts = { pending: 0, planning: 0, completed: 0, overdue: 0 };
  const list = visibleTasks.map((task) => {
    const status = (task.status || 'planning').toLowerCase();
    const due = toTime(task.dueAt);
    const isCompleted = status === 'completed';
    const isOverdue = !isCompleted && due && due < now;
    if (status === 'pending') counts.pending += 1;
    else if (status === 'completed') counts.completed += 1;
    else counts.planning += 1;
    if (isOverdue) counts.overdue += 1;
    return { ...task, status, due, isOverdue };
  });

  const filtered =
    taskMonitorStatus === 'all'
      ? list
      : list.filter((task) =>
          taskMonitorStatus === 'overdue' ? task.isOverdue : task.status === taskMonitorStatus
        );

  return { list: filtered, counts, total: list.length };
}, [visibleTasks, taskMonitorStatus]);

const monitorTimeline = useMemo(
  () =>
    [...taskMonitor.list].sort(
      (a, b) => (getTaskDate(b)?.getTime() || 0) - (getTaskDate(a)?.getTime() || 0)
    ),
  [taskMonitor.list]
);

  const pendingLeaves = useMemo(
    () => leaves.filter((leave) => leave.status === 'pending'),
    [leaves]
  );

  const newHires30 = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return employees.filter((emp) => toTime(emp.createdAt) >= cutoff).length;
  }, [employees]);

  const recentHires = useMemo(
    () =>
      employees
        .slice()
        .sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt))
        .slice(0, 4),
    [employees]
  );

const upcomingTasks = useMemo(
  () =>
    visibleTasks
      .filter((task) => {
        const due = toTime(task.dueAt);
        return due && due > Date.now();
      })
      .sort((a, b) => toTime(a.dueAt) - toTime(b.dueAt))
      .slice(0, 4),
  [visibleTasks]
);

  const recentTasks = useMemo(
    () =>
      tasks
        .slice()
        .sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt))
        .slice(0, 6),
    [tasks]
  );

  const overviewRanges = useMemo(() => {
    const now = new Date();
    const startDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const startWeek = new Date(startDay);
    startWeek.setDate(startDay.getDate() - startDay.getDay());
    const endWeek = new Date(startWeek);
    endWeek.setDate(startWeek.getDate() + 7);

    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const summarize = (start, end) => {
      const bucket = visibleTasks.filter((task) => {
        const dueTs = toTime(task.dueAt || task.createdAt);
        return dueTs && dueTs >= start.getTime() && dueTs < end.getTime();
      });
      const completed = bucket.filter((task) => (task.status || '').toLowerCase() === 'completed')
        .length;
      const pending = bucket.length - completed;
      const performance = bucket.length ? Math.round((completed / bucket.length) * 100) : 0;
      return { total: bucket.length, pending, completed, performance };
    };

    const day = summarize(startDay, endDay);
    const week = summarize(startWeek, endWeek);
    const month = summarize(startMonth, endMonth);

    const formatNext = (date) => date.toLocaleString('en-US');

    return {
      day: { ...day, nextRefreshLabel: formatNext(endDay) },
      week: { ...week, nextRefreshLabel: formatNext(endWeek) },
      month: { ...month, nextRefreshLabel: formatNext(endMonth) }
    };
  }, [visibleTasks]);

  const topEods = useMemo(
    () =>
      eods
        .slice()
        .sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt))
        .slice(0, 6),
    [eods]
  );

  const handleLogout = async () => { // Logout and redirect.
    await apiRequest('/logout', {
      method: 'POST',
      body: JSON.stringify({ role: 'manager' })
    });
    window.location.assign('/login');
  };

  useEffect(() => {
    if (isDark) document.body.classList.add('theme-dark');
    return () => document.body.classList.remove('theme-dark');
  }, [isDark]);

  return (
    <div className="dashboard">
      <Sidebar
        title="Manager"
        items={navItems}
        activeSection={activeSection}
        onSelect={setActiveSection}
        onLogout={handleLogout}
        logoutLabel="Logout"
      />

      <main className="content">
        <div className="content-card page-hero">
          <div className="toolbar">
            <div>
              <h1 className="page-title">Manager Dashboard</h1>
              <p className="helper">Lead the team, monitor delivery, and approve requests.</p>
            </div>
            <div className="toolbar-actions">
              <div className="notification-wrapper">
                <button className="icon-button" type="button" aria-label="Notifications">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M12 3a6 6 0 0 0-6 6v2.2c0 .7-.28 1.37-.78 1.86L4 14.3V16h16v-1.7l-1.22-1.24a2.64 2.64 0 0 1-.78-1.86V9a6 6 0 0 0-6-6Zm0 18a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 21Z"
                      fill="currentColor"
                    />
                  </svg>
                </button>
              </div>
              <div className="admin-profile">
                <div className="admin-avatar">{getInitial('Manager')}</div>
                <div className="profile-meta">
                  <strong>Manager</strong>
                  <span className="helper">MANAGER</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <section className={`section ${activeSection === 'overview' ? 'active' : ''}`}>
          <div className="content-card overview-modern">
            <div className="metric-grid">
              <div className="metric-tile metric-purple">
                <span className="metric-kicker">Total Employees</span>
                <div className="metric-number">{stats.total}</div>
                <div className="metric-foot">{stats.teamCount} teams</div>
              </div>
              <div className="metric-tile metric-amber">
                <span className="metric-kicker">New (30 days)</span>
                <div className="metric-number">{newHires30}</div>
                <div className="metric-foot">Latest additions</div>
              </div>
              <div className="metric-tile metric-green">
                <span className="metric-kicker">Active</span>
                <div className="metric-number">{stats.active}</div>
                <div className="metric-foot">Present today: {attendanceCounts.checked_in + attendanceCounts.checked_out}</div>
              </div>
              <div className="metric-tile metric-red">
                <span className="metric-kicker">Inactive</span>
                <div className="metric-number">{stats.inactive}</div>
                <div className="metric-foot">Off duty</div>
              </div>
            </div>

            <div className="range-grid">
              <div className="range-card" data-kind="day">
                <div className="range-head">
                  <div>
                    <p className="range-title">Day Stats</p>
                    <span className="range-sub">Refreshes daily</span>
                  </div>
                  <span className="range-percent">{overviewRanges.day.performance}%</span>
                </div>
                <div className="range-row">
                  <span>Tasks today</span>
                  <strong>{overviewRanges.day.total}</strong>
                </div>
                <div className="range-row">
                  <span>Pending</span>
                  <strong>{overviewRanges.day.pending}</strong>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-bar"
                    style={{ width: `${overviewRanges.day.performance}%` }}
                  />
                </div>
                <p className="range-foot">Next refresh: {overviewRanges.day.nextRefreshLabel}</p>
              </div>

              <div className="range-card" data-kind="week">
                <div className="range-head">
                  <div>
                    <p className="range-title">Week Stats</p>
                    <span className="range-sub">Refreshes Sunday</span>
                  </div>
                  <span className="range-percent">{overviewRanges.week.performance}%</span>
                </div>
                <div className="range-row">
                  <span>Tasks this week</span>
                  <strong>{overviewRanges.week.total}</strong>
                </div>
                <div className="range-row">
                  <span>Pending</span>
                  <strong>{overviewRanges.week.pending}</strong>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-bar"
                    style={{ width: `${overviewRanges.week.performance}%` }}
                  />
                </div>
                <p className="range-foot">Next refresh: {overviewRanges.week.nextRefreshLabel}</p>
              </div>

              <div className="range-card" data-kind="month">
                <div className="range-head">
                  <div>
                    <p className="range-title">Month Stats</p>
                    <span className="range-sub">Refreshes month end</span>
                  </div>
                  <span className="range-percent">{overviewRanges.month.performance}%</span>
                </div>
                <div className="range-row">
                  <span>Finished</span>
                  <strong>{overviewRanges.month.completed}</strong>
                </div>
                <div className="range-row">
                  <span>Pending</span>
                  <strong>{overviewRanges.month.pending}</strong>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-bar"
                    style={{ width: `${overviewRanges.month.performance}%` }}
                  />
                </div>
                <p className="range-foot">Next refresh: {overviewRanges.month.nextRefreshLabel}</p>
              </div>
            </div>

            <div className="panel-grid">
              <div className="panel-card">
                <div className="panel-head">
                  <h3>Recent Hires</h3>
                  <span className="panel-sub">Latest additions</span>
                </div>
                {employeesError ? (
                  <div className="notice notice-muted">{employeesError}</div>
                ) : recentHires.length === 0 ? (
                  <p className="helper">No hires recorded.</p>
                ) : (
                  <div className="mini-list dense">
                    {recentHires.map((emp) => (
                      <div className="mini-item" key={emp.id}>
                        <div>
                          <div className="mini-title">{emp.name || 'Employee'}</div>
                          <div className="mini-sub">{emp.department || emp.role || '-'}</div>
                        </div>
                        <div className="mini-side">
                          <span className="mini-meta">{formatDate(emp.createdAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="panel-card">
                <div className="panel-head">
                  <h3>Upcoming Tasks</h3>
                  <span className="panel-sub">Due soon</span>
                </div>
                {taskError ? (
                  <div className="notice notice-muted">{taskError}</div>
                ) : upcomingTasks.length === 0 ? (
                  <p className="helper">No upcoming tasks scheduled.</p>
                ) : (
                  <div className="mini-list dense">
                    {upcomingTasks.map((task) => (
                      <div className="mini-item" key={task.id}>
                        <div>
                          <div className="mini-title">{task.details || 'Task'}</div>
                          <div className="mini-sub">
                            {task.employee ? formatEmployeeLabel(task.employee) : 'Employee'}
                          </div>
                        </div>
                        <div className="mini-side">
                          <span className="mini-meta">{formatDate(task.dueAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="panel-card">
                <div className="panel-head">
                  <h3>Pending Leaves</h3>
                  <span className="panel-sub">Awaiting approval</span>
                </div>
                {leaveError ? (
                  <div className="notice notice-muted">{leaveError}</div>
                ) : pendingLeaves.length === 0 ? (
                  <p className="helper">No pending leave requests.</p>
                ) : (
                  <div className="mini-list dense">
                    {pendingLeaves.slice(0, 4).map((leave) => (
                      <div className="mini-item" key={leave.id}>
                        <div>
                          <div className="mini-title">
                            {leave.employee ? formatEmployeeLabel(leave.employee) : 'Employee'}
                          </div>
                          <div className="mini-sub">
                            {formatDate(leave.fromDate)} - {formatDate(leave.toDate)} ({leave.category})
                          </div>
                        </div>
                        <div className="mini-side">
                          <span className="pill">{formatStatus(leave.status)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <p className="helper">{leaveStatus}</p>
              </div>
            </div>
          </div>
        </section>

        <section className={`section ${activeSection === 'attendance' ? 'active' : ''}`}>
          <div className="content-card">
            <h2 className="content-title">Attendance Overview</h2>
            <p className="helper">Monitor daily check-ins and hours.</p>

            {attendanceError ? (
              <div className="notice">{attendanceError}</div>
            ) : (
              <>
                <div className="attendance-visuals">
                  <div className="mini-chart">
                    <div className="mini-chart-header">
                      <span>Daily attendance rate (last 7 days)</span>
                      <strong>{attendanceChart.last7.slice(-1)[0]?.rate || 0}%</strong>
                    </div>
                    <svg viewBox="0 0 240 80" role="img" aria-label="Attendance rate line">
                      <polyline
                        fill="none"
                        stroke="#2f6fed"
                        strokeWidth="3"
                        points={attendanceChart.last7
                          .map((item, idx) => {
                            const x =
                              (idx / Math.max(1, attendanceChart.last7.length - 1)) * 230 + 5;
                            const y = 70 - (item.rate / 100) * 60;
                            return `${x},${y}`;
                          })
                          .join(' ')}
                      />
                      {attendanceChart.last7.map((item, idx) => {
                        const x =
                          (idx / Math.max(1, attendanceChart.last7.length - 1)) * 230 + 5;
                        const y = 70 - (item.rate / 100) * 60;
                        return <circle key={item.day} cx={x} cy={y} r="4" fill="#7dd3fc" />;
                      })}
                    </svg>
                    <div className="mini-chart-footer">
                      {attendanceChart.last7.map((item) => (
                        <span key={item.day}>{item.day?.slice(5) || '-'}</span>
                      ))}
                    </div>
                  </div>

                  <div className="donut-card">
                    <div className="mini-chart-header">
                      <span>Present / Absent / Leave</span>
                    </div>
                    {(() => {
                      const { present, absent, leave } = attendanceChart.counts;
                      const total = attendanceChart.total || 1;
                      const segments = [
                        { value: present, color: '#22c55e' },
                        { value: absent, color: '#ef4444' },
                        { value: leave, color: '#3b82f6' }
                      ];
                      let current = 0;
                      const stops = segments
                        .map((seg) => {
                          const start = (current / total) * 360;
                          current += seg.value;
                          const end = (current / total) * 360;
                          return `${seg.color} ${start}deg ${end}deg`;
                        })
                        .join(', ');
                      const background = `conic-gradient(${stops || '#1f2937 0deg'})`;
                      return (
                        <div className="donut sm" style={{ background }}>
                          <div className="donut-center">
                            <div className="donut-value">{total === 0 ? 0 : present}</div>
                            <div className="donut-label">Present</div>
                          </div>
                        </div>
                      );
                    })()}
                    <div className="donut-legend">
                      <div className="legend-row">
                        <span className="legend-dot" style={{ background: '#22c55e' }} />
                        <span>Present</span>
                        <strong>{attendanceChart.counts.present}</strong>
                      </div>
                      <div className="legend-row">
                        <span className="legend-dot" style={{ background: '#ef4444' }} />
                        <span>Absent</span>
                        <strong>{attendanceChart.counts.absent}</strong>
                      </div>
                      <div className="legend-row">
                        <span className="legend-dot" style={{ background: '#3b82f6' }} />
                        <span>Leave</span>
                        <strong>{attendanceChart.counts.leave}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="insight-row compact">
                  <div className="insight-chip">
                    <span>Presence</span>
                    <strong>{attendanceInsights.presenceRate}%</strong>
                  </div>
                  <div className="insight-chip">
                    <span>Checked out</span>
                    <strong>{attendanceInsights.checkedOut}</strong>
                  </div>
                  <div className="insight-chip">
                    <span>Not checked in</span>
                    <strong>{attendanceInsights.missing}</strong>
                  </div>
                </div>

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
                    {attendance.length === 0 ? (
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
              </>
            )}
          </div>
        </section>

        <section className={`section ${activeSection === 'task-monitor' ? 'active' : ''}`}>
          <div className="content-card task-monitor">
            <div className="section-header monitor-header">
              <div>
                <h2 className="content-title">Task Monitor</h2>
                <p className="helper">Analytics-first view of task velocity and risk.</p>
              </div>
              <div className="chip-row monitor-filter">
                {['all', 'planning', 'pending', 'completed', 'overdue'].map((key) => (
                  <button
                    key={`tm-${key}`}
                    type="button"
                    className={`chip chip-solid ${taskMonitorStatus === key ? 'chip-active' : ''}`}
                    onClick={() => setTaskMonitorStatus(key)}
                  >
                    {key === 'all' ? 'All' : formatStatus(key)}
                  </button>
                ))}
              </div>
            </div>

            <div className="monitor-grid monitor-grid-balanced">
              <div className="monitor-feed">
                {monitorTimeline.length === 0 ? (
                  <div className="notice notice-dark">No tasks in this filter.</div>
                ) : (
                  <ul className="tm-list">
                    {monitorTimeline.map((task) => {
                      const statusTone = getTaskStatusTone(task.status);
                      const dueTone = getTaskDueTone(task);
                      const employeeName = task.employee?.name || 'Unknown';
                      const dueLabel = getTaskDueText(task);
                      const createdLabel = formatDateTime(task.createdAt);
                      return (
                        <li className="tm-item" key={`timeline-${task.id || task.createdAt}`}>
                          <span className={`tm-dot ${statusTone}`} aria-hidden="true" />
                          <div className="tm-content">
                            <div className="tm-title">{task.details || 'Task'}</div>
                            <div className="tm-meta">
                              {employeeName} - {createdLabel}
                            </div>
                            <div className="tm-tags">
                              <span className={`tm-pill ${statusTone}`}>
                                {formatStatus(task.status)}
                              </span>
                              <span className={`tm-pill tm-pill-ghost ${dueTone}`}>
                                {task.isOverdue ? 'Overdue' : 'Due'}: {dueLabel}
                              </span>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="monitor-panel">
                <div className="tm-panel">
                  <div className="tm-panel-head">
                    <span>System Velocity</span>
                  </div>
                  {(() => {
                    const completed = taskMonitor.counts.completed || 0;
                    const total = taskMonitor.total || 1;
                    const angle = Math.min(360, (completed / total) * 360);
                    const background = `conic-gradient(#f59e0b 0deg ${angle}deg, #0f1a2d ${angle}deg 360deg)`;
                    return (
                      <div className="velocity-wrap">
                        <div className="velocity-ring" style={{ background }}>
                          <div className="velocity-center">
                            <div className="velocity-value">{taskMonitor.total}</div>
                            <div className="velocity-label">Total</div>
                          </div>
                        </div>
                        <div className="velocity-legend">
                          <div className="legend-row">
                            <span className="legend-dot legend-complete" />
                            <span>Completed</span>
                            <strong>{taskMonitor.counts.completed}</strong>
                          </div>
                          <div className="legend-row">
                            <span className="legend-dot legend-active" />
                            <span>Active</span>
                            <strong>
                              {Math.max(0, taskMonitor.total - taskMonitor.counts.completed)}
                            </strong>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="tm-panel tm-alerts-card">
                  <div className="tm-panel-head">
                    <span>Alerts</span>
                  </div>
                  <div className="alert-list tm-alerts">
                    <div className="alert-row">
                      <span>Overdue tasks</span>
                      <strong className="alert-badge danger">{taskMonitor.counts.overdue}</strong>
                    </div>
                    <div className="alert-row">
                      <span>Pending review</span>
                      <strong className="alert-badge warn">{taskMonitor.counts.pending}</strong>
                    </div>
                    <div className="alert-row">
                      <span>In progress</span>
                      <strong className="alert-badge info">{taskMonitor.counts.planning}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={`section ${activeSection === 'leave' ? 'active' : ''}`}>
          <div className="content-card">
            <h2 className="content-title">Leave Requests</h2>
            {leaveError ? (
              <div className="notice">{leaveError}</div>
            ) : leaves.length === 0 ? (
              <div className="notice notice-muted">No leave requests yet.</div>
            ) : (
              <table className="table table-responsive">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Requested</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {leaves.map((leave) => (
                    <tr key={leave.id}>
                      <td data-label="Employee">
                        {leave.employee ? formatEmployeeLabel(leave.employee) : 'Unknown'}
                      </td>
                      <td data-label="From">{formatDate(leave.fromDate)}</td>
                      <td data-label="To">{formatDate(leave.toDate)}</td>
                      <td data-label="Category">{leave.category}</td>
                      <td data-label="Status">{formatStatus(leave.status)}</td>
                      <td data-label="Requested">{formatDateTime(leave.createdAt)}</td>
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
                          <span className="pill">{formatStatus(leave.status)}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="helper">{leaveStatus}</p>
          </div>
        </section>

        <section className={`section ${activeSection === 'tasks' ? 'active' : ''}`}>
          <div className="content-card">
            <h2 className="content-title">Tasks</h2>
            {taskError ? (
              <div className="notice">{taskError}</div>
            ) : visibleTasks.length === 0 ? (
              <div className="notice notice-muted">No tasks assigned.</div>
            ) : (
              <div className="task-card-grid">
                {visibleTasks.map((task) => (
                  <div className="task-card" key={task.id}>
                    <div className="task-card-header">
                      <div>
                        <div className="task-title">{task.details}</div>
                        <div className="task-meta">
                          Due: {formatDateTime(task.dueAt)} - Assigned {formatDateTime(task.createdAt)}
                        </div>
                      </div>
                      <span className="pill">{formatStatus(task.status)}</span>
                    </div>
                    <div className="task-card-row">
                      <span>Employee</span>
                      <strong>{task.employee ? formatEmployeeLabel(task.employee) : 'Unknown'}</strong>
                    </div>
                    <div className="task-card-row">
                      <span>Assigned By</span>
                      <strong>{task.assignedBy?.email || '-'}</strong>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className={`section ${activeSection === 'team' ? 'active' : ''}`}>
          <div className="content-card">
            <h2 className="content-title">Team Directory</h2>
            {employeesError ? (
              <div className="notice">{employeesError}</div>
            ) : employees.length === 0 ? (
              <div className="notice notice-muted">No employees yet.</div>
            ) : (
              <table className="table table-responsive">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Department</th>
                    <th>Status</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => (
                    <tr key={emp.id}>
                      <td data-label="Name">{emp.name}</td>
                      <td data-label="Role">{formatStatus(emp.role)}</td>
                      <td data-label="Department">{emp.department || '-'}</td>
                      <td data-label="Status">{formatStatus(emp.status)}</td>
                      <td data-label="Joined">{formatDate(emp.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section className={`section ${activeSection === 'eod' ? 'active' : ''}`}>
          <div className="content-card" data-section="eods">
            <div className="employee-header">
              <div>
                <h2 className="content-title">EOD Snapshot</h2>
                <p className="helper">Submit your log and review team momentum.</p>
              </div>
            </div>

            {eodError ? (
              <div className="notice">{eodError}</div>
            ) : (
              <div className="eod-grid">
                <div className="card-block">
                  <h3>Submit my EOD</h3>
                  <form className="form" onSubmit={handleEodSubmit}>
                    <label className="form-field">
                      <span>Date</span>
                      <input
                        type="date"
                        value={eodForm.date}
                        onChange={handleEodChange('date')}
                        required
                      />
                    </label>
                    <label className="form-field">
                      <span>Session 1</span>
                      <textarea
                        value={eodForm.session1}
                        onChange={handleEodChange('session1')}
                        placeholder="Morning accomplishments"
                      />
                    </label>
                    <label className="form-field">
                      <span>Session 2</span>
                      <textarea
                        value={eodForm.session2}
                        onChange={handleEodChange('session2')}
                        placeholder="Afternoon accomplishments"
                      />
                    </label>
                    <label className="form-field">
                      <span>Status</span>
                      <select value={eodForm.status} onChange={handleEodChange('status')}>
                        <option value="completed">Completed</option>
                        <option value="in_progress">In progress</option>
                      </select>
                    </label>
                    <button className="btn primary" type="submit">
                      Submit EOD
                    </button>
                    {eodStatus.message ? (
                      <p className={eodStatus.isError ? 'helper error' : 'helper success'}>
                        {eodStatus.message}
                      </p>
                    ) : null}
                  </form>
                </div>

                <div className="card-block">
                  <div className="insight-row">
                    <div className="insight-card">
                      <span className="insight-label">Completion rate</span>
                      <strong className="insight-value">{eodSummary?.completionRate || 0}%</strong>
                    </div>
                    <div className="insight-card">
                      <span className="insight-label">In progress</span>
                      <strong className="insight-value">{eodSummary?.inProgress || 0}</strong>
                    </div>
                    <div className="insight-card">
                      <span className="insight-label">Total logs</span>
                      <strong className="insight-value">{eodSummary?.total || 0}</strong>
                    </div>
                    <div className="insight-card">
                      <span className="insight-label">Last 7 days</span>
                      <strong className="insight-value">
                        {eodSummary?.last7Days?.completionRate || 0}%
                      </strong>
                    </div>
                  </div>

                  <div className="bar-chart">
                    {eodChart.map((row) => (
                      <div className="bar-item" key={row.key}>
                        <span className="bar-label">{row.label}</span>
                        <div className="bar-track">
                          <div className="bar-fill" style={{ width: `${row.percent}%` }} />
                        </div>
                        <span className="bar-value">{row.percent}%</span>
                      </div>
                    ))}
                  </div>

                  <h4 style={{ margin: '12px 0 6px' }}>Top performers</h4>
                  <div className="bar-list">
                    {eodPeopleChart.map((row) => (
                      <div className="bar-item compact" key={row.label}>
                        <div className="bar-label">{row.label}</div>
                        <div className="bar-track">
                          <div className="bar-fill" style={{ width: `${row.value}%` }} />
                        </div>
                        <span className="bar-value">{row.value}%</span>
                      </div>
                    ))}
                    {eodPeopleChart.length === 0 ? (
                      <p className="helper">No submissions yet.</p>
                    ) : null}
                  </div>

                  <div className="mini-list">
                    {topEods.map((entry) => (
                      <div className="mini-item" key={entry.id}>
                        <div>
                          <div className="mini-title">
                            {formatDate(entry.date)} - {entry.employee?.name || 'Employee'}
                          </div>
                          <div className="mini-sub">
                            {entry.employee?.department || entry.employee?.email || '-'}
                          </div>
                        </div>
                        <span className="pill">{formatStatus(entry.status)}</span>
                      </div>
                    ))}
                    {topEods.length === 0 ? <p className="helper">No EODs yet.</p> : null}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

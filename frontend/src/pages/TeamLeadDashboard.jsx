import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar.jsx';
import { apiRequest, readJson } from '../api/client.js';
import { useBodyClass } from '../hooks/useBodyClass.js';
import { formatDate, formatDateTime, formatEmployeeLabel, formatStatus } from '../utils/format.js';

const navItems = [
  { id: 'overview', label: 'Overview' },
  { id: 'task-monitor', label: 'Task Monitor' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'leave', label: 'Leave' },
  { id: 'attendance', label: 'Attendance' }
];

const initialTaskForm = { employeeId: '', details: '', dueAt: '' };

const toTime = (value) => {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
};

const getInitial = (name = '') => {
  const trimmed = String(name).trim();
  if (!trimmed) return 'T';
  return trimmed.charAt(0).toUpperCase();
};

export default function TeamLeadDashboard() { // Team lead view for day-to-day coordination.
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
  const [taskStatus, setTaskStatus] = useState('');
  const [taskForm, setTaskForm] = useState(initialTaskForm);
  const [refreshing, setRefreshing] = useState(false);
  const [showAssignForm, setShowAssignForm] = useState(false);
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
    await Promise.all([loadEmployees(), loadAttendance(), loadLeaves(), loadTasks()]);
    setRefreshing(false);
  }

  async function loadEmployees() { // Fetch available assignees.
    setEmployeesError('');
    const res = await apiRequest('/api/admin/employees');
    const data = await readJson(res);
    if (!res.ok) {
      setEmployeesError(data?.message || 'Failed to load employees.');
      setEmployees([]);
      return;
    }
    setEmployees(Array.isArray(data) ? data : []);
    if (!taskForm.employeeId && Array.isArray(data) && data.length) {
      setTaskForm((prev) => ({ ...prev, employeeId: data[0].id }));
    }
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

  async function loadLeaves() { // Fetch leave requests.
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

  async function loadTasks() { // Fetch tasks to oversee.
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

  async function handleLeaveAction(id, status) { // Approve/reject within role scope.
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

  const handleTaskFormChange = (event) => {
    const { name, value } = event.target;
    setTaskForm((prev) => ({ ...prev, [name]: value }));
  };

  async function handleAssignTask(event) { // Assign a task to an employee/team lead.
    event.preventDefault();
    setTaskStatus('Assigning...');
    if (!taskForm.employeeId || !taskForm.details || !taskForm.dueAt) {
      setTaskStatus('Select employee, details, and due time.');
      return;
    }

    const res = await apiRequest('/api/admin/tasks', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: taskForm.employeeId,
        details: taskForm.details,
        dueAt: taskForm.dueAt
      })
    });
    const data = await readJson(res);
    if (!res.ok) {
      setTaskStatus(data?.message || 'Failed to assign task.');
      return;
    }
    setTaskStatus('Task assigned.');
    setTaskForm(initialTaskForm);
    setShowAssignForm(false);
    await loadTasks();
  }

  const peopleStats = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((emp) => emp.status === 'active').length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [employees]);

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

  const pendingLeaves = useMemo(
    () => leaves.filter((leave) => leave.status === 'pending'),
    [leaves]
  );

  const scopedAttendance = useMemo(
    () =>
      attendance.filter(
        (row) => (row.employee?.role || 'employee').toLowerCase() === 'employee'
      ),
    [attendance]
  );

const todaysPresence = useMemo(() => {
  const present = scopedAttendance.filter((row) => row.status === 'checked_in' || row.status === 'checked_out').length;
  const out = scopedAttendance.filter((row) => row.status === 'checked_out').length;
  return { present, out, total: scopedAttendance.length };
}, [scopedAttendance]);

  const taskBuckets = useMemo(() => {
    let planning = 0;
    let inProgress = 0;
    let completed = 0;
    let overdue = 0;
    const now = Date.now();
    visibleTasks
      .forEach((task) => {
        const status = (task.status || '').toLowerCase();
        if (status === 'completed') {
          completed += 1;
        } else if (status === 'processing' || status === 'in_progress') {
          inProgress += 1;
    } else {
      planning += 1;
    }
    if (status !== 'completed' && task.dueAt) {
      const due = new Date(task.dueAt).getTime();
      if (!Number.isNaN(due) && due < now) overdue += 1;
    }
  });
  const total = visibleTasks.length;
  return { planning, inProgress, completed, overdue, total };
}, [visibleTasks]);

  const completionRate = useMemo(() => {
    if (!taskBuckets.total) return 0;
    return Math.round((taskBuckets.completed / taskBuckets.total) * 100);
  }, [taskBuckets]);

  const myTasks = useMemo(
    () =>
    visibleTasks
      .filter((task) => (task.employee?.role || '').toLowerCase() === 'teamlead'),
    [visibleTasks]
  );

const [taskMonitorStatus, setTaskMonitorStatus] = useState('all');

  const filteredTasks = useMemo(() => {
    const scope = visibleTasks;
    if (taskMonitorStatus === 'all') return scope;
    if (taskMonitorStatus === 'overdue') {
      const now = Date.now();
      return scope.filter((task) => {
        const status = (task.status || '').toLowerCase();
        if (status === 'completed') return false;
        const due = new Date(task.dueAt).getTime();
        return !Number.isNaN(due) && due < now;
      });
    }
    return scope.filter((task) => (task.status || '').toLowerCase() === taskMonitorStatus);
  }, [visibleTasks, taskMonitorStatus]);

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
      const bucket = visibleTasks
        .filter((task) => {
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

  const handleLogout = async () => {
    await apiRequest('/logout', {
      method: 'POST',
      body: JSON.stringify({ role: 'teamlead' })
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
        title="Team Lead"
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
              <h1 className="page-title">Team Lead Dashboard</h1>
              <p className="helper">Assign tasks, watch attendance, and approve leaves.</p>
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
                <div className="admin-avatar">{getInitial('Team Lead')}</div>
                <div className="profile-meta">
                  <strong>Team Lead</strong>
                  <span className="helper">TEAM LEAD</span>
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
                <div className="metric-number">{peopleStats.total}</div>
                <div className="metric-foot">Team scope</div>
              </div>
              <div className="metric-tile metric-amber">
                <span className="metric-kicker">New (30 days)</span>
                <div className="metric-number">{newHires30}</div>
                <div className="metric-foot">Recent joiners</div>
              </div>
              <div className="metric-tile metric-green">
                <span className="metric-kicker">Active</span>
                <div className="metric-number">{peopleStats.active}</div>
                <div className="metric-foot">Checked in: {todaysPresence.present}</div>
              </div>
              <div className="metric-tile metric-red">
                <span className="metric-kicker">Inactive</span>
                <div className="metric-number">{peopleStats.inactive}</div>
                <div className="metric-foot">Checked out: {todaysPresence.out}</div>
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

        <section className={`section ${activeSection === 'tasks' ? 'active' : ''}`}>
          <div className="content-card assign-card">
            <div className="assign-head">
              <div>
                <h2 className="content-title">Assign Task</h2>
                <p className="helper">Assign tasks and track progress.</p>
              </div>
              <button className="btn-glow" type="button" onClick={() => setShowAssignForm(true)}>
                Assign Task
              </button>
            </div>

            <div className="assign-metrics compact">
              <div className="assign-metric">
                <span className="assign-label">Completion</span>
                <strong className="assign-value">{completionRate}%</strong>
              </div>
              <div className="assign-metric">
                <span className="assign-label">In Progress</span>
                <strong className="assign-value">{taskBuckets.inProgress}</strong>
              </div>
              <div className="assign-metric">
                <span className="assign-label">Planning</span>
                <strong className="assign-value">{taskBuckets.planning}</strong>
              </div>
              <div className="assign-metric">
                <span className="assign-label">Overdue</span>
                <strong className="assign-value">{taskBuckets.overdue}</strong>
              </div>
            </div>

            {visibleTasks.length === 0 ? (
              <div className="assign-empty">No tasks assigned yet.</div>
            ) : (
              <div className="task-summary-grid">
                {visibleTasks.map((task) => (
                  <div className="task-summary-card" key={task.id}>
                    <div className="task-card-badge">
                      <span className={`pill pill-soft status-${(task.status || 'planning').toLowerCase()}`}>
                        {formatStatus(task.status)}
                      </span>
                    </div>
                    <div className="task-summary-top">
                      <div className="task-avatar">{getInitial(task.employee?.name || 'E')}</div>
                      <div>
                        <div className="task-title">{task.details || 'Task'}</div>
                        <div className="task-meta">{task.employee ? formatEmployeeLabel(task.employee) : 'Employee'}</div>
                      </div>
                    </div>
                    <div className="task-summary-row">
                      <span className="task-summary-label">Due</span>
                      <strong>{formatDateTime(task.dueAt) || '-'}</strong>
                    </div>
                    <div className="task-summary-row">
                      <span className="task-summary-label">Assigned</span>
                      <strong>{formatDateTime(task.createdAt) || '-'}</strong>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {showAssignForm ? (
            <div className="modal active" aria-hidden={!showAssignForm}>
              <div className="modal-backdrop" onClick={() => setShowAssignForm(false)} />
              <div className="modal-card form-modal" role="dialog" aria-modal="true">
                <div className="modal-header">
                  <div>
                    <h3>Assign Task</h3>
                    <p className="helper">Assign to an employee and set a due time.</p>
                  </div>
                  <button className="btn-ghost modal-close" type="button" onClick={() => setShowAssignForm(false)}>
                    Close
                  </button>
                </div>

                <form className="form-grid" onSubmit={handleAssignTask}>
                  <div className="span-2">
                    <label htmlFor="task-employee">Assign To</label>
                    <select
                      id="task-employee"
                      name="employeeId"
                      value={taskForm.employeeId}
                      onChange={handleTaskFormChange}
                    >
                      <option value="">Select employee</option>
                      {employees
                        .filter((emp) => emp.role === 'employee')
                        .map((emp) => (
                          <option value={emp.id} key={emp.id}>
                            {formatEmployeeLabel(emp)}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="span-2">
                    <label htmlFor="task-due">Due At</label>
                    <input
                      id="task-due"
                      name="dueAt"
                      type="datetime-local"
                      value={taskForm.dueAt}
                      onChange={handleTaskFormChange}
                      placeholder="dd-mm-yyyy --:-- --"
                    />
                  </div>
                  <div className="span-2">
                    <label htmlFor="task-details">Details</label>
                    <textarea
                      id="task-details"
                      name="details"
                      placeholder="Describe the task"
                      value={taskForm.details}
                      onChange={handleTaskFormChange}
                      rows={3}
                    />
                  </div>
                  <div className="form-actions span-2" style={{ justifyContent: 'flex-end' }}>
                    <button className="btn-ghost" type="button" onClick={() => setShowAssignForm(false)}>
                      Cancel
                    </button>
                    <button className="btn-primary" type="submit">
                      Assign
                    </button>
                  </div>
                  <p
                    className="helper span-2"
                    style={{ color: taskStatus.includes('failed') ? '#c13e2d' : '#0e7c7b' }}
                  >
                    {taskStatus}
                  </p>
                </form>
              </div>
            </div>
          ) : null}
        </section>

        <section className={`section ${activeSection === 'task-monitor' ? 'active' : ''}`}>
          <div className="content-card">
            <div className="content-card-head">
              <div>
                <h2 className="content-title">Task Monitor</h2>
                <p className="helper">Analytics-first view of task velocity and risk.</p>
              </div>
              <div className="pill-group">
                {['all', 'planning', 'processing', 'completed', 'overdue'].map((status) => {
                  const label =
                    status === 'processing'
                      ? 'In Progress'
                      : status.charAt(0).toUpperCase() + status.slice(1);
                  return (
                    <button
                      key={status}
                      className={`pill-button ${taskMonitorStatus === status ? 'active' : ''}`}
                      type="button"
                      onClick={() => setTaskMonitorStatus(status)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid-2">
              <div className="task-monitor-list">
                {filteredTasks.length === 0 ? (
                  <div className="notice notice-muted">No tasks in this filter.</div>
                ) : (
                  <div className="task-stack">
                {filteredTasks.map((task) => {
                      const statusClass = `status-${(task.status || 'planning').toLowerCase()}`;
                      const statusLabel = formatStatus(task.status || 'planning');
                      const dueTs = new Date(task.dueAt).getTime();
                      const isOverdue =
                        !Number.isNaN(dueTs) && dueTs < Date.now() && (task.status || '').toLowerCase() !== 'completed';
                      return (
                        <div className={`task-card task-card-lined ${statusClass}`} key={task.id}>
                          <div className="task-card-topline">
                            <div className="task-title">{task.details || 'Task'}</div>
                            <span className={`task-chip ${statusClass}`}>{statusLabel}</span>
                          </div>

                          <div className="task-meta-row">
                            <span className="task-meta-icon icon-user" aria-hidden="true">
                              <svg viewBox="0 0 24 24" role="presentation">
                                <path
                                  d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-3.33 0-6 1.34-6 3v1h12v-1c0-1.66-2.67-3-6-3Z"
                                  fill="currentColor"
                                />
                              </svg>
                            </span>
                            <div className="task-meta-text">
                              <span className="task-meta-label">Owner</span>
                              <strong>{task.employee ? formatEmployeeLabel(task.employee) : 'Employee'}</strong>
                            </div>
                          </div>

                          <div className="task-meta-row">
                            <span className="task-meta-icon icon-assigned" aria-hidden="true">
                              <svg viewBox="0 0 24 24" role="presentation">
                                <path
                                  d="M7 3v2H5a2 2 0 0 0-2 2v11a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V7a2 2 0 0 0-2-2h-2V3h-2v2H9V3ZM6 8h12v10a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1Z"
                                  fill="currentColor"
                                />
                              </svg>
                            </span>
                            <div className="task-meta-text">
                              <span className="task-meta-label">Assigned</span>
                              <strong>{formatDateTime(task.createdAt) || '-'}</strong>
                            </div>
                          </div>

                          <div className="task-meta-row">
                            <span className="task-meta-icon icon-due" aria-hidden="true">
                              <svg viewBox="0 0 24 24" role="presentation">
                                <path
                                  d="M12 2a7 7 0 0 0-7 7.75c0 2.58 1.47 4.86 3.7 6a3.75 3.75 0 0 0 7.6 0c2.23-1.14 3.7-3.42 3.7-6A7 7 0 0 0 12 2Zm0 2a5 5 0 0 1 5 5.75 5 5 0 0 1-2.8 3.9l-.7.35-.05.78a1.75 1.75 0 0 1-3.9 0l-.05-.78-.7-.35A5 5 0 0 1 7 9.75 5 5 0 0 1 12 4Zm0 2.5a1 1 0 0 0-1 1v2.25l-1.1 1.1 1.4 1.4 1.6-1.6V7.5a1 1 0 0 0-1-1Z"
                                  fill="currentColor"
                                />
                              </svg>
                            </span>
                            <div className="task-meta-text">
                              <span className="task-meta-label">Due</span>
                              <strong className="task-due-link">{formatDateTime(task.dueAt) || '-'}</strong>
                            </div>
                          </div>

                          <div className="task-card-footer">
                            <span className="task-status-footer">{statusLabel}</span>
                            <span className="pill pill-ghost">{isOverdue ? 'Needs attention' : 'On track'}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="task-monitor-metrics">
                <div className="donut-card">
                  <div className="mini-chart-header">
                    <span>System Velocity</span>
                  </div>
                  {(() => {
                    const { total, completed, inProgress, planning } = taskBuckets;
                    const totalCount = total || 1;
                    const segments = [
                      { value: completed, color: '#22c55e' },
                      { value: inProgress, color: '#38bdf8' },
                      { value: planning, color: '#f59e0b' }
                    ];
                    let current = 0;
                    const stops = segments
                      .map((seg) => {
                        const start = (current / totalCount) * 360;
                        current += seg.value;
                        const end = (current / totalCount) * 360;
                        return `${seg.color} ${start}deg ${end}deg`;
                      })
                      .join(', ');
                    const background = `conic-gradient(${stops || '#1f2937 0deg'})`;
                    return (
                      <div className="donut" style={{ background }}>
                        <div className="donut-center">
                          <div className="donut-value">{total}</div>
                          <div className="donut-label">Total</div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="task-alerts">
                  <h4>Alerts</h4>
                  <div className="alert-row">
                    <span>Overdue tasks</span>
                    <span className="alert-dot alert-red">{taskBuckets.overdue}</span>
                  </div>
                  <div className="alert-row">
                    <span>Pending review</span>
                    <span className="alert-dot alert-amber">{taskBuckets.planning}</span>
                  </div>
                  <div className="alert-row">
                    <span>In progress</span>
                    <span className="alert-dot alert-blue">{taskBuckets.inProgress}</span>
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
              <div className="notice notice-muted">No leave requests.</div>
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

        <section className={`section ${activeSection === 'attendance' ? 'active' : ''}`}>
          <div className="content-card">
            <h2 className="content-title">Attendance Today</h2>
            {attendanceError ? (
              <div className="notice">{attendanceError}</div>
            ) : scopedAttendance.length === 0 ? (
              <div className="notice notice-muted">No attendance data.</div>
            ) : (
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
                  {scopedAttendance.map((row) => (
                    <tr key={row.employee?.id || row.date}>
                      <td data-label="Employee">
                        {row.employee ? formatEmployeeLabel(row.employee) : 'Unknown'}
                      </td>
                      <td data-label="Status">{formatStatus(row.status)}</td>
                      <td data-label="Check In">{formatDateTime(row.checkInAt)}</td>
                      <td data-label="Check Out">{formatDateTime(row.checkOutAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

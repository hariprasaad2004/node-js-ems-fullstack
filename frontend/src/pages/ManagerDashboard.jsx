import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar.jsx';
import { apiRequest, readJson } from '../api/client.js';
import { useBodyClass } from '../hooks/useBodyClass.js';
import { formatDate, formatDateTime, formatEmployeeLabel, formatStatus } from '../utils/format.js';

const getDayStart = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const getNextDayStart = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
const getWeekStart = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay());
const getNextWeekStart = (date) => {
  const start = getWeekStart(date);
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
};
const getMonthStart = (date) => new Date(date.getFullYear(), date.getMonth(), 1);
const getNextMonthStart = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 1);
const getTaskDate = (task) => {
  if (task?.dueAt) return new Date(task.dueAt);
  if (task?.createdAt) return new Date(task.createdAt);
  return null;
};

const navItems = [
  { id: 'overview', label: 'Overview' },
  { id: 'performance', label: 'Performance' },
  { id: 'task-monitor', label: 'Task Monitor' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'eods', label: 'EOD Reports' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'people', label: 'Employees' },
  { id: 'policies', label: 'Policies' }
];

export default function ManagerDashboard() { // Manager dashboard with broader org insights.
  useBodyClass('page-dashboard');
  useEffect(() => {
    const { classList } = document.body;
    classList.add('theme-dark');
    return () => classList.remove('theme-dark');
  }, []);

  const [activeSection, setActiveSection] = useState('overview');
  const [profile, setProfile] = useState(null);
  const [team, setTeam] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [allLeaves, setAllLeaves] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [leaveStatus, setLeaveStatus] = useState('');

  useEffect(() => {
    loadProfile();
    loadTeam();
    loadAttendance();
    loadLeaves();
    loadTasks();
  }, []);

  const pendingLeavesLimited = useMemo(() => pendingLeaves.slice(0, 5), [pendingLeaves]);

  const taskStats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((task) => task.status === 'completed').length;
    const processing = tasks.filter((task) => task.status === 'processing').length;
    const planning = tasks.filter((task) => task.status === 'planning').length;
    return { total, completed, processing, planning };
  }, [tasks]);

  const attendanceStats = useMemo(() => {
    const present = attendance.filter((entry) =>
      ['checked_in', 'checked_out'].includes(entry.status)
    ).length;
    const coverage = attendance.length ? Math.round((present / attendance.length) * 100) : 0;
    return { present, coverage, total: attendance.length };
  }, [attendance]);

  const activeHeadcount = useMemo(
    () => team.filter((member) => member.status === 'active').length,
    [team]
  );

  const stats = useMemo(() => {
    const total = team.length;
    const active = activeHeadcount;
    const inactive = total - active;
    const recentCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recent = team.filter((emp) => emp.createdAt && new Date(emp.createdAt).getTime() >= recentCutoff).length;
    return { total, active, inactive, recent };
  }, [team, activeHeadcount]);

  const rangeStats = useMemo(() => {
    const now = new Date();
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
      const pending = items.length - completed;
      const performance = items.length ? Math.round((completed / items.length) * 100) : 0;
      return { total: items.length, pending, completed, performance };
    };

    return {
      day: calc(dayStart, dayEnd),
      week: calc(weekStart, weekEnd),
      month: calc(monthStart, monthEnd),
      nextDay: dayEnd,
      nextWeek: weekEnd,
      nextMonth: monthEnd
    };
  }, [tasks]);

  const recentHires = useMemo(() => {
    if (team.length === 0) return [];
    const withDates = team.filter((emp) => emp.createdAt);
    const base = withDates.length ? withDates : team;
    return base
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 4);
  }, [team]);

  const upcomingTasks = useMemo(() => {
    const now = Date.now();
    return tasks
      .filter((task) => {
        const due = getTaskDate(task)?.getTime?.() || 0;
        return due && due >= now;
      })
      .sort((a, b) => getTaskDate(a) - getTaskDate(b))
      .slice(0, 4);
  }, [tasks]);

  async function loadProfile() { // Fetch the manager profile.
    const res = await apiRequest('/api/employee/me');
    const data = await readJson(res);
    if (res.ok) {
      setProfile(data);
    } else {
      setStatusMessage(data?.message || 'Unable to load profile.');
    }
  }

  async function loadTeam() { // Fetch employees across the org.
    const res = await apiRequest('/api/admin/employees');
    const data = await readJson(res);
    if (res.ok) {
      setTeam(Array.isArray(data) ? data : []);
    } else {
      setStatusMessage(data?.message || 'Failed to load people.');
    }
  }

  async function loadAttendance() { // Pull today coverage.
    const res = await apiRequest('/api/admin/attendance/summary');
    const data = await readJson(res);
    if (res.ok) {
      setAttendance(Array.isArray(data) ? data : []);
    } else {
      setStatusMessage(data?.message || 'Failed to load attendance.');
    }
  }

  async function loadLeaves() { // Pending approvals + history separated.
    setLeaveStatus('');

    const [pendingRes, allRes] = await Promise.all([
      apiRequest('/api/admin/leave?status=pending'),
      apiRequest('/api/admin/leave')
    ]);

    const pendingData = await readJson(pendingRes);
    const allData = await readJson(allRes);

    if (!pendingRes.ok) {
      setLeaveStatus(pendingData?.message || 'Failed to load pending leave requests.');
      setPendingLeaves([]);
    } else {
      setPendingLeaves(Array.isArray(pendingData) ? pendingData : []);
    }

    if (!allRes.ok) {
      setLeaveStatus((prev) => prev || allData?.message || 'Failed to load leave requests.');
      setAllLeaves([]);
    } else {
      setAllLeaves(Array.isArray(allData) ? allData : []);
    }
  }

  async function loadTasks() { // Org-wide tasks.
    const res = await apiRequest('/api/admin/tasks');
    const data = await readJson(res);
    if (res.ok) {
      setTasks(Array.isArray(data) ? data : []);
    } else {
      setTaskStatus(data?.message || 'Failed to load tasks.');
    }
  }

  async function handleLeaveDecision(id, status) { // Approve or reject leave.
    setLeaveStatus('Updating...');
    const res = await apiRequest(`/api/admin/leave/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
    const data = await readJson(res);
    if (!res.ok) {
      setLeaveStatus(data?.message || 'Unable to update leave.');
      return;
    }
    setLeaveStatus('Leave updated.');
    await loadLeaves();
  }

  const handleLogout = async () => { // Logout and redirect.
    await apiRequest('/logout', {
      method: 'POST',
      body: JSON.stringify({ role: 'manager' })
    });
    window.location.assign('/login');
  };

  const topTasks = tasks.slice(0, 6);

  return (
    <div className="dashboard">
      <Sidebar
        title="Manager Console"
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
              <p className="helper">Track people health, unblock approvals, and align tasks.</p>
            </div>
            <div className="toolbar-actions">
              <button className="icon-button" type="button" aria-label="Notifications">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M12 3a6 6 0 0 0-6 6v2.2c0 .7-.28 1.37-.78 1.86L4 14.3V16h16v-1.7l-1.22-1.24a2.64 2.64 0 0 1-.78-1.86V9a6 6 0 0 0-6-6Zm0 18a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 21Z"
                    fill="currentColor"
                  />
                </svg>
              </button>
              <div className="admin-profile" aria-label="Manager profile">
                <div className="admin-avatar">
                  {(profile?.name || 'M').charAt(0).toUpperCase()}
                </div>
                <div className="admin-meta">
                  <span className="admin-name">{profile?.name || 'Manager'}</span>
                  <span className="admin-role">
                    {profile?.id ? `ID ${profile.id.slice(-6).toUpperCase()}` : 'MANAGER'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {statusMessage ? <div className="notice">{statusMessage}</div> : null}

        <section
          className={`section ${activeSection === 'overview' ? 'active' : ''}`}
          data-section="overview"
        >
          <div className="content-card overview-panel">
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
                    <div className="stat-bar" style={{ '--percent': rangeStats.day.performance }}>
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
                    <div className="stat-bar" style={{ '--percent': rangeStats.week.performance }}>
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
                    <div className="stat-bar" style={{ '--percent': rangeStats.month.performance }}>
                      <span className="stat-bar-fill" />
                    </div>
                  </div>
                </div>
                <div className="stat-next">Next refresh: {formatDateTime(rangeStats.nextMonth)}</div>
              </div>
            </div>

            <div className="overview-lists">
              <div className="overview-card">
                <div className="overview-card-header">
                  <h3>Recent Hires</h3>
                  <span className="helper">Latest additions</span>
                </div>
                {recentHires.length === 0 ? (
                  <p className="helper">No recent hires.</p>
                ) : (
                  <ul className="mini-list">
                    {recentHires.map((emp) => (
                      <li className="mini-item" key={emp.id}>
                        <div>
                          <div className="mini-title">{emp.name || 'Employee'}</div>
                          <div className="mini-sub">{emp.title || 'New hire'}</div>
                        </div>
                        <div className="mini-meta">{formatDate(emp.createdAt)}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="overview-card">
                <div className="overview-card-header">
                  <h3>Upcoming Tasks</h3>
                  <span className="helper">Due soon</span>
                </div>
                {upcomingTasks.length === 0 ? (
                  <p className="helper">No upcoming tasks scheduled.</p>
                ) : (
                  <ul className="mini-list">
                    {upcomingTasks.map((task) => (
                      <li className="mini-item" key={task.id}>
                        <div>
                          <div className="mini-title">{task.details}</div>
                          <div className="mini-sub">Assignee: {task.employee?.name || '—'}</div>
                        </div>
                        <div className="mini-meta">{formatDateTime(task.dueAt)}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="overview-card">
                <div className="overview-card-header">
                  <h3>Pending Leaves</h3>
                  <span className="helper">Awaiting approval</span>
                </div>
                {pendingLeaves.length === 0 ? (
                  <p className="helper">No pending leave requests.</p>
                ) : (
                  <ul className="mini-list">
                    {pendingLeaves.slice(0, 4).map((leave) => (
                      <li className="mini-item" key={leave.id}>
                        <div>
                          <div className="mini-title">{formatEmployeeLabel(leave.employee)}</div>
                          <div className="mini-sub">{formatStatus(leave.category)}</div>
                        </div>
                        <div className="mini-meta">
                          {formatDate(leave.fromDate)} - {formatDate(leave.toDate)}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </section>

        <section
          className={`section ${activeSection === 'people' ? 'active' : ''}`}
          data-section="people"
        >
          <div className="content-card">
            <div className="section-header">
              <h2 className="content-title">People & Coverage</h2>
              <p className="helper">Combine roster with today&apos;s attendance.</p>
            </div>
            <div className="table-scroll">
              <table className="table table-responsive">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Department</th>
                    <th>Attendance</th>
                    <th>Check In</th>
                  </tr>
                </thead>
                <tbody>
                  {team.length === 0 ? (
                    <tr>
                      <td colSpan="5">No employees.</td>
                    </tr>
                  ) : (
                    team.map((member) => {
                      const today = attendance.find((row) => row.employee.id === member.id);
                      return (
                        <tr key={member.id}>
                          <td data-label="Name">{member.name}</td>
                          <td data-label="Email">{member.email}</td>
                          <td data-label="Department">{member.department || '-'}</td>
                          <td data-label="Attendance">
                            {today ? formatStatus(today.status) : 'Not checked in'}
                          </td>
                          <td data-label="Check In">
                            {today ? formatDateTime(today.checkInAt) : '-'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section
          className={`section ${activeSection === 'approvals' ? 'active' : ''}`}
          data-section="approvals"
        >
          <div className="content-card">
            <div className="section-header">
              <h2 className="content-title">Pending Leave Approvals</h2>
              <p className="helper">Only requests that need your action.</p>
            </div>
            {leaveStatus ? <p className="helper">{leaveStatus}</p> : null}
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Dates</th>
                    <th>Category</th>
                    <th>Requested</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {pendingLeaves.length === 0 ? (
                    <tr>
                      <td colSpan="5">No pending leave requests.</td>
                    </tr>
                  ) : (
                    pendingLeaves.map((leave) => (
                      <tr key={leave.id}>
                        <td data-label="Employee">{formatEmployeeLabel(leave.employee)}</td>
                        <td data-label="Dates">
                          {formatDate(leave.fromDate)} - {formatDate(leave.toDate)}
                        </td>
                        <td data-label="Category">{formatStatus(leave.category)}</td>
                        <td data-label="Requested">{formatDateTime(leave.createdAt)}</td>
                        <td>
                          <div className="action-row">
                            <button
                              className="btn-ghost"
                              type="button"
                              onClick={() => handleLeaveDecision(leave.id, 'rejected')}
                            >
                              Reject
                            </button>
                            <button
                              className="btn-primary"
                              type="button"
                              onClick={() => handleLeaveDecision(leave.id, 'approved')}
                            >
                              Approve
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="section-header" style={{ marginTop: '24px' }}>
              <h3 className="content-title">Leave History</h3>
              <p className="helper">Includes approved and rejected requests.</p>
            </div>
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Dates</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Requested</th>
                  </tr>
                </thead>
                <tbody>
                  {allLeaves.filter((l) => l.status !== 'pending').length === 0 ? (
                    <tr>
                      <td colSpan="5">No history yet.</td>
                    </tr>
                  ) : (
                    allLeaves
                      .filter((l) => l.status !== 'pending')
                      .map((leave) => (
                        <tr key={leave.id}>
                          <td data-label="Employee">{formatEmployeeLabel(leave.employee)}</td>
                          <td data-label="Dates">
                            {formatDate(leave.fromDate)} - {formatDate(leave.toDate)}
                          </td>
                          <td data-label="Category">{formatStatus(leave.category)}</td>
                          <td data-label="Status">{formatStatus(leave.status)}</td>
                          <td data-label="Requested">{formatDateTime(leave.createdAt)}</td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section
          className={`section ${activeSection === 'tasks' ? 'active' : ''}`}
          data-section="tasks"
        >
          <div className="content-card">
            <div className="section-header">
              <h2 className="content-title">Task Distribution</h2>
              <p className="helper">
                View tasks to monitor progress; task assignment is handled by Team Leads.
              </p>
            </div>
            {topTasks.length === 0 ? (
              <div className="notice">No tasks assigned yet.</div>
            ) : (
              <div className="task-card-grid">
                {topTasks.map((task) => (
                  <div className="task-card" key={task.id}>
                    <div className="task-card-header">
                      <span className="pill">{formatStatus(task.status)}</span>
                      <span className="task-meta">{formatDateTime(task.dueAt)}</span>
                    </div>
                    <div className="task-title">{task.details}</div>
                    <div className="task-card-row">
                      <span>Assignee</span>
                      <strong>{task.employee?.name || 'Unknown'}</strong>
                    </div>
                    <div className="task-card-row">
                      <span>Assigned</span>
                      <strong>{formatDateTime(task.createdAt)}</strong>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section
          className={`section ${activeSection === 'performance' ? 'active' : ''}`}
          data-section="performance"
        >
          <div className="content-card">
            <div className="section-header">
              <h2 className="content-title">Performance</h2>
              <p className="helper">High-level delivery and attendance snapshots.</p>
            </div>
            <div className="insight-row">
              <div className="insight-card">
                <span className="metric-label">Headcount</span>
                <strong className="metric-value">{team.length}</strong>
                <p className="helper">{activeHeadcount} active</p>
              </div>
              <div className="insight-card">
                <span className="metric-label">Pending Leaves</span>
                <strong className="metric-value">{pendingLeaves.length}</strong>
                <p className="helper">Awaiting decision</p>
              </div>
              <div className="insight-card">
                <span className="metric-label">Tasks Completed</span>
                <strong className="metric-value">{taskStats.completed}</strong>
                <p className="helper">{taskStats.total} total tasks</p>
              </div>
              <div className="insight-card">
                <span className="metric-label">Attendance Coverage</span>
                <strong className="metric-value">{attendanceStats.coverage}%</strong>
                <p className="helper">
                  {attendanceStats.present}/{attendanceStats.total} checked in/out today
                </p>
              </div>
            </div>
          </div>
        </section>

        <section
          className={`section ${activeSection === 'task-monitor' ? 'active' : ''}`}
          data-section="task-monitor"
        >
          <div className="content-card">
            <div className="section-header">
              <h2 className="content-title">Task Monitor</h2>
              <p className="helper">Quick view of open tasks.</p>
            </div>
            {tasks.length === 0 ? (
              <div className="notice">No tasks yet.</div>
            ) : (
              <div className="task-card-grid">
                {tasks.slice(0, 8).map((task) => (
                  <div className="task-card" key={task.id}>
                    <div className="task-card-header">
                      <span className="pill">{formatStatus(task.status)}</span>
                      <span className="task-meta">{formatDateTime(task.dueAt)}</span>
                    </div>
                    <div className="task-title">{task.details}</div>
                    <div className="task-card-row">
                      <span>Assignee</span>
                      <strong>{task.employee?.name || 'Unknown'}</strong>
                    </div>
                    <div className="task-card-row">
                      <span>Assigned</span>
                      <strong>{formatDateTime(task.createdAt)}</strong>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section
          className={`section ${activeSection === 'attendance' ? 'active' : ''}`}
          data-section="attendance"
        >
          <div className="content-card">
            <div className="section-header">
              <h2 className="content-title">Attendance</h2>
              <p className="helper">Today&apos;s check-ins at a glance.</p>
            </div>
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Status</th>
                    <th>Check In</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.length === 0 ? (
                    <tr>
                      <td colSpan="3">No attendance records.</td>
                    </tr>
                  ) : (
                    attendance.map((row) => (
                      <tr key={row.employee.id}>
                        <td data-label="Employee">{formatEmployeeLabel(row.employee)}</td>
                        <td data-label="Status">{formatStatus(row.status)}</td>
                        <td data-label="Check In">{formatDateTime(row.checkInAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section
          className={`section ${activeSection === 'eods' ? 'active' : ''}`}
          data-section="eods"
        >
          <div className="content-card">
            <div className="section-header">
              <h2 className="content-title">EOD Reports</h2>
              <p className="helper">Coming soon: end-of-day rollups.</p>
            </div>
          </div>
        </section>

        <section
          className={`section ${activeSection === 'policies' ? 'active' : ''}`}
          data-section="policies"
        >
          <div className="content-card">
            <div className="section-header">
              <h2 className="content-title">Policies</h2>
              <p className="helper">Coming soon: company and HR policies.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

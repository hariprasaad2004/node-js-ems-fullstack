import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar.jsx';
import { apiRequest, readJson } from '../api/client.js';
import { useBodyClass } from '../hooks/useBodyClass.js';
import { formatDate, formatDateTime, formatEmployeeLabel, formatStatus } from '../utils/format.js';

const navItems = [
  { id: 'overview', label: 'Overview' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'leave', label: 'Leave' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'team', label: 'Team' },
  { id: 'eod', label: 'EOD' }
];

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
  const [refreshing, setRefreshing] = useState(false);

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
    setTasks(Array.isArray(data) ? data : []);
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

  const pendingLeaves = useMemo(
    () => leaves.filter((leave) => leave.status === 'pending'),
    [leaves]
  );

  const recentTasks = useMemo(
    () =>
      tasks
        .slice()
        .sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt))
        .slice(0, 6),
    [tasks]
  );

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
          <div>
            <h1 className="page-title">Manager Dashboard</h1>
            <p className="helper">Lead the team, monitor delivery, and approve requests.</p>
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
            <div className="admin-profile">
              <div className="profile-avatar">{getInitial('Manager')}</div>
              <div className="profile-meta">
                <strong>Manager</strong>
                <span className="helper">Manager</span>
              </div>
            </div>
          </div>
        </div>

        <section className={`section ${activeSection === 'overview' ? 'active' : ''}`}>
          <div className="content-card">
            <div className="insight-row">
              <div className="insight-card">
                <span className="insight-label">Headcount</span>
                <strong className="insight-value">{stats.total}</strong>
                <div className="insight-sub">{stats.teamCount} teams</div>
              </div>
              <div className="insight-card">
                <span className="insight-label">Active</span>
                <strong className="insight-value">{stats.active}</strong>
                <div className="insight-sub">{stats.inactive} inactive</div>
              </div>
              <div className="insight-card">
                <span className="insight-label">Team Leads</span>
                <strong className="insight-value">{stats.leads}</strong>
                <div className="insight-sub">Mentors in org</div>
              </div>
              <div className="insight-card">
                <span className="insight-label">Attendance today</span>
                <strong className="insight-value">
                  {attendanceCounts.checked_in + attendanceCounts.checked_out}
                </strong>
                <div className="insight-sub">Checked in / out</div>
              </div>
            </div>

            <div className="grid-2">
              <div className="overview-card">
                <div className="overview-card-header">
                  <h3>Latest Tasks</h3>
                  <span className="helper">Newest assignments</span>
                </div>
                {taskError ? (
                  <div className="notice">{taskError}</div>
                ) : recentTasks.length === 0 ? (
                  <p className="helper">No tasks yet.</p>
                ) : (
                  <div className="mini-list">
                    {recentTasks.map((task) => (
                      <div className="mini-item" key={task.id}>
                        <div>
                          <div className="mini-title">{task.details || 'Task'}</div>
                          <div className="mini-sub">
                            {task.employee?.name || 'Employee'} - {formatDateTime(task.dueAt)}
                          </div>
                        </div>
                        <span className="pill">{formatStatus(task.status)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="overview-card">
                <div className="overview-card-header">
                  <h3>Pending Leave</h3>
                  <span className="helper">Requests awaiting action</span>
                </div>
                {leaveError ? (
                  <div className="notice">{leaveError}</div>
                ) : pendingLeaves.length === 0 ? (
                  <p className="helper">No pending leaves.</p>
                ) : (
                  <div className="mini-list">
                    {pendingLeaves.map((leave) => (
                      <div className="mini-item" key={leave.id}>
                        <div>
                          <div className="mini-title">
                            {leave.employee ? formatEmployeeLabel(leave.employee) : 'Employee'}
                          </div>
                          <div className="mini-sub">
                            {formatDate(leave.fromDate)} - {formatDate(leave.toDate)} ({leave.category})
                          </div>
                        </div>
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
            <h2 className="content-title">Attendance Today</h2>
            {attendanceError ? (
              <div className="notice">{attendanceError}</div>
            ) : attendance.length === 0 ? (
              <div className="notice notice-muted">No attendance yet.</div>
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
                  {attendance.map((row) => (
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
            ) : tasks.length === 0 ? (
              <div className="notice notice-muted">No tasks assigned.</div>
            ) : (
              <div className="task-card-grid">
                {tasks.map((task) => (
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
          <div className="content-card">
            <div className="employee-header">
              <div>
                <h2 className="content-title">EOD Snapshot</h2>
                <p className="helper">Completion and recent highlights.</p>
              </div>
            </div>

            {eodError ? (
              <div className="notice">{eodError}</div>
            ) : (
              <>
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

                <div className="mini-list">
                  {topEods.map((entry) => (
                    <div className="mini-item" key={entry.id}>
                      <div>
                        <div className="mini-title">
                          {formatDate(entry.date)} - {entry.employee?.name || 'Employee'}
                        </div>
                        <div className="mini-sub">
                          {entry.employee?.department || entry.employee?.email || '—'}
                        </div>
                      </div>
                      <span className="pill">{formatStatus(entry.status)}</span>
                    </div>
                  ))}
                  {topEods.length === 0 ? <p className="helper">No EODs yet.</p> : null}
                </div>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

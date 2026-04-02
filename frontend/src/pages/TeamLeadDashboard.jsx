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
    setTasks(Array.isArray(data) ? data : []);
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
    await loadTasks();
  }

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((task) => (task.status || '').toLowerCase() === 'completed').length;
    const pending = total - completed;
    return { total, completed, pending };
  }, [tasks]);

  const pendingLeaves = useMemo(
    () => leaves.filter((leave) => leave.status === 'pending'),
    [leaves]
  );

const todaysPresence = useMemo(() => {
  const present = attendance.filter((row) => row.status === 'checked_in' || row.status === 'checked_out').length;
  const out = attendance.filter((row) => row.status === 'checked_out').length;
  return { present, out, total: attendance.length };
}, [attendance]);

const taskBuckets = useMemo(() => {
  let planning = 0;
  let inProgress = 0;
  let completed = 0;
  let overdue = 0;
  const now = Date.now();
  tasks.forEach((task) => {
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
  const total = tasks.length;
  return { planning, inProgress, completed, overdue, total };
}, [tasks]);

const [taskMonitorStatus, setTaskMonitorStatus] = useState('all');

const filteredTasks = useMemo(() => {
  if (taskMonitorStatus === 'all') return tasks;
  if (taskMonitorStatus === 'overdue') {
    const now = Date.now();
    return tasks.filter((task) => {
      const status = (task.status || '').toLowerCase();
      if (status === 'completed') return false;
      const due = new Date(task.dueAt).getTime();
      return !Number.isNaN(due) && due < now;
    });
  }
  return tasks.filter((task) => (task.status || '').toLowerCase() === taskMonitorStatus);
}, [tasks, taskMonitorStatus]);

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
          <div className="content-card">
            <div className="insight-row">
              <div className="insight-card">
                <span className="insight-label">Tasks</span>
                <strong className="insight-value">{stats.total}</strong>
                <div className="insight-sub">{stats.completed} completed</div>
              </div>
              <div className="insight-card">
                <span className="insight-label">Pending</span>
                <strong className="insight-value">{stats.pending}</strong>
                <div className="insight-sub">Tasks to follow up</div>
              </div>
              <div className="insight-card">
                <span className="insight-label">Attendance today</span>
                <strong className="insight-value">{todaysPresence.present}</strong>
                <div className="insight-sub">{todaysPresence.out} checked out</div>
              </div>
              <div className="insight-card">
                <span className="insight-label">Pending leave</span>
                <strong className="insight-value">{pendingLeaves.length}</strong>
                <div className="insight-sub">Needs decision</div>
              </div>
            </div>
          </div>
        </section>

        <section className={`section ${activeSection === 'tasks' ? 'active' : ''}`}>
          <div className="grid-2">
            <div className="content-card">
              <h2 className="content-title">Assign Task</h2>
              <form className="form-grid" onSubmit={handleAssignTask}>
                <div>
                  <label htmlFor="task-employee">Assign To</label>
                  <select
                    id="task-employee"
                    name="employeeId"
                    value={taskForm.employeeId}
                    onChange={handleTaskFormChange}
                  >
                    <option value="">Select employee</option>
                    {employees
                      .filter((emp) => emp.role === 'employee' || emp.role === 'teamlead')
                      .map((emp) => (
                        <option value={emp.id} key={emp.id}>
                          {formatEmployeeLabel(emp)}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="task-due">Due At</label>
                  <input
                    id="task-due"
                    name="dueAt"
                    type="datetime-local"
                    value={taskForm.dueAt}
                    onChange={handleTaskFormChange}
                  />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label htmlFor="task-details">Details</label>
                  <textarea
                    id="task-details"
                    name="details"
                    placeholder="Describe the task"
                    value={taskForm.details}
                    onChange={handleTaskFormChange}
                  />
                </div>
                <button className="btn-primary" type="submit">
                  Assign
                </button>
                <p className="helper" style={{ color: taskStatus.includes('failed') ? '#c13e2d' : '#0e7c7b' }}>
                  {taskStatus}
                </p>
              </form>
            </div>

            <div className="content-card">
              <h2 className="content-title">Active Tasks</h2>
              {taskError ? (
                <div className="notice">{taskError}</div>
              ) : tasks.length === 0 ? (
                <div className="notice notice-muted">No tasks yet.</div>
              ) : (
                <div className="task-card-grid">
                  {tasks.map((task) => (
                    <div className="task-card" key={task.id}>
                      <div className="task-card-header">
                        <div>
                          <div className="task-title">{task.details}</div>
                          <div className="task-meta">Due: {formatDateTime(task.dueAt) || '-'}</div>
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
          </div>
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
                  <ul className="task-monitor-ul">
                    {filteredTasks.map((task) => (
                      <li key={task.id} className="task-monitor-row">
                        <div>
                          <div className="mini-title">{task.details || 'Task'}</div>
                          <div className="mini-sub">
                            {task.assignedBy?.name || 'Assigned'} • {formatDateTime(task.dueAt) || '-'}
                          </div>
                        </div>
                        <span className="pill">{formatStatus(task.status)}</span>
                      </li>
                    ))}
                  </ul>
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
            ) : attendance.length === 0 ? (
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
      </main>
    </div>
  );
}

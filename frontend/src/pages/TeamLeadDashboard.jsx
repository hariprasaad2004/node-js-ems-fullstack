import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar.jsx';
import { apiRequest, readJson } from '../api/client.js';
import { useBodyClass } from '../hooks/useBodyClass.js';
import { formatDate, formatDateTime, formatEmployeeLabel, formatStatus } from '../utils/format.js';

const navItems = [
  { id: 'overview', label: 'Overview' },
  { id: 'team', label: 'Team' },
  { id: 'leaves', label: 'Leave Approvals' },
  { id: 'tasks', label: 'Task Board' }
];

const initialTaskForm = { employeeId: '', details: '', dueAt: '' };
const initialMyLeaveForm = { category: 'casual', fromDate: '', toDate: '', reason: '' };

export default function TeamLeadDashboard() { // Team lead dashboard with light-weight leadership tools.
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
  const [leaves, setLeaves] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [taskForm, setTaskForm] = useState(initialTaskForm);
  const [statusMessage, setStatusMessage] = useState('');
  const [taskStatus, setTaskStatus] = useState('');
  const [leaveStatus, setLeaveStatus] = useState('');
  const [myAttendance, setMyAttendance] = useState([]);
  const [myAttendanceMsg, setMyAttendanceMsg] = useState('');
  const [myLeaves, setMyLeaves] = useState([]);
  const [myLeaveForm, setMyLeaveForm] = useState(initialMyLeaveForm);
  const [myLeaveStatus, setMyLeaveStatus] = useState({ message: '', isError: false });

  useEffect(() => {
    loadProfile();
    loadTeam();
    loadAttendance();
    loadLeaves();
    loadTasks();
    loadMyAttendance();
    loadMyLeaves();
  }, []);

  const pendingLeaves = useMemo(
    () => leaves.filter((leave) => leave.status === 'pending'),
    [leaves]
  );

  const taskTotals = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((task) => task.status === 'completed').length;
    const inProgress = tasks.filter((task) => task.status === 'processing').length;
    const planning = tasks.filter((task) => task.status === 'planning').length;
    return { total, completed, inProgress, planning };
  }, [tasks]);

  const attendanceStats = useMemo(() => {
    const present = attendance.filter((item) =>
      ['checked_in', 'checked_out'].includes(item.status)
    ).length;
    const checkedOut = attendance.filter((item) => item.status === 'checked_out').length;
    const missing = attendance.filter((item) => item.status === 'not_checked_in').length;
    return { present, checkedOut, missing };
  }, [attendance]);

  async function loadProfile() { // Fetch the lead's own profile.
    const res = await apiRequest('/api/employee/me');
    const data = await readJson(res);
    if (res.ok) {
      setProfile(data);
    } else {
      setStatusMessage(data?.message || 'Unable to load profile.');
    }
  }

  async function loadTeam() { // Load employee roster for visibility.
    const res = await apiRequest('/api/admin/employees');
    const data = await readJson(res);
    if (res.ok) {
      setTeam(Array.isArray(data) ? data : []);
    } else {
      setStatusMessage(data?.message || 'Failed to load team.');
    }
  }

  async function loadAttendance() { // Daily attendance snapshot across team.
    const res = await apiRequest('/api/admin/attendance/summary');
    const data = await readJson(res);
    if (res.ok) {
      setAttendance(Array.isArray(data) ? data : []);
    } else {
      setStatusMessage(data?.message || 'Failed to load attendance summary.');
    }
  }

  async function loadLeaves() { // Pending and recent leave requests.
    const res = await apiRequest('/api/admin/leave');
    const data = await readJson(res);
    if (res.ok) {
      setLeaves(Array.isArray(data) ? data : []);
    } else {
      setStatusMessage(data?.message || 'Failed to load leave requests.');
    }
  }

  async function loadTasks() { // Tasks assigned by leadership.
    const res = await apiRequest('/api/admin/tasks');
    const data = await readJson(res);
    if (res.ok) {
      setTasks(Array.isArray(data) ? data : []);
    } else {
      setTaskStatus(data?.message || 'Failed to load tasks.');
    }
  }

  async function loadMyAttendance() { // Fetch own attendance.
    const res = await apiRequest('/api/employee/attendance');
    const data = await readJson(res);
    if (res.ok) {
      setMyAttendance(Array.isArray(data) ? data : []);
    }
  }

  async function handleMyCheckIn() {
    setMyAttendanceMsg('Checking in...');
    const res = await apiRequest('/api/employee/attendance/check-in', { method: 'POST' });
    const data = await readJson(res);
    if (!res.ok) {
      setMyAttendanceMsg(data?.message || 'Failed to check in.');
      return;
    }
    setMyAttendanceMsg(data?.message || 'Checked in.');
    await loadMyAttendance();
  }

  async function handleMyCheckOut() {
    setMyAttendanceMsg('Checking out...');
    const res = await apiRequest('/api/employee/attendance/check-out', { method: 'POST' });
    const data = await readJson(res);
    if (!res.ok) {
      setMyAttendanceMsg(data?.message || 'Failed to check out.');
      return;
    }
    setMyAttendanceMsg(data?.message || 'Checked out.');
    await loadMyAttendance();
  }

  async function loadMyLeaves() { // Fetch own leave requests.
    const res = await apiRequest('/api/employee/leave');
    const data = await readJson(res);
    if (res.ok) {
      setMyLeaves(Array.isArray(data) ? data : []);
    }
  }

  const handleMyLeaveChange = (event) => {
    const { name, value } = event.target;
    setMyLeaveForm((prev) => ({ ...prev, [name]: value }));
  };

  async function handleMyLeaveSubmit(event) {
    event.preventDefault();
    setMyLeaveStatus({ message: 'Submitting leave...', isError: false });
    if (!myLeaveForm.fromDate || !myLeaveForm.toDate) {
      setMyLeaveStatus({ message: 'Select From and To dates.', isError: true });
      return;
    }
    const payload = {
      category: myLeaveForm.category,
      fromDate: myLeaveForm.fromDate,
      toDate: myLeaveForm.toDate,
      reason: myLeaveForm.reason
    };
    const res = await apiRequest('/api/employee/leave', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const data = await readJson(res);
    if (!res.ok) {
      setMyLeaveStatus({ message: data?.message || 'Failed to submit leave.', isError: true });
      return;
    }
    setMyLeaveStatus({ message: 'Leave request submitted.', isError: false });
    setMyLeaveForm(initialMyLeaveForm);
    await loadMyLeaves();
  }

  async function handleLeaveDecision(id, status) { // Approve or reject a leave.
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

  const handleTaskFormChange = (event) => { // Track task form fields.
    const { name, value } = event.target;
    setTaskForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAssignTask = async (event) => { // Assign a task to a teammate.
    event.preventDefault();
    setTaskStatus('Assigning...');
    if (!taskForm.employeeId || !taskForm.details || !taskForm.dueAt) {
      setTaskStatus('Employee, details, and due time are required.');
      return;
    }

    const res = await apiRequest('/api/admin/tasks', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: taskForm.employeeId,
        details: taskForm.details.trim(),
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
  };

  const handleLogout = async () => { // Logout and redirect.
    await apiRequest('/logout', {
      method: 'POST',
      body: JSON.stringify({ role: 'teamlead' })
    });
    window.location.assign('/login');
  };

  const recentTasks = tasks.slice(0, 6);
  const recentLeaves = leaves.slice(0, 6);

  return (
    <div className="dashboard">
      <Sidebar
        title="Team Lead Desk"
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
              <p className="helper">
                Monitor your team, approve leaves, and assign tasks in one place.
              </p>
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
              <div className="admin-profile" aria-label="Team lead profile">
                <div className="admin-avatar">
                  {(profile?.name || 'T').charAt(0).toUpperCase()}
                </div>
                <div className="admin-meta">
                  <span className="admin-name">{profile?.name || 'Team Lead'}</span>
                  <span className="admin-role">
                    {profile?.id ? `ID ${profile.id.slice(-6).toUpperCase()}` : 'TEAM LEAD'}
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
          <div className="grid-2">
            <div className="content-card">
              <div className="section-header">
                <h2 className="content-title">My Attendance</h2>
                <p className="helper">Check in/out for yourself.</p>
              </div>
              <div className="action-row">
                <button className="btn-primary" type="button" onClick={handleMyCheckIn}>
                  Check In
                </button>
                <button className="btn-ghost" type="button" onClick={handleMyCheckOut}>
                  Check Out
                </button>
              </div>
              <p className="helper" style={{ color: '#9fb3c8' }}>{myAttendanceMsg}</p>
              <table className="table table-responsive">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Check In</th>
                    <th>Check Out</th>
                  </tr>
                </thead>
                <tbody>
                  {myAttendance.length === 0 ? (
                    <tr>
                      <td colSpan="3">No records yet.</td>
                    </tr>
                  ) : (
                    myAttendance.map((row) => (
                      <tr key={row.id}>
                        <td data-label="Date">{row.date}</td>
                        <td data-label="Check In">{formatDateTime(row.checkInAt)}</td>
                        <td data-label="Check Out">{formatDateTime(row.checkOutAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="content-card">
              <div className="section-header">
                <h2 className="content-title">My Leave Requests</h2>
                <p className="helper">Submit your own leave.</p>
              </div>
              <form className="form-grid" onSubmit={handleMyLeaveSubmit}>
                <div>
                  <label htmlFor="tl-leave-category">Category</label>
                  <select
                    id="tl-leave-category"
                    name="category"
                    value={myLeaveForm.category}
                    onChange={handleMyLeaveChange}
                  >
                    <option value="sick">Sick</option>
                    <option value="casual">Casual</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="tl-leave-from">From</label>
                  <input
                    id="tl-leave-from"
                    name="fromDate"
                    type="date"
                    value={myLeaveForm.fromDate}
                    onChange={handleMyLeaveChange}
                  />
                </div>
                <div>
                  <label htmlFor="tl-leave-to">To</label>
                  <input
                    id="tl-leave-to"
                    name="toDate"
                    type="date"
                    value={myLeaveForm.toDate}
                    onChange={handleMyLeaveChange}
                  />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label htmlFor="tl-leave-reason">Reason</label>
                  <textarea
                    id="tl-leave-reason"
                    name="reason"
                    rows="2"
                    value={myLeaveForm.reason}
                    onChange={handleMyLeaveChange}
                    placeholder="Optional"
                  />
                </div>
                <button className="btn-primary" type="submit">
                  Submit Leave
                </button>
                <p
                  className="helper"
                  style={{ color: myLeaveStatus.isError ? '#c13e2d' : '#9fb3c8' }}
                >
                  {myLeaveStatus.message}
                </p>
              </form>
              <table className="table table-responsive">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {myLeaves.length === 0 ? (
                    <tr>
                      <td colSpan="4">No leave requests.</td>
                    </tr>
                  ) : (
                    myLeaves.map((leave) => (
                      <tr key={leave.id}>
                        <td data-label="Category">{leave.category}</td>
                        <td data-label="From">{formatDate(leave.fromDate)}</td>
                        <td data-label="To">{formatDate(leave.toDate)}</td>
                        <td data-label="Status">{leave.status}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid-3">
            <div className="content-card">
              <div className="insight-row">
                <div className="insight-card">
                  <span className="metric-label">Team Size</span>
                  <strong className="metric-value">{team.length}</strong>
                  <p className="helper">Employees you oversee</p>
                </div>
                <div className="insight-card">
                  <span className="metric-label">Present Today</span>
                  <strong className="metric-value">{attendanceStats.present}</strong>
                  <p className="helper">Checked in / out</p>
                </div>
                <div className="insight-card">
                  <span className="metric-label">Pending Leaves</span>
                  <strong className="metric-value">{pendingLeaves.length}</strong>
                  <p className="helper">Waiting for your decision</p>
                </div>
                <div className="insight-card">
                  <span className="metric-label">Active Tasks</span>
                  <strong className="metric-value">{taskTotals.inProgress + taskTotals.planning}</strong>
                  <p className="helper">In progress or planned</p>
                </div>
              </div>
            </div>

            <div className="content-card">
              <div className="section-header">
                <h2 className="content-title">Today&apos;s Attendance</h2>
                <span className="helper">
                  {attendanceStats.present} present · {attendanceStats.missing} missing
                </span>
              </div>
              <div className="table-scroll">
                <table className="table">
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
                        <td colSpan="4">No attendance yet.</td>
                      </tr>
                    ) : (
                      attendance.slice(0, 8).map((entry) => (
                        <tr key={entry.employee.id}>
                          <td data-label="Employee">{formatEmployeeLabel(entry.employee)}</td>
                          <td data-label="Status">{formatStatus(entry.status)}</td>
                          <td data-label="Check In">{formatDateTime(entry.checkInAt)}</td>
                          <td data-label="Check Out">{formatDateTime(entry.checkOutAt)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <section
          className={`section ${activeSection === 'team' ? 'active' : ''}`}
          data-section="team"
        >
          <div className="content-card">
            <div className="section-header">
              <h2 className="content-title">Team Directory</h2>
              <p className="helper">At-a-glance view of your direct reports.</p>
            </div>
            <div className="table-scroll">
              <table className="table table-responsive">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Department</th>
                    <th>Title</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {team.length === 0 ? (
                    <tr>
                      <td colSpan="5">No team members found.</td>
                    </tr>
                  ) : (
                    team.map((member) => (
                      <tr key={member.id}>
                        <td data-label="Name">{member.name}</td>
                        <td data-label="Email">{member.email}</td>
                        <td data-label="Department">{member.department || '-'}</td>
                        <td data-label="Title">{member.title || '-'}</td>
                        <td data-label="Status">{formatStatus(member.status)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section
          className={`section ${activeSection === 'leaves' ? 'active' : ''}`}
          data-section="leaves"
        >
          <div className="content-card">
            <div className="section-header">
              <h2 className="content-title">Leave Approvals</h2>
              <p className="helper">Approve or reject pending requests.</p>
            </div>
            {leaveStatus ? <p className="helper">{leaveStatus}</p> : null}
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Dates</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Requested</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {leaves.length === 0 ? (
                    <tr>
                      <td colSpan="6">No leave requests.</td>
                    </tr>
                  ) : (
                    leaves.map((leave) => (
                      <tr key={leave.id}>
                        <td data-label="Employee">{formatEmployeeLabel(leave.employee)}</td>
                        <td data-label="Dates">
                          {formatDate(leave.fromDate)} - {formatDate(leave.toDate)}
                        </td>
                        <td data-label="Category">{formatStatus(leave.category)}</td>
                        <td data-label="Status">{formatStatus(leave.status)}</td>
                        <td data-label="Requested">{formatDateTime(leave.createdAt)}</td>
                        <td>
                          {leave.status === 'pending' ? (
                            <div className="action-row">
                              <button
                                className="btn-primary"
                                type="button"
                                onClick={() => handleLeaveDecision(leave.id, 'approved')}
                              >
                                Approve
                              </button>
                              <button
                                className="btn-ghost"
                                type="button"
                                onClick={() => handleLeaveDecision(leave.id, 'rejected')}
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="pill">{formatStatus(leave.status)}</span>
                          )}
                        </td>
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
          <div className="grid-2">
            <div className="content-card">
              <div className="section-header">
                <h2 className="content-title">Assign Task</h2>
                <p className="helper">Send focused work items to your team.</p>
              </div>
              <form className="form-grid" onSubmit={handleAssignTask}>
                <div>
                  <label htmlFor="task-employee">Employee</label>
                  <select
                    id="task-employee"
                    name="employeeId"
                    value={taskForm.employeeId}
                    onChange={handleTaskFormChange}
                  >
                    <option value="">Select employee</option>
                    {team.map((member) => (
                      <option key={member.id} value={member.id}>
                        {formatEmployeeLabel(member)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="task-due">Due Time</label>
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
                    rows="3"
                    placeholder="Describe the outcome you expect"
                    value={taskForm.details}
                    onChange={handleTaskFormChange}
                  />
                </div>
                <button className="btn-primary" type="submit">
                  Assign Task
                </button>
                {taskStatus ? <p className="helper">{taskStatus}</p> : null}
              </form>
            </div>

            <div className="content-card">
              <div className="section-header">
                <h2 className="content-title">Recently Assigned</h2>
                <p className="helper">
                  {taskTotals.total} total · {taskTotals.completed} completed
                </p>
              </div>
              {recentTasks.length === 0 ? (
                <div className="notice">No tasks assigned yet.</div>
              ) : (
                <div className="task-card-grid">
                  {recentTasks.map((task) => {
                    const statusTone = task.status === 'completed' ? 'success' : 'warning';
                    return (
                      <div className="task-card" key={task.id}>
                        <div className="task-card-header">
                          <span className={`pill ${statusTone}`}>{formatStatus(task.status)}</span>
                          <span className="task-meta">{formatDateTime(task.dueAt)}</span>
                        </div>
                        <div className="task-title">{task.details}</div>
                        <div className="task-card-row">
                          <span>Assignee</span>
                          <strong>{task.employee?.name || 'Unknown'}</strong>
                        </div>
                        <div className="task-card-row">
                          <span>Assigned By</span>
                          <strong>{task.assignedBy?.name || 'You'}</strong>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

import { useEffect, useState } from 'react';
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

  useEffect(() => {
    loadProfile();
    loadAttendance();
    loadLeaves();
    loadTasks();
  }, []);

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
            </div>
          </div>

          <section
            className={`section ${activeSection === 'profile' ? 'active' : ''}`}
            data-section="profile"
          >
            <div className="content-card">
              <h2 className="content-title">Profile Overview</h2>
              {profileError ? (
                <div className="helper">{profileError}</div>
              ) : profile ? (
                <div className="helper">
                  <p>
                    <strong>Name:</strong> {profile.name}
                  </p>
                  <p>
                    <strong>Email:</strong> {profile.email}
                  </p>
                  <p>
                    <strong>Department:</strong> {profile.department || '-'}
                  </p>
                  <p>
                    <strong>Title:</strong> {profile.title || '-'}
                  </p>
                  <p>
                    <strong>Status:</strong> {profile.status}
                  </p>
                </div>
              ) : (
                <div className="helper">No profile found.</div>
              )}
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


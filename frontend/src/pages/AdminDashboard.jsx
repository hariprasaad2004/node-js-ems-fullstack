import { useEffect, useMemo, useState } from 'react';
import { apiRequest, readJson } from '../api/client.js';
import Sidebar from '../components/Sidebar.jsx';
import { useBodyClass } from '../hooks/useBodyClass.js';
import { formatDate, formatDateTime, formatEmployeeLabel, formatStatus } from '../utils/format.js';

const navItems = [
  { id: 'overview', label: 'Overview' },
  { id: 'employees', label: 'Employees' },
  { id: 'leave', label: 'Leave' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'policies', label: 'Policies' }
];

const initialFormState = {
  name: '',
  email: '',
  password: '',
  department: '',
  title: '',
  phone: '',
  address: '',
  salary: '',
  status: 'active'
};

const initialTaskState = {
  employeeId: '',
  details: '',
  dueAt: ''
};

export default function AdminDashboard() {
  useBodyClass('page-dashboard');

  const [activeSection, setActiveSection] = useState('overview');
  const [employees, setEmployees] = useState([]);
  const [employeeError, setEmployeeError] = useState('');
  const [attendance, setAttendance] = useState([]);
  const [attendanceError, setAttendanceError] = useState('');
  const [leaves, setLeaves] = useState([]);
  const [leaveError, setLeaveError] = useState('');
  const [tasks, setTasks] = useState([]);
  const [taskError, setTaskError] = useState('');
  const [formData, setFormData] = useState(initialFormState);
  const [editingId, setEditingId] = useState(null);
  const [formStatus, setFormStatus] = useState({ message: '', isError: false });
  const [leaveStatus, setLeaveStatus] = useState({ message: '', isError: false });
  const [taskStatus, setTaskStatus] = useState({ message: '', isError: false });
  const [taskForm, setTaskForm] = useState(initialTaskState);

  const stats = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((emp) => emp.status === 'active').length;
    return { total, active, inactive: total - active };
  }, [employees]);

  useEffect(() => {
    loadEmployees();
    loadLeaves();
    loadTasks();
  }, []);

  async function loadEmployees() {
    setEmployeeError('');
    const res = await apiRequest('/api/admin/employees');
    const data = await readJson(res);

    if (!res.ok) {
      setEmployeeError(data?.message || 'Failed to load employees.');
      setEmployees([]);
      return;
    }

    const list = Array.isArray(data) ? data : [];
    setEmployees(list);
    await loadAttendance();
  }

  async function loadAttendance() {
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

  async function loadLeaves() {
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

  async function loadTasks() {
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

  const handleFormChange = (event) => {
    const { id, value } = event.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleTaskChange = (event) => {
    const { name, value } = event.target;
    setTaskForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormStatus({ message: 'Saving...', isError: false });

    const payload = {
      name: formData.name.trim(),
      email: formData.email.trim(),
      password: formData.password.trim(),
      department: formData.department.trim(),
      title: formData.title.trim(),
      phone: formData.phone.trim(),
      address: formData.address.trim(),
      salary: formData.salary.trim(),
      status: formData.status
    };

    if (editingId && !payload.password) {
      delete payload.password;
    }

    const res = await apiRequest(
      editingId ? `/api/admin/employees/${editingId}` : '/api/admin/employees',
      {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify(payload)
      }
    );
    const data = await readJson(res);

    if (!res.ok) {
      setFormStatus({ message: data?.message || 'Failed to save.', isError: true });
      return;
    }

    setFormStatus({
      message: editingId ? 'Employee updated.' : 'Employee created.',
      isError: false
    });
    setEditingId(null);
    setFormData(initialFormState);
    await loadEmployees();
  };

  const handleEdit = (employee) => {
    setEditingId(employee.id);
    setFormData({
      name: employee.name || '',
      email: employee.email || '',
      password: '',
      department: employee.department || '',
      title: employee.title || '',
      phone: employee.phone || '',
      address: employee.address || '',
      salary: employee.salary ? String(employee.salary) : '',
      status: employee.status || 'active'
    });
    setFormStatus({ message: `Editing ${employee.name}`, isError: false });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setFormData(initialFormState);
    setFormStatus({ message: 'Edit canceled.', isError: false });
  };

  const handleDelete = async (employee) => {
    if (!window.confirm('Delete this employee?')) return;

    const res = await apiRequest(`/api/admin/employees/${employee.id}`, { method: 'DELETE' });
    const data = await readJson(res);

    if (!res.ok) {
      setFormStatus({ message: data?.message || 'Failed to delete.', isError: true });
      return;
    }

    setFormStatus({ message: 'Employee deleted.', isError: false });
    await loadEmployees();
  };

  const handleLeaveAction = async (leaveId, action) => {
    setLeaveStatus({ message: 'Updating leave request...', isError: false });
    const res = await apiRequest(`/api/admin/leave/${leaveId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: action })
    });
    const data = await readJson(res);

    if (!res.ok) {
      setLeaveStatus({ message: data?.message || 'Failed to update leave.', isError: true });
      return;
    }

    setLeaveStatus({ message: `Leave request ${action}.`, isError: false });
    await loadLeaves();
  };

  const handleAssignTask = async (event) => {
    event.preventDefault();
    setTaskStatus({ message: 'Assigning...', isError: false });

    const payload = {
      employeeId: taskForm.employeeId,
      details: taskForm.details.trim(),
      dueAt: taskForm.dueAt
    };

    if (!payload.employeeId) {
      setTaskStatus({ message: 'Select an employee first.', isError: true });
      return;
    }
    if (!payload.details) {
      setTaskStatus({ message: 'Enter task details.', isError: true });
      return;
    }
    if (!payload.dueAt) {
      setTaskStatus({ message: 'Select a due time.', isError: true });
      return;
    }

    const res = await apiRequest('/api/admin/tasks', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const data = await readJson(res);

    if (!res.ok) {
      setTaskStatus({ message: data?.message || 'Failed to assign task.', isError: true });
      return;
    }

    setTaskStatus({ message: 'Task assigned.', isError: false });
    setTaskForm(initialTaskState);
    await loadTasks();
  };

  const handleLogout = async () => {
    await apiRequest('/logout', { method: 'POST' });
    window.location.assign('/login');
  };

  return (
    <div className="dashboard">
      <Sidebar
        title="Admin"
        items={navItems}
        activeSection={activeSection}
        onSelect={setActiveSection}
      />

      <main className="content">
        <div className="content-card">
          <div className="toolbar">
            <div>
              <h1 className="page-title">Admin Dashboard</h1>
              <p className="helper">Manage employees, roles, and active status.</p>
            </div>
            <button className="btn-ghost" type="button" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>

        <section
          className={`section ${activeSection === 'overview' ? 'active' : ''}`}
          data-section="overview"
        >
          <div className="content-card">
            <h2 className="content-title">Dashboard Overview</h2>
            <p className="helper">Quick snapshot of your workforce and recent activity.</p>
          </div>
          <div className="stats">
            <div className="content-card stat-card">
              <div className="helper">Total Employees</div>
              <div className="stat-value">{stats.total}</div>
            </div>
            <div className="content-card stat-card">
              <div className="helper">Active</div>
              <div className="stat-value">{stats.active}</div>
            </div>
            <div className="content-card stat-card">
              <div className="helper">Inactive</div>
              <div className="stat-value">{stats.inactive}</div>
            </div>
          </div>
        </section>

        <section
          className={`section ${activeSection === 'employees' ? 'active' : ''}`}
          data-section="employees"
        >
          <div className="grid-2">
            <div className="content-card">
              <h2 className="content-title">Employees</h2>
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Department</th>
                    <th>Title</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {employeeError ? (
                    <tr>
                      <td colSpan="6">{employeeError}</td>
                    </tr>
                  ) : employees.length === 0 ? (
                    <tr>
                      <td colSpan="6">No employees found.</td>
                    </tr>
                  ) : (
                    employees.map((employee) => (
                      <tr key={employee.id}>
                        <td>{employee.name}</td>
                        <td>{employee.department || '-'}</td>
                        <td>{employee.title || '-'}</td>
                        <td>{employee.email}</td>
                        <td>
                          <span
                            className={`status-pill ${
                              employee.status === 'active' ? '' : 'inactive'
                            }`}
                          >
                            {employee.status}
                          </span>
                        </td>
                        <td>
                          <div className="action-row">
                            <button
                              className="btn-ghost"
                              type="button"
                              onClick={() => handleEdit(employee)}
                            >
                              Edit
                            </button>
                            <button
                              className="btn-danger"
                              type="button"
                              onClick={() => handleDelete(employee)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="content-card">
              <h2 className="content-title">Add / Edit Employee</h2>
              <form className="form-grid" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="name">Full Name</label>
                  <input
                    id="name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={handleFormChange}
                  />
                </div>
                <div>
                  <label htmlFor="email">Email</label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={handleFormChange}
                  />
                </div>
                <div>
                  <label htmlFor="password">Password</label>
                  <input
                    id="password"
                    type="text"
                    placeholder={
                      editingId ? 'Leave blank to keep existing password' : 'Set initial password'
                    }
                    value={formData.password}
                    onChange={handleFormChange}
                  />
                </div>
                <div>
                  <label htmlFor="department">Department</label>
                  <input
                    id="department"
                    type="text"
                    value={formData.department}
                    onChange={handleFormChange}
                  />
                </div>
                <div>
                  <label htmlFor="title">Job Title</label>
                  <input
                    id="title"
                    type="text"
                    value={formData.title}
                    onChange={handleFormChange}
                  />
                </div>
                <div>
                  <label htmlFor="phone">Phone</label>
                  <input
                    id="phone"
                    type="text"
                    value={formData.phone}
                    onChange={handleFormChange}
                  />
                </div>
                <div>
                  <label htmlFor="address">Address</label>
                  <textarea
                    id="address"
                    value={formData.address}
                    onChange={handleFormChange}
                  />
                </div>
                <div>
                  <label htmlFor="salary">Salary</label>
                  <input
                    id="salary"
                    type="number"
                    value={formData.salary}
                    onChange={handleFormChange}
                  />
                </div>
                <div>
                  <label htmlFor="status">Status</label>
                  <select id="status" value={formData.status} onChange={handleFormChange}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <button className="btn-primary" type="submit">
                  {editingId ? 'Update Employee' : 'Add Employee'}
                </button>
                {editingId ? (
                  <button className="btn-ghost" type="button" onClick={handleCancelEdit}>
                    Cancel Edit
                  </button>
                ) : null}
                <p
                  className="helper"
                  style={{ color: formStatus.isError ? '#c13e2d' : '#0e7c7b' }}
                >
                  {formStatus.message}
                </p>
              </form>
            </div>
          </div>
        </section>

        <section
          className={`section ${activeSection === 'leave' ? 'active' : ''}`}
          data-section="leave"
        >
          <div className="content-card">
            <h2 className="content-title">Leave Requests</h2>
            <p className="helper">Track and approve leave requests from employees.</p>
            <p
              className="helper"
              style={{ color: leaveStatus.isError ? '#c13e2d' : '#0e7c7b' }}
            >
              {leaveStatus.message}
            </p>
            <table className="table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Category</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {leaveError ? (
                  <tr>
                    <td colSpan="7">{leaveError}</td>
                  </tr>
                ) : leaves.length === 0 ? (
                  <tr>
                    <td colSpan="7">No leave requests yet.</td>
                  </tr>
                ) : (
                  leaves.map((leave) => (
                    <tr key={leave.id}>
                      <td>
                        {leave.employee
                          ? `${leave.employee.name} (${leave.employee.email})`
                          : 'Unknown'}
                      </td>
                      <td>{leave.category || 'casual'}</td>
                      <td>{formatDate(leave.fromDate)}</td>
                      <td>{formatDate(leave.toDate)}</td>
                      <td>{leave.reason || '-'}</td>
                      <td>{leave.status}</td>
                      <td>
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
                          '-'
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section
          className={`section ${activeSection === 'attendance' ? 'active' : ''}`}
          data-section="attendance"
        >
          <div className="content-card">
            <h2 className="content-title">Attendance Snapshot</h2>
            <p className="helper">Monitor daily check-ins and hours.</p>
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
                {attendanceError ? (
                  <tr>
                    <td colSpan="4">{attendanceError}</td>
                  </tr>
                ) : attendance.length === 0 ? (
                  <tr>
                    <td colSpan="4">Attendance data will appear here.</td>
                  </tr>
                ) : (
                  attendance.map((record, index) => (
                    <tr key={`${record.employee?.id || 'unknown'}-${index}`}>
                      <td>
                        {record.employee
                          ? `${record.employee.name} (${record.employee.email})`
                          : 'Unknown'}
                      </td>
                      <td>{formatStatus(record.status)}</td>
                      <td>{formatDateTime(record.checkInAt)}</td>
                      <td>{formatDateTime(record.checkOutAt)}</td>
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
            <h2 className="content-title">Assign Task</h2>
            <form className="form-grid" onSubmit={handleAssignTask}>
              <div>
                <label htmlFor="task-employee">Employee</label>
                <select
                  id="task-employee"
                  name="employeeId"
                  value={taskForm.employeeId}
                  onChange={handleTaskChange}
                  disabled={employees.length === 0}
                >
                  <option value="">
                    {employees.length === 0 ? 'No employees available' : 'Select employee'}
                  </option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {formatEmployeeLabel(employee)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="task-details">Task</label>
                <textarea
                  id="task-details"
                  name="details"
                  placeholder="Describe the task"
                  value={taskForm.details}
                  onChange={handleTaskChange}
                />
              </div>
              <div>
                <label htmlFor="task-due">Due Time</label>
                <input
                  id="task-due"
                  name="dueAt"
                  type="datetime-local"
                  value={taskForm.dueAt}
                  onChange={handleTaskChange}
                />
              </div>
              <button className="btn-primary" type="submit">
                Assign
              </button>
              <p
                className="helper"
                style={{ color: taskStatus.isError ? '#c13e2d' : '#0e7c7b' }}
              >
                {taskStatus.message}
              </p>
            </form>
            <table className="table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Task</th>
                  <th>Status</th>
                  <th>Due Time</th>
                  <th>Assigned</th>
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
                  tasks.map((task) => (
                    <tr key={task.id}>
                      <td>
                        {task.employee ? `${task.employee.name} (${task.employee.email})` : 'Unknown'}
                      </td>
                      <td>{task.details}</td>
                      <td>{task.status}</td>
                      <td>{formatDateTime(task.dueAt)}</td>
                      <td>{formatDateTime(task.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section
          className={`section ${activeSection === 'policies' ? 'active' : ''}`}
          data-section="policies"
        >
          <div className="content-card">
            <h2 className="content-title">Company Policies</h2>
            <ul className="policy-list">
              <li>Code of Conduct</li>
              <li>Leave & Attendance Guidelines</li>
              <li>Security & Data Access</li>
              <li>Remote Work Policy</li>
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}

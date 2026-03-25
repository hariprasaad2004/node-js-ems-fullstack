const tableBody = document.getElementById('employee-table-body');
const form = document.getElementById('employee-form');
const statusBox = document.getElementById('form-status');
const cancelBtn = document.getElementById('cancel-edit');
const logoutBtn = document.getElementById('logout-btn');
const navItems = document.querySelectorAll('.nav-item[data-section]');
const sections = document.querySelectorAll('.section');
const leaveTableBody = document.getElementById('leave-table-body');
const leaveStatus = document.getElementById('leave-status');
const attendanceTableBody = document.getElementById('attendance-table-body');
const taskForm = document.getElementById('task-form');
const taskEmployeeSelect = document.getElementById('task-employee');
const taskDetails = document.getElementById('task-details');
const taskStatus = document.getElementById('task-status');
const taskTableBody = document.getElementById('task-table-body');

let editingId = null;
let cachedEmployees = [];

function setActiveSection(sectionId) {
  sections.forEach((section) => {
    section.classList.toggle('active', section.dataset.section === sectionId);
  });
  navItems.forEach((item) => {
    item.classList.toggle('active', item.dataset.section === sectionId);
  });
}

function initNavigation() {
  if (!navItems.length || !sections.length) return;
  navItems.forEach((item) => {
    item.addEventListener('click', () => setActiveSection(item.dataset.section));
  });
  const initial =
    document.querySelector('.nav-item.active')?.dataset.section || navItems[0].dataset.section;
  setActiveSection(initial);
}

const fields = {
  name: document.getElementById('name'),
  email: document.getElementById('email'),
  password: document.getElementById('password'),
  department: document.getElementById('department'),
  title: document.getElementById('title'),
  phone: document.getElementById('phone'),
  address: document.getElementById('address'),
  salary: document.getElementById('salary'),
  status: document.getElementById('status')
};

function setStatus(message, isError = false) {
  statusBox.textContent = message;
  statusBox.style.color = isError ? '#c13e2d' : '#0e7c7b';
}

function setInlineStatus(target, message, isError = false) {
  if (!target) return;
  target.textContent = message;
  target.style.color = isError ? '#c13e2d' : '#0e7c7b';
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString();
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

function formatDuration(startValue, endValue) {
  if (!startValue || !endValue) return '-';
  const start = new Date(startValue);
  const end = new Date(endValue);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '-';
  const minutes = Math.max(0, Math.round((end - start) / 60000));
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

function formatStatus(status) {
  if (!status) return '-';
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatEmployeeLabel(emp) {
  const dept = emp.department ? ` (${emp.department})` : '';
  return `${emp.name}${dept} — ${emp.email}`;
}

function renderEmployeeOptionsFor(selectEl, employees, placeholderLabel) {
  if (!selectEl) return;
  if (!employees.length) {
    selectEl.innerHTML = '<option value="">No employees available</option>';
    selectEl.disabled = true;
    return;
  }
  selectEl.disabled = false;
  const options = employees
    .map((emp) => `<option value="${emp.id}">${formatEmployeeLabel(emp)}</option>`)
    .join('');
  selectEl.innerHTML = `<option value="">${placeholderLabel}</option>${options}`;
}

function renderEmployeeOptions(employees) {
  renderEmployeeOptionsFor(taskEmployeeSelect, employees, 'Select employee');
}

function resetForm() {
  editingId = null;
  form.reset();
  fields.password.placeholder = 'Set initial password';
  form.querySelector('button[type="submit"]').textContent = 'Add Employee';
  cancelBtn.style.display = 'none';
}

function renderStats(employees) {
  const total = employees.length;
  const active = employees.filter((emp) => emp.status === 'active').length;
  const inactive = total - active;

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-active').textContent = active;
  document.getElementById('stat-inactive').textContent = inactive;
}

async function loadEmployees() {
  const res = await fetch('/api/admin/employees');
  if (!res.ok) {
    tableBody.innerHTML = '<tr><td colspan="6">Failed to load employees.</td></tr>';
    return;
  }
  const employees = await res.json();
  cachedEmployees = employees;
  renderStats(employees);
  renderEmployeeOptions(employees);
  loadAttendance();
  if (employees.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="6">No employees found.</td></tr>';
    return;
  }
  tableBody.innerHTML = employees
    .map((emp) => {
      const statusClass = emp.status === 'active' ? '' : 'inactive';
      return `
        <tr>
          <td>${emp.name}</td>
          <td>${emp.department || '-'}</td>
          <td>${emp.title || '-'}</td>
          <td>${emp.email}</td>
          <td><span class="status-pill ${statusClass}">${emp.status}</span></td>
          <td>
            <div class="action-row">
              <button class="btn-ghost" data-edit="${emp.id}">Edit</button>
              <button class="btn-danger" data-delete="${emp.id}">Delete</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');
}

async function loadAttendance() {
  if (!attendanceTableBody) return;
  const res = await fetch('/api/admin/attendance/summary');
  if (!res.ok) {
    attendanceTableBody.innerHTML = '<tr><td colspan="4">Failed to load attendance.</td></tr>';
    return;
  }
  const records = await res.json();
  if (records.length === 0) {
    attendanceTableBody.innerHTML = '<tr><td colspan="4">No attendance records yet.</td></tr>';
    return;
  }
  attendanceTableBody.innerHTML = records
    .map((record) => {
      const employee = record.employee
        ? `${record.employee.name} (${record.employee.email})`
        : 'Unknown';
      return `
        <tr>
          <td>${employee}</td>
          <td>${formatStatus(record.status)}</td>
          <td>${formatDateTime(record.checkInAt)}</td>
          <td>${formatDateTime(record.checkOutAt)}</td>
        </tr>
      `;
    })
    .join('');
}

async function loadLeaves() {
  if (!leaveTableBody) return;
  const res = await fetch('/api/admin/leave');
  if (!res.ok) {
    leaveTableBody.innerHTML = '<tr><td colspan="6">Failed to load leave requests.</td></tr>';
    return;
  }
  const leaves = await res.json();
  if (leaves.length === 0) {
    leaveTableBody.innerHTML = '<tr><td colspan="6">No leave requests yet.</td></tr>';
    return;
  }
  leaveTableBody.innerHTML = leaves
    .map((leave) => {
      const employee = leave.employee
        ? `${leave.employee.name} (${leave.employee.email})`
        : 'Unknown';
      const actionButtons =
        leave.status === 'pending'
          ? `
            <button class="btn-ghost" data-leave-action="approved" data-leave-id="${leave.id}">
              Approve
            </button>
            <button class="btn-danger" data-leave-action="rejected" data-leave-id="${leave.id}">
              Reject
            </button>
          `
          : '-';
      return `
        <tr>
          <td>${employee}</td>
          <td>${formatDate(leave.fromDate)}</td>
          <td>${formatDate(leave.toDate)}</td>
          <td>${leave.reason || '-'}</td>
          <td>${leave.status}</td>
          <td>${actionButtons}</td>
        </tr>
      `;
    })
    .join('');
}

async function loadTasks() {
  if (!taskTableBody) return;
  const res = await fetch('/api/admin/tasks');
  if (!res.ok) {
    taskTableBody.innerHTML = '<tr><td colspan="4">Failed to load tasks.</td></tr>';
    return;
  }
  const tasks = await res.json();
  if (tasks.length === 0) {
    taskTableBody.innerHTML = '<tr><td colspan="4">No tasks assigned yet.</td></tr>';
    return;
  }
  taskTableBody.innerHTML = tasks
    .map((task) => {
      const employee = task.employee ? `${task.employee.name} (${task.employee.email})` : 'Unknown';
      return `
        <tr>
          <td>${employee}</td>
          <td>${task.details}</td>
          <td>${task.status}</td>
          <td>${formatDateTime(task.createdAt)}</td>
        </tr>
      `;
    })
    .join('');
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus('Saving...');

  const payload = {
    name: fields.name.value.trim(),
    email: fields.email.value.trim(),
    password: fields.password.value.trim(),
    department: fields.department.value.trim(),
    title: fields.title.value.trim(),
    phone: fields.phone.value.trim(),
    address: fields.address.value.trim(),
    salary: fields.salary.value.trim(),
    status: fields.status.value
  };

  if (editingId && !payload.password) {
    delete payload.password;
  }

  const res = await fetch(editingId ? `/api/admin/employees/${editingId}` : '/api/admin/employees', {
    method: editingId ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok) {
    setStatus(data.message || 'Failed to save.', true);
    return;
  }

  setStatus(editingId ? 'Employee updated.' : 'Employee created.');
  resetForm();
  await loadEmployees();
});

if (taskForm) {
  taskForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    setInlineStatus(taskStatus, 'Assigning...');

    const detailsValue = taskDetails ? taskDetails.value.trim() : '';
    const payload = {
      employeeId: taskEmployeeSelect ? taskEmployeeSelect.value : '',
      details: detailsValue
    };

    if (!payload.employeeId) {
      setInlineStatus(taskStatus, 'Select an employee first.', true);
      return;
    }
    if (!payload.details) {
      setInlineStatus(taskStatus, 'Enter task details.', true);
      return;
    }

    const res = await fetch('/api/admin/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      setInlineStatus(taskStatus, data.message || 'Failed to assign task.', true);
      return;
    }

    setInlineStatus(taskStatus, 'Task assigned.');
    if (taskDetails) taskDetails.value = '';
    await loadTasks();
  });
}

cancelBtn.addEventListener('click', () => {
  resetForm();
  setStatus('Edit canceled.');
});

logoutBtn.addEventListener('click', async () => {
  await fetch('/logout', { method: 'POST' });
  window.location.href = '/login';
});

document.addEventListener('click', async (event) => {
  const editId = event.target.getAttribute('data-edit');
  const deleteId = event.target.getAttribute('data-delete');
  const leaveAction = event.target.getAttribute('data-leave-action');
  const leaveId = event.target.getAttribute('data-leave-id');

  if (editId) {
    let employees = cachedEmployees;
    if (!employees.length) {
      const res = await fetch('/api/admin/employees');
      employees = await res.json();
    }
    const emp = employees.find((item) => item.id === editId);
    if (!emp) return;

    editingId = editId;
    fields.name.value = emp.name;
    fields.email.value = emp.email;
    fields.password.value = '';
    fields.password.placeholder = 'Leave blank to keep existing password';
    fields.department.value = emp.department || '';
    fields.title.value = emp.title || '';
    fields.phone.value = emp.phone || '';
    fields.address.value = emp.address || '';
    fields.salary.value = emp.salary || '';
    fields.status.value = emp.status;

    form.querySelector('button[type="submit"]').textContent = 'Update Employee';
    cancelBtn.style.display = 'inline-flex';
    setStatus(`Editing ${emp.name}`);
  }

  if (deleteId) {
    if (!confirm('Delete this employee?')) return;

    const res = await fetch(`/api/admin/employees/${deleteId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      setStatus(data.message || 'Failed to delete.', true);
      return;
    }
    setStatus('Employee deleted.');
    await loadEmployees();
  }

  if (leaveAction && leaveId) {
    setInlineStatus(leaveStatus, 'Updating leave request...');
    const res = await fetch(`/api/admin/leave/${leaveId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: leaveAction })
    });
    const data = await res.json();
    if (!res.ok) {
      setInlineStatus(leaveStatus, data.message || 'Failed to update leave.', true);
      return;
    }
    setInlineStatus(leaveStatus, `Leave request ${leaveAction}.`);
    await loadLeaves();
  }
});

resetForm();
initNavigation();
loadEmployees();
loadLeaves();
loadTasks();

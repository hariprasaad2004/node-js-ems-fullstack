const tableBody = document.getElementById('employee-table-body');
const form = document.getElementById('employee-form');
const statusBox = document.getElementById('form-status');
const cancelBtn = document.getElementById('cancel-edit');
const logoutBtn = document.getElementById('logout-btn');
const navItems = document.querySelectorAll('.nav-item[data-section]');
const sections = document.querySelectorAll('.section');

let editingId = null;

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
  renderStats(employees);
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

  if (editId) {
    const res = await fetch('/api/admin/employees');
    const employees = await res.json();
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
});

resetForm();
initNavigation();
loadEmployees();

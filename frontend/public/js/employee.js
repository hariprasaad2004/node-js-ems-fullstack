const profileBox = document.getElementById('profile');
const form = document.getElementById('profile-form');
const statusBox = document.getElementById('profile-status');
const logoutBtn = document.getElementById('logout-btn');
const navItems = document.querySelectorAll('.nav-item[data-section]');
const sections = document.querySelectorAll('.section');
const checkInBtn = document.getElementById('check-in-btn');
const checkOutBtn = document.getElementById('check-out-btn');
const attendanceStatus = document.getElementById('attendance-status');
const attendanceTableBody = document.getElementById('attendance-table-body');
const leaveForm = document.getElementById('leave-form');
const leaveStatus = document.getElementById('leave-status');
const leaveTableBody = document.getElementById('leave-table-body');
const taskTableBody = document.getElementById('task-table-body');

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

async function loadProfile() {
  const res = await fetch('/api/employee/me');
  if (!res.ok) {
    profileBox.innerHTML = '<p>No profile found.</p>';
    return;
  }

  const data = await res.json();
  profileBox.innerHTML = `
    <p><strong>Name:</strong> ${data.name}</p>
    <p><strong>Email:</strong> ${data.email}</p>
    <p><strong>Department:</strong> ${data.department || '-'}</p>
    <p><strong>Title:</strong> ${data.title || '-'}</p>
    <p><strong>Status:</strong> ${data.status}</p>
  `;

  document.getElementById('phone').value = data.phone || '';
  document.getElementById('address').value = data.address || '';
}

async function loadAttendance() {
  if (!attendanceTableBody) return;
  const res = await fetch('/api/employee/attendance');
  if (!res.ok) {
    attendanceTableBody.innerHTML = '<tr><td colspan="4">Failed to load attendance.</td></tr>';
    return;
  }
  const records = await res.json();
  if (records.length === 0) {
    attendanceTableBody.innerHTML = '<tr><td colspan="4">No attendance yet.</td></tr>';
    return;
  }
  attendanceTableBody.innerHTML = records
    .map((record) => {
      return `
        <tr>
          <td>${record.date}</td>
          <td>${formatDateTime(record.checkInAt)}</td>
          <td>${formatDateTime(record.checkOutAt)}</td>
          <td>${formatDuration(record.checkInAt, record.checkOutAt)}</td>
        </tr>
      `;
    })
    .join('');
}

async function loadLeaves() {
  if (!leaveTableBody) return;
  const res = await fetch('/api/employee/leave');
  if (!res.ok) {
    leaveTableBody.innerHTML = '<tr><td colspan="4">Failed to load leave requests.</td></tr>';
    return;
  }
  const leaves = await res.json();
  if (leaves.length === 0) {
    leaveTableBody.innerHTML = '<tr><td colspan="4">No leave requests yet.</td></tr>';
    return;
  }
  leaveTableBody.innerHTML = leaves
    .map((leave) => {
      return `
        <tr>
          <td>${formatDate(leave.fromDate)}</td>
          <td>${formatDate(leave.toDate)}</td>
          <td>${leave.status}</td>
          <td>${formatDateTime(leave.createdAt)}</td>
        </tr>
      `;
    })
    .join('');
}

async function loadTasks() {
  if (!taskTableBody) return;
  const res = await fetch('/api/employee/tasks');
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
      const assignedBy = task.assignedBy
        ? `${task.assignedBy.name || 'Admin'} (${task.assignedBy.email || ''})`
        : 'Admin';
      return `
        <tr>
          <td>${task.details}</td>
          <td>${task.status}</td>
          <td>${assignedBy}</td>
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
    phone: document.getElementById('phone').value.trim(),
    address: document.getElementById('address').value.trim()
  };

  const res = await fetch('/api/employee/me', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok) {
    setStatus(data.message || 'Failed to update.', true);
    return;
  }

  setStatus('Profile updated.');
  await loadProfile();
});

if (checkInBtn) {
  checkInBtn.addEventListener('click', async () => {
    setInlineStatus(attendanceStatus, 'Checking in...');
    const res = await fetch('/api/employee/attendance/check-in', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      setInlineStatus(attendanceStatus, data.message || 'Failed to check in.', true);
      return;
    }
    setInlineStatus(attendanceStatus, `Checked in at ${formatDateTime(data.checkInAt)}.`);
    await loadAttendance();
  });
}

if (checkOutBtn) {
  checkOutBtn.addEventListener('click', async () => {
    setInlineStatus(attendanceStatus, 'Checking out...');
    const res = await fetch('/api/employee/attendance/check-out', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      setInlineStatus(attendanceStatus, data.message || 'Failed to check out.', true);
      return;
    }
    setInlineStatus(attendanceStatus, `Checked out at ${formatDateTime(data.checkOutAt)}.`);
    await loadAttendance();
  });
}

if (leaveForm) {
  leaveForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    setInlineStatus(leaveStatus, 'Submitting...');

    const payload = {
      fromDate: document.getElementById('leave-from').value,
      toDate: document.getElementById('leave-to').value,
      reason: document.getElementById('leave-reason').value.trim()
    };

    if (!payload.fromDate || !payload.toDate) {
      setInlineStatus(leaveStatus, 'Select both From and To dates.', true);
      return;
    }

    const res = await fetch('/api/employee/leave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      setInlineStatus(leaveStatus, data.message || 'Failed to submit leave request.', true);
      return;
    }

    setInlineStatus(leaveStatus, 'Leave request submitted.');
    leaveForm.reset();
    await loadLeaves();
  });
}

logoutBtn.addEventListener('click', async () => {
  await fetch('/logout', { method: 'POST' });
  window.location.href = '/login';
});

initNavigation();
loadProfile();
loadAttendance();
loadLeaves();
loadTasks();

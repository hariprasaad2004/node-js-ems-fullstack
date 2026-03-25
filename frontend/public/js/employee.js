const profileBox = document.getElementById('profile');
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
const taskStatusBox = document.getElementById('task-status');
const leaveCategory = document.getElementById('leave-category');
const leaveModal = document.getElementById('leave-modal');
const leaveModalMessage = document.getElementById('leave-modal-message');
const leaveModalClose = document.getElementById('leave-modal-close');
const leaveModalBackdrop = document.querySelector('#leave-modal [data-modal-close]');

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
    leaveTableBody.innerHTML = '<tr><td colspan="5">Failed to load leave requests.</td></tr>';
    return;
  }
  const leaves = await res.json();
  if (leaves.length === 0) {
    leaveTableBody.innerHTML = '<tr><td colspan="5">No leave requests yet.</td></tr>';
    return;
  }
  leaveTableBody.innerHTML = leaves
    .map((leave) => {
      return `
        <tr>
          <td>${leave.category || 'casual'}</td>
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
    taskTableBody.innerHTML = '<tr><td colspan="5">Failed to load tasks.</td></tr>';
    return;
  }
  const tasks = await res.json();
  if (tasks.length === 0) {
    taskTableBody.innerHTML = '<tr><td colspan="5">No tasks assigned yet.</td></tr>';
    return;
  }
  taskTableBody.innerHTML = tasks
    .map((task) => {
      const assignedBy = task.assignedBy
        ? `${task.assignedBy.name || 'Admin'} (${task.assignedBy.email || ''})`
        : 'Admin';
      const statusValue = task.status || 'planning';
      return `
        <tr>
          <td>${task.details}</td>
          <td>
            <select data-task-id="${task.id}" data-current="${statusValue}">
              <option value="planning" ${statusValue === 'planning' ? 'selected' : ''}>Planning</option>
              <option value="processing" ${statusValue === 'processing' ? 'selected' : ''}>Processing</option>
              <option value="completed" ${statusValue === 'completed' ? 'selected' : ''}>Completed</option>
            </select>
          </td>
          <td>${formatDateTime(task.dueAt)}</td>
          <td>${assignedBy}</td>
          <td>${formatDateTime(task.createdAt)}</td>
        </tr>
      `;
    })
    .join('');
}

if (checkInBtn) {
  checkInBtn.addEventListener('click', async () => {
    setInlineStatus(attendanceStatus, 'Checking in...');
    const res = await fetch('/api/employee/attendance/check-in', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      setInlineStatus(attendanceStatus, data.message || 'Failed to check in.', true);
      return;
    }
    if (data.message) {
      const suffix = data.checkInAt ? ` at ${formatDateTime(data.checkInAt)}` : '';
      setInlineStatus(attendanceStatus, `${data.message}${suffix}`);
    } else {
      setInlineStatus(attendanceStatus, `Checked in at ${formatDateTime(data.checkInAt)}.`);
    }
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
    if (data.message) {
      const suffix = data.checkOutAt ? ` at ${formatDateTime(data.checkOutAt)}` : '';
      setInlineStatus(attendanceStatus, `${data.message}${suffix}`);
    } else {
      setInlineStatus(attendanceStatus, `Checked out at ${formatDateTime(data.checkOutAt)}.`);
    }
    await loadAttendance();
  });
}

if (leaveForm) {
  leaveForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    setInlineStatus(leaveStatus, 'Submitting...');

    const payload = {
      category: leaveCategory ? leaveCategory.value : 'casual',
      fromDate: document.getElementById('leave-from').value,
      toDate: document.getElementById('leave-to').value,
      reason: document.getElementById('leave-reason').value.trim()
    };

    if (!payload.fromDate || !payload.toDate) {
      setInlineStatus(leaveStatus, 'Select both From and To dates.', true);
      return;
    }

    if (payload.category === 'casual') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const fromDay = new Date(payload.fromDate);
      fromDay.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((fromDay - today) / (1000 * 60 * 60 * 24));
      const casualLeadDays = 2;
      if (diffDays < casualLeadDays) {
        if (leaveModal && leaveModalMessage) {
          leaveModalMessage.textContent =
            'Casual leave must be requested at least 2 days in advance. Please choose a later date or another category.';
          leaveModal.classList.add('active');
          leaveModal.setAttribute('aria-hidden', 'false');
        }
        setInlineStatus(leaveStatus, 'Casual leave needs 2 days advance notice.', true);
        return;
      }
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
    if (leaveCategory) leaveCategory.value = 'casual';
    await loadLeaves();
  });
}

if (leaveModalClose) {
  leaveModalClose.addEventListener('click', () => {
    leaveModal.classList.remove('active');
    leaveModal.setAttribute('aria-hidden', 'true');
  });
}

if (leaveModalBackdrop) {
  leaveModalBackdrop.addEventListener('click', () => {
    leaveModal.classList.remove('active');
    leaveModal.setAttribute('aria-hidden', 'true');
  });
}

if (taskTableBody) {
  taskTableBody.addEventListener('change', async (event) => {
    const select = event.target.closest('select[data-task-id]');
    if (!select) return;

    const taskId = select.getAttribute('data-task-id');
    const previous = select.getAttribute('data-current');
    const nextStatus = select.value;

    const res = await fetch(`/api/employee/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus })
    });

    const data = await res.json();
    if (!res.ok) {
      select.value = previous || 'planning';
      setInlineStatus(taskStatusBox, data.message || 'Failed to update task status.', true);
      return;
    }

    select.setAttribute('data-current', data.status);
    setInlineStatus(taskStatusBox, 'Task status updated.');
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

const profileBox = document.getElementById('profile');
const form = document.getElementById('profile-form');
const statusBox = document.getElementById('profile-status');
const logoutBtn = document.getElementById('logout-btn');
const navItems = document.querySelectorAll('.nav-item[data-section]');
const sections = document.querySelectorAll('.section');

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

logoutBtn.addEventListener('click', async () => {
  await fetch('/logout', { method: 'POST' });
  window.location.href = '/login';
});

initNavigation();
loadProfile();

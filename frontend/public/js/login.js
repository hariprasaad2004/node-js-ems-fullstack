const form = document.getElementById('login-form');
const errorBox = document.getElementById('login-error');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorBox.textContent = '';

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();

  try {
    const payload = { email };
    if (password) {
      payload.password = password;
    }

    const res = await fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      errorBox.textContent = data.message || 'Login failed.';
      return;
    }

    if (data.role === 'admin') {
      window.location.href = '/admin';
    } else {
      window.location.href = '/employee';
    }
  } catch (err) {
    errorBox.textContent = 'Unable to reach server.';
  }
});

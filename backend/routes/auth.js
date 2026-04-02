const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const router = express.Router();

const rootDir = path.join(__dirname, '..', '..');
const frontendIndex = path.join(rootDir, 'frontend', 'dist', 'index.html');

router.get('/login', (req, res) => { // Serve the SPA for the login route.
  return res.sendFile(frontendIndex);
});

router.post('/login', async (req, res) => { // Handle login and create a session.
  try {
    const { email, password } = req.body;
    const allowPasswordless =
      process.env.ALLOW_PASSWORDLESS === 'true' ||
      process.env.NODE_ENV !== 'production'; // default to passwordless in dev for easier QA.

    if (!email || (!password && !allowPasswordless)) {
      return res.status(400).json({ message: 'Email and password are required.' });
      
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ message: 'Account is inactive.' });
    }

    // Allow all supported dashboards.
    const allowedRoles = ['admin', 'manager', 'teamlead', 'employee'];
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ message: 'This role is disabled for login.' });
    }

    if (!allowPasswordless) {
      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) {
        return res.status(401).json({ message: 'Invalid credentials.' });
      }
    }

    // Reset any previously stored roles so a new login cannot leak data from another account.
    req.session.roles = {};
    req.session.roles[user.role] = { userId: user._id.toString() };
    req.session.lastRole = user.role;

    return res.json({ role: user.role });
  } catch (err) {
    return res.status(500).json({ message: 'Login failed.' });
  }
});

router.post('/logout', (req, res) => { // Destroy the session and log out.
  const role = req.body?.role || req.query?.role;

  if (role) {
    if (req.session?.roles?.[role]) {
      delete req.session.roles[role];
      if (Object.keys(req.session.roles).length === 0) {
        return req.session.destroy(() => res.json({ ok: true }));
      }
      return req.session.save(() => res.json({ ok: true }));
    }
    return res.json({ ok: true });
  }

  return req.session.destroy(() => res.json({ ok: true }));
});

module.exports = router;


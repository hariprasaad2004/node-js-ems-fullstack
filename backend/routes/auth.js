const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const router = express.Router();

const rootDir = path.join(__dirname, '..', '..');

router.get('/login', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/');
  }
  return res.sendFile(path.join(rootDir, 'frontend', 'views', 'login.html'));
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const allowPasswordless = process.env.ALLOW_PASSWORDLESS === 'true';

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

    if (!allowPasswordless) {
      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) {
        return res.status(401).json({ message: 'Invalid credentials.' });
      }
    }

    req.session.userId = user._id.toString();
    req.session.role = user.role;

    return res.json({ role: user.role });
  } catch (err) {
    return res.status(500).json({ message: 'Login failed.' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

module.exports = router;

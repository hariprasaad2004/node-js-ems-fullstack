const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');

function buildTransport() { // Configure SMTP transport if env vars are present.
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  const port = Number(SMTP_PORT || 587);
  const secure = SMTP_SECURE === 'true' || port === 465;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure,
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
}

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

router.get('/api/me', requireAuth, async (req, res) => { // Return minimal profile for the logged-in user.
  try {
    const user = await User.findById(req.userId).select('name email role department title status');
    if (!user) return res.status(404).json({ message: 'User not found.' });
    return res.json({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department || null,
      title: user.title || null,
      status: user.status
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to load profile.' });
  }
});

router.post('/api/password/forgot', async (req, res) => { // Generate a one-time code for password recovery.
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ message: 'Email is required.' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.json({ message: 'If that account exists, a reset code has been created.' });
    }

    // 6-digit numeric code to mimic an OTP
    const token = (Math.floor(100000 + Math.random() * 900000)).toString();
    user.resetToken = token;
    user.resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    // Send via SMTP if configured; otherwise log for QA.
    const transport = buildTransport();
    const from = process.env.SMTP_FROM || 'no-reply@ems.local';
    const mailOptions = {
      from,
      to: user.email,
      subject: 'Your EMS reset code',
      text: `Here is your EMS password reset code: ${token}\nIt expires in 1 hour.\nIf you did not request this, ignore this email.`
    };

    if (transport) {
      try {
        await transport.sendMail(mailOptions);
      } catch (mailErr) {
        console.error('Error sending reset email:', mailErr.message);
        console.log(`[password-reset] code for ${user.email}: ${token}`);
      }
    } else {
      console.log(`[password-reset] code for ${user.email}: ${token}`);
    }

    return res.json({
      message: 'If that account exists, a reset code has been sent. It expires in 1 hour.'
    });
  } catch (err) {
    return res.status(500).json({ message: 'Could not create reset token.' });
  }
});

router.post('/api/password/reset', async (req, res) => { // Reset password using token.
  try {
    const { email, token, password } = req.body || {};
    if (!email || !token || !password) {
      return res.status(400).json({ message: 'Email, token, and new password are required.' });
    }

    const user = await User.findOne({
      email: email.toLowerCase(),
      resetToken: token,
      resetExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token.' });
    }

    user.passwordHash = await bcrypt.hash(password, 10);
    user.resetToken = undefined;
    user.resetExpires = undefined;
    await user.save();

    return res.json({ message: 'Password reset successful. You can log in with the new password.' });
  } catch (err) {
    return res.status(500).json({ message: 'Could not reset password.' });
  }
});

router.post('/api/password/update', requireAuth, async (req, res) => { // Change password for logged-in users.
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new passwords are required.' });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) return res.status(400).json({ message: 'Current password is incorrect.' });

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.resetToken = undefined;
    user.resetExpires = undefined;
    await user.save();

    return res.json({ message: 'Password updated. Use it on your next login.' });
  } catch (err) {
    return res.status(500).json({ message: 'Could not update password.' });
  }
});

module.exports = router;


const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const { sendOtpEmail, hasSmtpConfig } = require('../services/email');

// OTP configuration for password resets (email-only).
const OTP_LENGTH = Math.max(4, Math.min(Number(process.env.OTP_LENGTH) || 6, 8));
const OTP_TTL_MINUTES = Number(process.env.OTP_TTL_MINUTES || 10);
const OTP_RESEND_COOLDOWN_SECONDS = Number(process.env.OTP_RESEND_COOLDOWN_SECONDS || 60);
const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 5);
const OTP_SECRET = process.env.OTP_SECRET || process.env.SESSION_SECRET || 'otp-dev-secret';

function generateOtp() { // Create a numeric OTP with fixed length.
  const min = 10 ** (OTP_LENGTH - 1);
  const max = 10 ** OTP_LENGTH;
  return crypto.randomInt(min, max).toString().padStart(OTP_LENGTH, '0');
}

function hashOtp(code) { // Hash OTP with HMAC-SHA256 to avoid storing raw codes.
  return crypto.createHmac('sha256', OTP_SECRET).update(code).digest('hex');
}

function msUntilNextOtp(user) { // Cooldown between SMS sends to the same account.
  if (!user?.resetOtpLastSent) return 0;
  const elapsed = Date.now() - new Date(user.resetOtpLastSent).getTime();
  return Math.max(0, OTP_RESEND_COOLDOWN_SECONDS * 1000 - elapsed);
}

function attemptsRemaining(user) {
  return Math.max(OTP_MAX_ATTEMPTS - (user?.resetOtpAttempts || 0), 0);
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

router.post('/api/password/forgot', async (req, res) => { // Generate OTP for password recovery via email.
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ message: 'Email is required.' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.json({
        message: 'If that account exists, a reset code has been created.'
      });
    }

    const emailConfigured = hasSmtpConfig();

    if (!emailConfigured && process.env.NODE_ENV === 'production') {
      console.warn('[otp] No email provider configured in production; falling back to console logging for testing.');
    }

    const waitMs = msUntilNextOtp(user);
    if (waitMs > 0) {
      const waitSeconds = Math.ceil(waitMs / 1000);
      return res.status(429).json({
        message: `Please wait ${waitSeconds}s before requesting another code.`
      });
    }

    let otp = generateOtp();
    let sendResult = null;
    let channel = 'email';

    // Email is the only delivery method; the helper will log in dev if SMTP is missing.
    sendResult = await sendOtpEmail({
      to: user.email,
      code: otp,
      ttlMinutes: OTP_TTL_MINUTES
    });

    if (!sendResult || !sendResult.ok) {
      const providerError = sendResult?.error || sendResult?.response || 'unknown error';
      console.error('Error sending reset code:', providerError);
      return res.status(502).json({ message: 'Could not send reset code. Try again shortly.' });
    }

    const now = new Date();
    user.resetOtpHash = hashOtp(otp);
    user.resetOtpExpires = new Date(now.getTime() + OTP_TTL_MINUTES * 60 * 1000);
    user.resetOtpAttempts = 0;
    user.resetOtpLastSent = now;
    user.resetOtpChannel = channel;
    user.resetToken = undefined;
    user.resetExpires = undefined;
    await user.save();

    if (channel === 'email' && sendResult.fallback) {
      console.log(`[otp-dev] SMTP not configured; code ${otp} for ${user.email} logged for testing.`);
    }

    const successMessage = `If that account exists, an email with a ${OTP_LENGTH}-digit code was sent. It expires in ${OTP_TTL_MINUTES} minutes.`;

    return res.json({ message: successMessage });
  } catch (err) {
    return res.status(500).json({ message: 'Could not create reset token.' });
  }
});

router.post('/api/password/reset', async (req, res) => { // Reset password using email OTP.
  try {
    const { email, token, password } = req.body || {};
    if (!email || !token || !password) {
      return res.status(400).json({ message: 'Email, token, and new password are required.' });
    }

    if (typeof password !== 'string' || password.trim().length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.resetOtpExpires) {
      return res.status(400).json({ message: 'Invalid or expired reset code.' });
    }

    if (user.resetOtpExpires <= new Date()) {
      return res.status(400).json({ message: 'Reset code has expired. Request a new one.' });
    }

    if (user.resetOtpAttempts >= OTP_MAX_ATTEMPTS) {
      return res.status(429).json({ message: 'Too many invalid attempts. Request a new code.' });
    }

    if (!user.resetOtpHash) {
      return res.status(400).json({ message: 'Invalid or expired reset code.' });
    }
    const hashedToken = hashOtp(token.trim());
    if (hashedToken !== user.resetOtpHash) {
      user.resetOtpAttempts = (user.resetOtpAttempts || 0) + 1;
      await user.save();
      const remaining = attemptsRemaining(user);
      return res.status(400).json({
        message: `Invalid code. ${remaining} attempt(s) remaining.`
      });
    }

    const normalizedPassword = password.trim();
    user.passwordHash = await bcrypt.hash(normalizedPassword, 10);
    user.resetOtpHash = undefined;
    user.resetOtpExpires = undefined;
    user.resetOtpAttempts = 0;
    user.resetOtpLastSent = undefined;
    user.resetOtpChannel = undefined;
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


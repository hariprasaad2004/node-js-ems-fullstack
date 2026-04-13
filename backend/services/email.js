const nodemailer = require('nodemailer');

let cachedTransport = null;

function hasSmtpConfig() {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  return Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);
}

function buildTransport() { // Configure and cache SMTP transport when env vars are present.
  if (cachedTransport) return cachedTransport;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;
  if (!hasSmtpConfig()) return null;
  const port = Number(SMTP_PORT || 587);
  const secure = SMTP_SECURE === 'true' || port === 465;
  cachedTransport = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure,
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
  return cachedTransport;
}

async function sendOtpEmail({ to, code, ttlMinutes = 10 }) { // Send OTP via SMTP; log fallback when unconfigured.
  if (!to || !code) {
    return { ok: false, error: 'Missing recipient or code' };
  }

  const transport = buildTransport();

  if (!transport) {
    console.log(`[otp-email] SMTP not configured; code for ${to} => ${code}`);
    return { ok: true, fallback: true, reason: 'smtp-not-configured' };
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const subject = process.env.SMTP_SUBJECT || 'Your EMS password reset code';
  const text = `Your EMS reset code is ${code}. It expires in ${ttlMinutes} minutes.`;

  try {
    await transport.sendMail({ from, to, subject, text });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = {
  hasSmtpConfig,
  sendOtpEmail
};

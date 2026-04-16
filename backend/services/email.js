const nodemailer = require('nodemailer');
 
// Transport is rebuilt on each call so failures do NOT get permanently cached.
let cachedTransport = null;
let cachedTransportKey = null; // invalidate cache if env vars change
 
function hasSmtpConfig() {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  return Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);
}
 
function getTransportKey() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;
  return `${SMTP_HOST}:${SMTP_PORT}:${SMTP_USER}:${SMTP_PASS}:${SMTP_SECURE}`;
}
 
function buildTransport() {
  if (!hasSmtpConfig()) return null;
 
  const key = getTransportKey();
 
  // Return cached transport only if config hasn't changed
  if (cachedTransport && cachedTransportKey === key) return cachedTransport;
 
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;
  const port = Number(SMTP_PORT || 587);
  const secure = SMTP_SECURE === 'true' || port === 465;
 
  cachedTransport = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    },
    // Required for Gmail port 587 (STARTTLS) — prevents TLS handshake failures
    tls: {
      rejectUnauthorized: false
    }
  });
 
  cachedTransportKey = key;
  return cachedTransport;
}
 
async function sendOtpEmail({ to, code, ttlMinutes = 10 }) {
  if (!to || !code) {
    return { ok: false, error: 'Missing recipient or code' };
  }
 
  const transport = buildTransport();
 
  if (!transport) {
    console.log(`[otp-email] SMTP not configured; code for ${to} => ${code}`);
    return { ok: true, fallback: true, reason: 'smtp-not-configured' };
  }
 
  // FIX: Strip surrounding quotes from SMTP_FROM if dotenv preserved them.
  // In .env, write:  SMTP_FROM=EMS <you@gmail.com>   (no surrounding quotes)
  let from = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (from) from = from.replace(/^["']|["']$/g, '').trim();
 
  const subject = process.env.SMTP_SUBJECT || 'Your EMS password reset code';
  const text = `Your EMS reset code is ${code}. It expires in ${ttlMinutes} minutes.\n\nIf you did not request this, please ignore this email.`;
 
  try {
    const info = await transport.sendMail({ from, to, subject, text });
    console.log(`[otp-email] Sent to ${to} — messageId: ${info.messageId}`);
    return { ok: true };
  } catch (err) {
    // Invalidate the cached transport so the next attempt rebuilds it
    cachedTransport = null;
    cachedTransportKey = null;
    console.error(`[otp-email] Send failed to ${to}:`, err.message);
    return { ok: false, error: err.message };
  }
}
 
module.exports = {
  hasSmtpConfig,
  sendOtpEmail
};
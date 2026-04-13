const https = require('https');
const querystring = require('querystring');
let twilioClient = null;

function maskPhone(phone) { // Hide most digits for logs.
  if (!phone || typeof phone !== 'string') return 'unknown';
  const clean = phone.replace(/\D/g, '');
  if (clean.length <= 4) return clean;
  return `${clean.slice(0, 2)}******${clean.slice(-2)}`;
}

function hasTwilioConfig() {
  return (
    !!process.env.TWILIO_ACCOUNT_SID &&
    !!process.env.TWILIO_AUTH_TOKEN &&
    !!process.env.TWILIO_FROM
  );
}

function hasTwilioVerifyConfig() {
  return (
    !!process.env.TWILIO_ACCOUNT_SID &&
    !!process.env.TWILIO_AUTH_TOKEN &&
    !!process.env.TWILIO_VERIFY_SID
  );
}

function getTwilioClient() {
  if (twilioClient) return twilioClient;
  if (hasTwilioConfig() || hasTwilioVerifyConfig()) {
    // Lazy load twilio dependency to avoid requiring it when not configured.
    // eslint-disable-next-line global-require
    const twilio = require('twilio');
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return twilioClient;
}

function sendSms({ to, body }) { // Send SMS via Twilio REST API or log in dev.
  return new Promise((resolve) => {
    if (!to || !body) {
      return resolve({ ok: false, error: 'Missing destination or body' });
    }

    if (!hasTwilioConfig()) {
      console.log(`[otp-sms] Twilio not configured; code for ${maskPhone(to)} => ${body}`);
      return resolve({ ok: true, fallback: true, reason: 'twilio-not-configured' });
    }

    const payload = querystring.stringify({
      To: to,
      From: process.env.TWILIO_FROM,
      Body: body
    });

    const options = {
      hostname: 'api.twilio.com',
      path: `/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
      method: 'POST',
      auth: `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          return resolve({ ok: true });
        }
        return resolve({
          ok: false,
          error: `Twilio status ${res.statusCode}`,
          response: data
        });
      });
    });

    req.on('error', (err) => resolve({ ok: false, error: err.message }));

    req.write(payload);
    req.end();
  });
}

async function sendOtpSms({ to, code, ttlMinutes = 10 }) { // Compose OTP message wrapper (Messaging API).
  const body = `Your EMS reset code is ${code}. It expires in ${ttlMinutes} minutes.`;
  return sendSms({ to, body });
}

async function sendVerifyCode({ to, channel = 'sms' }) { // Use Twilio Verify to send a code.
  if (!hasTwilioVerifyConfig()) {
    console.log(`[otp-verify] Twilio Verify not configured; would send to ${maskPhone(to)}`);
    return { ok: true, fallback: true, reason: 'twilio-verify-not-configured' };
  }
  try {
    const client = getTwilioClient();
    const verification = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SID)
      .verifications.create({ to, channel });
    return { ok: true, sid: verification.sid, status: verification.status };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function checkVerifyCode({ to, code }) { // Validate code via Twilio Verify.
  if (!hasTwilioVerifyConfig()) {
    return { ok: false, error: 'Twilio Verify not configured' };
  }
  try {
    const client = getTwilioClient();
    const check = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SID)
      .verificationChecks.create({ to, code });
    const approved = check.status === 'approved';
    return { ok: approved, status: check.status };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = {
  sendOtpSms,
  sendVerifyCode,
  checkVerifyCode,
  maskPhone,
  hasTwilioConfig,
  hasTwilioVerifyConfig
};

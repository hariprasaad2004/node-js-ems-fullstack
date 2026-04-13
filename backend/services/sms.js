const https = require('https');
const querystring = require('querystring');

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

    req.on('error', (err) => {
      return resolve({ ok: false, error: err.message });
    });

    req.write(payload);
    req.end();
  });
}

async function sendOtpSms({ to, code, ttlMinutes = 10 }) { // Compose OTP message wrapper.
  const body = `Your EMS reset code is ${code}. It expires in ${ttlMinutes} minutes.`;
  return sendSms({ to, body });
}

module.exports = { sendOtpSms, maskPhone, hasTwilioConfig };

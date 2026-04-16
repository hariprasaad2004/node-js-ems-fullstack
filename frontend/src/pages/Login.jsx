import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest, readJson } from '../api/client.js';
import { forgotPassword, resetPassword, verifyPasswordResetCode } from '../api/auth.js';
import { useBodyClass } from '../hooks/useBodyClass.js';

export default function Login() { // Login page and auth redirect logic.
  useBodyClass('page-auth');
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resetPasswordVal, setResetPasswordVal] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetStage, setResetStage] = useState('request');

  const resetForgotState = (nextEmail = '') => {
    setResetEmail(nextEmail);
    setResetToken('');
    setResetPasswordVal('');
    setResetConfirm('');
    setResetMessage('');
    setResetError('');
    setResetStage('request');
  };

  const openForgotPassword = () => {
    setForgotOpen(true);
    resetForgotState(email.trim());
  };

  const closeForgotPassword = () => {
    setForgotOpen(false);
    resetForgotState('');
  };

  const handleResetEmailChange = (value) => {
    setResetEmail(value);
    setResetError('');
    setResetMessage('');

    if (resetStage !== 'request') {
      setResetStage('request');
      setResetToken('');
      setResetPasswordVal('');
      setResetConfirm('');
    }
  };

  const handleSubmit = async (event) => { // Submit login form and route by role.
    event.preventDefault();
    setError('');

    try {
      const payload = { email: email.trim() };
      if (password.trim()) {
        payload.password = password.trim();
      }

      const res = await apiRequest('/login', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const data = await readJson(res);

      if (!res.ok) {
        setError(data?.message || 'Login failed.');
        return;
      }

      if (data?.role === 'admin') {
        navigate('/admin');
      } else if (data?.role === 'manager') {
        navigate('/manager');
      } else if (data?.role === 'teamlead') {
        navigate('/teamlead');
      } else {
        navigate('/employee');
      }
    } catch (err) {
      setError('Unable to reach server.');
    }
  };

  const handleSendResetCode = async () => {
    setResetError('');
    setResetMessage('');

    const normalizedEmail = resetEmail.trim();
    if (!normalizedEmail) {
      setResetError('Enter your registered email address.');
      return;
    }

    const { res, data } = await forgotPassword(normalizedEmail);
    if (!res.ok) {
      setResetError(data?.message || 'Could not send email code.');
      return;
    }

    setResetStage('verify');
    setResetToken('');
    setResetPasswordVal('');
    setResetConfirm('');
    setResetMessage(
      data?.message || 'If that account exists, a 6-digit code was emailed to you. It expires in 10 minutes.'
    );
  };

  const handleVerifyResetCode = async () => {
    setResetError('');
    setResetMessage('');

    const normalizedEmail = resetEmail.trim();
    const normalizedToken = resetToken.trim();
    if (!normalizedEmail || !normalizedToken) {
      setResetError('Email and code are required.');
      return;
    }

    const { res, data } = await verifyPasswordResetCode({
      email: normalizedEmail,
      token: normalizedToken
    });

    if (!res.ok) {
      setResetError(data?.message || 'Could not verify code.');
      return;
    }

    setResetStage('reset');
    setResetMessage(data?.message || 'Code verified. You can now set a new password.');
  };

  const handleResetPassword = async () => {
    setResetError('');
    setResetMessage('');

    if (!resetEmail.trim() || !resetPasswordVal.trim()) {
      setResetError('Email and new password are required.');
      return;
    }

    if (resetPasswordVal !== resetConfirm) {
      setResetError('Passwords do not match.');
      return;
    }

    const { res, data } = await resetPassword({
      email: resetEmail.trim(),
      password: resetPasswordVal.trim()
    });

    if (!res.ok) {
      setResetError(data?.message || 'Could not reset password.');
      return;
    }

    setResetStage('request');
    setResetToken('');
    setResetPasswordVal('');
    setResetConfirm('');
    setResetMessage(data?.message || 'Password reset successful.');
  };

  return (
    <div className="auth-layout page-auth">
      <div className="auth-shell">
        <div className="auth-visual">
          <div className="visual-overlay" />
          <div className="visual-content">
            <h1>EMS Portal</h1>
            <p>Log in to manage your team and stay ahead of daily updates.</p>
          </div>
        </div>

        <div className="auth-panel">
          <div className="auth-heading">
            <span className="brand-kicker">Employee Management Suite</span>
            <h2>Login</h2>
            <p>Enter your credentials to continue.</p>
          </div>

          <div className="auth-form-card">
            <form id="login-form" className="auth-form" onSubmit={handleSubmit}>
              <label className="auth-field">
                <span>Email</span>
                <input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>

              <label className="auth-field">
                <span>Password</span>
                <input
                  id="password"
                  type="password"
                  placeholder="********"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>

              <button
                type="button"
                className="btn-link"
                style={{ alignSelf: 'flex-end', marginTop: '-6px', marginBottom: '6px' }}
                onClick={openForgotPassword}
              >
                Forgot password?
              </button>

              <button className="btn-primary auth-submit" type="submit">
                Sign In
              </button>
              {error ? <p className="helper error-text">{error}</p> : null}
            </form>
          </div>
        </div>
      </div>

      <div className={`modal ${forgotOpen ? 'active' : ''}`} aria-hidden={!forgotOpen}>
        <div className="modal-backdrop" onClick={closeForgotPassword} />
        <div className="modal-card">
          <div className="modal-header">
            <h3 style={{ margin: 0 }}>Forgot / Reset Password</h3>
            <button
              type="button"
              className="modal-close"
              aria-label="Close"
              onClick={closeForgotPassword}
            >
              x
            </button>
          </div>

          <div className="modal-grid" style={{ gridTemplateColumns: '1fr' }}>
            <div className="reset-flow-steps">
              <span className={resetStage === 'request' ? 'active' : resetStage === 'verify' || resetStage === 'reset' ? 'done' : ''}>
                1. Send code
              </span>
              <span className={resetStage === 'verify' ? 'active' : resetStage === 'reset' ? 'done' : ''}>
                2. Verify code
              </span>
              <span className={resetStage === 'reset' ? 'active' : ''}>
                3. Reset password
              </span>
            </div>

            <label className="auth-field">
              <span>Email</span>
              <input
                type="email"
                value={resetEmail}
                onChange={(event) => handleResetEmailChange(event.target.value)}
                placeholder="you@company.com"
                required
              />
            </label>

            <p className="helper">
              {resetStage === 'request'
                ? 'We will email a code to this address if the account exists.'
                : resetStage === 'verify'
                  ? 'Enter the OTP from your email. If it fails, you can resend and try again.'
                  : 'Code verified. Enter your new password below.'}
            </p>

            {resetStage === 'request' ? (
              <button className="btn-primary" type="button" onClick={handleSendResetCode}>
                Send email code
              </button>
            ) : null}

            {resetStage === 'verify' ? (
              <>
                <label className="auth-field">
                  <span>Email code</span>
                  <input
                    type="text"
                    value={resetToken}
                    onChange={(event) => setResetToken(event.target.value)}
                    placeholder="6-digit code from email"
                  />
                </label>

                <div className="form-actions">
                  <button className="btn-primary" type="button" onClick={handleVerifyResetCode}>
                    Verify code
                  </button>
                  <button className="btn-link" type="button" onClick={handleSendResetCode}>
                    Retry / resend code
                  </button>
                </div>
              </>
            ) : null}

            {resetStage === 'reset' ? (
              <>
                <label className="auth-field">
                  <span>New password</span>
                  <input
                    type="password"
                    value={resetPasswordVal}
                    onChange={(event) => setResetPasswordVal(event.target.value)}
                    placeholder="New password"
                  />
                </label>

                <label className="auth-field">
                  <span>Confirm new password</span>
                  <input
                    type="password"
                    value={resetConfirm}
                    onChange={(event) => setResetConfirm(event.target.value)}
                    placeholder="Repeat new password"
                  />
                </label>

                <div className="form-actions">
                  <button className="btn-primary" type="button" onClick={handleResetPassword}>
                    Reset password
                  </button>
                  <button className="btn-link" type="button" onClick={handleSendResetCode}>
                    Send new code
                  </button>
                </div>
              </>
            ) : null}

            {resetError ? <p className="helper error-text">{resetError}</p> : null}
            {resetMessage ? <p className="helper" style={{ color: '#34d399' }}>{resetMessage}</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

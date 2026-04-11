import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest, readJson } from '../api/client.js';
import { forgotPassword, resetPassword } from '../api/auth.js';
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
  const [requestedToken, setRequestedToken] = useState('');

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
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>

              <button
                type="button"
                className="btn-link"
                style={{ alignSelf: 'flex-end', marginTop: '-6px', marginBottom: '6px' }}
                onClick={() => {
                  setForgotOpen(true);
                  setResetEmail(email);
                  setResetError('');
                  setResetMessage('');
                  setRequestedToken('');
                }}
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
        <div className="modal-backdrop" onClick={() => setForgotOpen(false)} />
        <div className="modal-card">
          <div className="modal-header">
            <h3 style={{ margin: 0 }}>Forgot / Reset Password</h3>
            <button
              type="button"
              className="modal-close"
              aria-label="Close"
              onClick={() => setForgotOpen(false)}
            >
              ×
            </button>
          </div>

          <div className="modal-grid" style={{ gridTemplateColumns: '1fr' }}>
            <label className="auth-field">
              <span>Email</span>
              <input
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="you@company.com"
                required
              />
            </label>

            <button
              className="btn-primary"
              type="button"
              onClick={async () => {
                setResetError('');
                setResetMessage('');
                const { res, data } = await forgotPassword(resetEmail.trim());
                if (!res.ok) {
                  setResetError(data?.message || 'Could not create reset token.');
                  return;
                }
                setRequestedToken('');
                setResetMessage('If that account exists, a 6-digit code was sent and expires in 1 hour.');
              }}
            >
              Send reset token
            </button>

            <label className="auth-field">
              <span>Reset token</span>
              <input
                type="text"
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value)}
                placeholder="Paste token"
              />
            </label>

            <label className="auth-field">
              <span>New password</span>
              <input
                type="password"
                value={resetPasswordVal}
                onChange={(e) => setResetPasswordVal(e.target.value)}
                placeholder="New password"
              />
            </label>

            <label className="auth-field">
              <span>Confirm new password</span>
              <input
                type="password"
                value={resetConfirm}
                onChange={(e) => setResetConfirm(e.target.value)}
                placeholder="Repeat new password"
              />
            </label>

            <button
              className="btn-primary"
              type="button"
              onClick={async () => {
                setResetError('');
                setResetMessage('');
                if (!resetEmail || !resetToken || !resetPasswordVal) {
                  setResetError('Email, token, and new password are required.');
                  return;
                }
                if (resetPasswordVal !== resetConfirm) {
                  setResetError('Passwords do not match.');
                  return;
                }
                const { res, data } = await resetPassword({
                  email: resetEmail.trim(),
                  token: resetToken.trim(),
                  password: resetPasswordVal.trim()
                });
                if (!res.ok) {
                  setResetError(data?.message || 'Could not reset password.');
                  return;
                }
                setResetMessage(data?.message || 'Password reset successful.');
                setRequestedToken('');
                setResetPasswordVal('');
                setResetConfirm('');
                setResetToken('');
              }}
            >
              Reset password
            </button>

            {resetError ? <p className="helper error-text">{resetError}</p> : null}
            {resetMessage ? <p className="helper" style={{ color: '#34d399' }}>{resetMessage}</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

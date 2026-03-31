import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest, readJson } from '../api/client.js';
import { useBodyClass } from '../hooks/useBodyClass.js';

export default function Login() { // Login page and auth redirect logic.
  useBodyClass('page-auth');
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

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
      } else {
        navigate('/employee');
      }
    } catch (err) {
      setError('Unable to reach server.');
    }
  };

  return (
    <div className="auth-layout page-auth">
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

          <div className="auth-actions">
            <label className="checkbox">
              <input type="checkbox" /> <span>Remember me</span>
            </label>
            <button className="link-button" type="button">
              Forgot password?
            </button>
          </div>

          <button className="btn-primary auth-submit" type="submit">
            Sign In
          </button>
          {error ? <p className="helper error-text">{error}</p> : null}
        </form>
      </div>
    </div>
  );
}

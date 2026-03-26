import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest, readJson } from '../api/client.js';
import { useBodyClass } from '../hooks/useBodyClass.js';

export default function Login() {
  useBodyClass('page-auth');
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
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
    <div className="shell">
      <div className="card brand-card">
        <h1 className="brand-title">Employee Management Suite</h1>
        <p className="brand-subtitle">
          Centralize your workforce data with a simple admin dashboard and a clean employee
          self-service portal. Log in to manage profiles, roles, and contact details.
        </p>
        <div className="notice">Tip: Create your admin account using the seed script.</div>
      </div>

      <div className="card auth-card">
        <h1>Welcome back</h1>
        <p className="helper">Sign in to continue to your dashboard.</p>

        <form id="login-form" className="form-grid" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="you@company.com"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div>
            <label htmlFor="password">Password (optional if passwordless is enabled)</label>
            <input
              id="password"
              type="password"
              placeholder="********"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          <button className="btn-primary" type="submit">
            Sign In
          </button>
          <p className="helper">{error}</p>
        </form>
      </div>
    </div>
  );
}

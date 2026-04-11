import { useState } from 'react';
import { updatePassword } from '../api/auth.js';

export default function ChangePasswordModal({ align = 'right' }) {
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event?.preventDefault?.();
    setError('');
    setSuccess('');

    if (!currentPassword || !newPassword) {
      setError('Please fill out all fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    setLoading(true);
    const { res, data } = await updatePassword({ currentPassword, newPassword });
    setLoading(false);

    if (!res.ok) {
      setError(data?.message || 'Unable to update password.');
      return;
    }
    setSuccess('Password updated. Use it next time you sign in.');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <>
      <button
        type="button"
        className="btn-ghost"
        style={{ padding: '10px 14px' }}
        onClick={() => setOpen(true)}
      >
        Change Password
      </button>

      <div className={`modal ${open ? 'active' : ''}`} aria-hidden={!open}>
        <div className="modal-backdrop" onClick={() => setOpen(false)} />
        <form className="modal-card" onSubmit={handleSubmit} style={{ maxWidth: '420px' }}>
          <div className="modal-header">
            <h3 style={{ margin: 0 }}>Update password</h3>
            <button type="button" className="modal-close" aria-label="Close" onClick={() => setOpen(false)}>
              ×
            </button>
          </div>

          <label className="auth-field">
            <span>Current password</span>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </label>

          <label className="auth-field">
            <span>New password</span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password"
              required
            />
          </label>

          <label className="auth-field">
            <span>Confirm new password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat new password"
              required
            />
          </label>

          {error ? <p className="helper error-text">{error}</p> : null}
          {success ? <p className="helper" style={{ color: '#34d399' }}>{success}</p> : null}

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button className="btn-ghost" type="button" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? 'Saving…' : 'Update'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

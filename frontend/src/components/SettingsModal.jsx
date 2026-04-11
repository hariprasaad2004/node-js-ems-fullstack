import { useEffect, useState } from 'react';
import { getMe, updatePassword } from '../api/auth.js';

export default function SettingsModal() {
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoadingProfile(true);
      setProfileError('');
      const { res, data } = await getMe();
      setLoadingProfile(false);
      if (!res.ok) {
        setProfileError(data?.message || 'Unable to load profile.');
        return;
      }
      setProfile(data);
    })();
  }, [open]);

  const handlePassword = async (event) => {
    event?.preventDefault?.();
    setPwError('');
    setPwSuccess('');
    if (!currentPassword || !newPassword) {
      setPwError('Please fill out all password fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match.');
      return;
    }
    setPwLoading(true);
    const { res, data } = await updatePassword({ currentPassword, newPassword });
    setPwLoading(false);
    if (!res.ok) {
      setPwError(data?.message || 'Unable to update password.');
      return;
    }
    setPwSuccess('Password updated. Use it next time you sign in.');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <>
      <button type="button" className="btn-ghost" onClick={() => setOpen(true)}>
        Settings
      </button>

      <div className={`modal ${open ? 'active' : ''}`} aria-hidden={!open}>
        <div className="modal-backdrop" onClick={() => setOpen(false)} />
        <div className="modal-card" style={{ width: 'min(520px, 92vw)' }}>
          <div className="modal-header">
            <h3 style={{ margin: 0 }}>Profile & Security</h3>
            <button type="button" className="modal-close" aria-label="Close" onClick={() => setOpen(false)}>
              ×
            </button>
          </div>

          <div className="modal-grid" style={{ gridTemplateColumns: '1fr' }}>
            <div className="info-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              <span>Name</span>
              <strong>{profile?.name || (loadingProfile ? 'Loading...' : '—')}</strong>
              <span>Email</span>
              <strong>{profile?.email || (loadingProfile ? 'Loading...' : '—')}</strong>
              <span>Role</span>
              <strong>{profile?.role || '—'}</strong>
              <span>Department</span>
              <strong>{profile?.department || '—'}</strong>
              <span>Title</span>
              <strong>{profile?.title || '—'}</strong>
              <span>Status</span>
              <strong>{profile?.status || '—'}</strong>
            </div>
            {profileError ? <p className="helper error-text">{profileError}</p> : null}
          </div>

          <hr style={{ borderColor: 'rgba(255,255,255,0.08)' }} />
          <h4 style={{ margin: '0 0 8px 0' }}>Change password</h4>
          <form className="modal-grid" style={{ gridTemplateColumns: '1fr' }} onSubmit={handlePassword}>
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

            {pwError ? <p className="helper error-text">{pwError}</p> : null}
            {pwSuccess ? <p className="helper" style={{ color: '#34d399' }}>{pwSuccess}</p> : null}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn-ghost" type="button" onClick={() => setOpen(false)}>
                Close
              </button>
              <button className="btn-primary" type="submit" disabled={pwLoading}>
                {pwLoading ? 'Saving…' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

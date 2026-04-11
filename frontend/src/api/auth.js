import { apiRequest, readJson } from './client.js';

export async function forgotPassword(email) { // Request a reset token.
  const res = await apiRequest('/api/password/forgot', {
    method: 'POST',
    body: JSON.stringify({ email })
  });
  const data = await readJson(res);
  return { res, data };
}

export async function resetPassword({ email, token, password }) { // Complete reset with token.
  const res = await apiRequest('/api/password/reset', {
    method: 'POST',
    body: JSON.stringify({ email, token, password })
  });
  const data = await readJson(res);
  return { res, data };
}

export async function updatePassword({ currentPassword, newPassword }) { // Change password while logged in.
  const res = await apiRequest('/api/password/update', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword })
  });
  const data = await readJson(res);
  return { res, data };
}

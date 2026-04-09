export const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export async function apiRequest(url, options = {}) { // Shared API helper with auth redirect.
  const opts = { credentials: 'include', ...options };
  const headers = { Accept: 'application/json', ...(opts.headers || {}) };

  if (opts.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  opts.headers = headers;

  const target = `${API_BASE}${url.startsWith('/') ? url : `/${url}`}`;
  const res = await fetch(target, opts);

  if (res.status === 401) {
    window.location.assign('/login');
  }

  return res;
}

export async function readJson(res) { // Safe JSON reader for fetch responses.
  try {
    return await res.json();
  } catch (err) {
    return null;
  }
}


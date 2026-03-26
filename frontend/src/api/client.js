export async function apiRequest(url, options = {}) { // Shared API helper with auth redirect.
  const opts = { ...options };
  const headers = { ...(opts.headers || {}) };

  if (opts.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  opts.headers = headers;
  const res = await fetch(url, opts);

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


import { apiRequest, readJson } from './client.js';

export async function fetchThreads() { // Load chat threads + peers + current user.
  const res = await apiRequest('/api/chat/threads');
  const data = await readJson(res);
  return { res, data };
}

export async function fetchMessages(threadKey, limit = 120) { // Fetch messages for a thread.
  const params = new URLSearchParams({ threadKey, limit: String(limit) });
  const res = await apiRequest(`/api/chat/messages?${params.toString()}`);
  const data = await readJson(res);
  return { res, data };
}

export async function sendChatMessage(payload) { // Send a chat message (group or direct).
  const res = await apiRequest('/api/chat/messages', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  const data = await readJson(res);
  return { res, data };
}

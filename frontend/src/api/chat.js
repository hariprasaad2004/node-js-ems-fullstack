import { apiRequest, readJson } from './client.js';

export async function getChats() {
  const res = await apiRequest('/api/chat');
  const data = await readJson(res);
  return { res, data };
}

export async function createChat(payload) {
  const res = await apiRequest('/api/chat', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  const data = await readJson(res);
  return { res, data };
}

export async function getMessages(chatId) {
  const res = await apiRequest(`/api/messages/${chatId}`);
  const data = await readJson(res);
  return { res, data };
}

export async function sendMessage(payload) {
  const res = await apiRequest('/api/messages', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  const data = await readJson(res);
  return { res, data };
}

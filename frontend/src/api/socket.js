import { io } from 'socket.io-client';
import { API_BASE } from './client.js';

const fallbackBase =
  (typeof window !== 'undefined' && window.location?.origin) || 'http://localhost:5173';
const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL || API_BASE || fallbackBase).replace(/\/$/, '');

export function createSocket() { // Initialize a Socket.IO client with shared config.
  return io(SOCKET_URL, {
    withCredentials: true,
    transports: ['websocket', 'polling']
  });
}

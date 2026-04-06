import { io, Socket } from 'socket.io-client';
import { getToken } from './api';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  if (typeof window === 'undefined') return null;

  const token = getToken();
  if (!token) return null;

  // Socket already exists — reuse it
  if (socket) {
    // If disconnected, reconnect the existing instance instead of creating a new one
    if (!socket.connected) {
      socket.auth = { token };
      socket.connect();
    }
    return socket;
  }

  // First call — create the socket and register listeners once
  socket = io(WS_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10,
  });

  socket.on('connect', () => console.log('[ws] connected'));
  socket.on('connect_error', (err) => console.error('[ws] error:', err.message));

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function subscribeToStation(stationId: string) {
  socket?.emit('subscribe:station', stationId);
}

export function unsubscribeFromStation(stationId: string) {
  socket?.emit('unsubscribe:station', stationId);
}

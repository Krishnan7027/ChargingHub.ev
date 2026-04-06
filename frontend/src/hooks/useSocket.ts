'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { getSocket } from '@/lib/socket';
import { getToken } from '@/lib/api';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const listenersRef = useRef<Array<{ event: string; handler: (...args: any[]) => void }>>([]);

  useEffect(() => {
    const token = getToken();
    if (token) {
      socketRef.current = getSocket();
    }

    return () => {
      // Remove all listeners registered by this hook instance on unmount
      const sock = socketRef.current;
      if (sock) {
        for (const { event, handler } of listenersRef.current) {
          sock.off(event, handler);
        }
      }
      listenersRef.current = [];
    };
  }, []);

  const on = useCallback((event: string, handler: (...args: any[]) => void) => {
    socketRef.current?.on(event, handler);
    listenersRef.current.push({ event, handler });
    return () => {
      socketRef.current?.off(event, handler);
      listenersRef.current = listenersRef.current.filter(
        (l) => !(l.event === event && l.handler === handler)
      );
    };
  }, []);

  const emit = useCallback((event: string, data?: any) => {
    socketRef.current?.emit(event, data);
  }, []);

  return { on, emit, socket: socketRef.current };
}

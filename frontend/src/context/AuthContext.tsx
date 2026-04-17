'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { authApi, otpApi, setToken, getToken } from '@/lib/api';
import { getSocket, disconnectSocket } from '@/lib/socket';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: { email: string; password: string; fullName: string; phone?: string; role?: string }) => Promise<User>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
  sendOtp: (identifier: string, type: 'email' | 'mobile') => Promise<void>;
  loginWithOtp: (identifier: string, type: 'email' | 'mobile', otp: string) => Promise<User>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Hydrate from stored token on mount
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    authApi.getProfile()
      .then((u) => {
        setUser(u);
        getSocket(); // open ws connection
      })
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<User> => {
    const { user: u, token } = await authApi.login({ email, password });
    setToken(token);
    setUser(u);
    getSocket();
    return u;
  }, []);

  const register = useCallback(async (data: { email: string; password: string; fullName: string; phone?: string; role?: string }): Promise<User> => {
    const { user: u, token } = await authApi.register(data);
    setToken(token);
    setUser(u);
    getSocket();
    return u;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    disconnectSocket();
    router.push('/');
  }, [router]);

  const refreshProfile = useCallback(async () => {
    const u = await authApi.getProfile();
    setUser(u);
  }, []);

  const sendOtp = useCallback(async (identifier: string, type: 'email' | 'mobile') => {
    await otpApi.sendOtp({ identifier, type });
  }, []);

  const loginWithOtp = useCallback(async (identifier: string, type: 'email' | 'mobile', otp: string): Promise<User> => {
    const { user: u, token } = await otpApi.verifyOtp({ identifier, type, otp });
    setToken(token);
    setUser(u);
    getSocket();
    return u;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshProfile, sendOtp, loginWithOtp }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

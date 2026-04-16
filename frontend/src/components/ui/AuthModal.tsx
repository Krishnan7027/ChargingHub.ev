'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import Modal from './Modal';
import EVLoader from './EVLoader';
import { useAuth } from '@/context/AuthContext';
import { fadeInUp, staggerContainer, staggerItem, buttonTap } from '@/lib/animations';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  /** Called after successful login/signup with user object */
  onAuthenticated: () => void;
}

export default function AuthModal({ open, onClose, onAuthenticated }: AuthModalProps) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Login fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Signup extra fields
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  function resetForm() {
    setError('');
    setEmail('');
    setPassword('');
    setFullName('');
    setShowPassword(false);
  }

  function switchMode(newMode: 'signup' | 'login') {
    resetForm();
    setMode(newMode);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register({ email, password, fullName, role: 'customer' });
      }
      resetForm();
      onClose();
      onAuthenticated();
    } catch (err: any) {
      setError(err.message || (mode === 'login' ? 'Login failed' : 'Signup failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-sm">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={staggerItem} className="text-center mb-5">
          <motion.div
            whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1 }}
            transition={{ duration: 0.5 }}
            className="w-12 h-12 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-primary-600/20"
          >
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </motion.div>
          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <h2 className="text-xl font-bold text-theme-primary">
                {mode === 'signup' ? 'Get Started with EV Charge Hub' : 'Welcome back'}
              </h2>
              <p className="text-sm text-theme-muted mt-1">
                {mode === 'signup'
                  ? 'Smart routes, live availability, and charging recommendations'
                  : 'Sign in to continue your journey'}
              </p>
            </motion.div>
          </AnimatePresence>
        </motion.div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2 overflow-hidden"
            >
              <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.form variants={staggerItem} onSubmit={handleSubmit} className="space-y-3">
          <AnimatePresence>
            {mode === 'signup' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <label className="block text-sm font-medium text-theme-secondary mb-1">Full Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Your name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </motion.div>
            )}
          </AnimatePresence>
          <div>
            <label className="block text-sm font-medium text-theme-secondary mb-1">Email</label>
            <input
              type="email"
              className="input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-theme-secondary mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className="input pr-10"
                placeholder={mode === 'signup' ? 'Min 8 characters' : 'Your password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                required
                minLength={mode === 'signup' ? 8 : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-muted hover:text-theme-secondary"
                tabIndex={-1}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {showPassword ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  ) : (
                    <>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </>
                  )}
                </svg>
              </button>
            </div>
          </div>

          <motion.button
            whileTap={buttonTap}
            type="submit"
            className="btn-primary w-full"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <EVLoader size="sm" />
                {mode === 'signup' ? 'Creating account...' : 'Signing in...'}
              </span>
            ) : mode === 'signup' ? 'Sign Up' : 'Sign In'}
          </motion.button>
        </motion.form>

        <motion.div variants={staggerItem} className="mt-4 text-center">
          {mode === 'signup' ? (
            <p className="text-sm text-theme-muted">
              Already have an account?{' '}
              <button onClick={() => switchMode('login')} className="text-primary-600 hover:text-primary-700 font-medium">
                Sign in
              </button>
            </p>
          ) : (
            <p className="text-sm text-theme-muted">
              New here?{' '}
              <button onClick={() => switchMode('signup')} className="text-primary-600 hover:text-primary-700 font-medium">
                Create an account
              </button>
            </p>
          )}
        </motion.div>

        <motion.p variants={staggerItem} className="text-xs text-theme-muted text-center mt-3 opacity-60">
          Trusted by EV drivers across India
        </motion.p>
      </motion.div>
    </Modal>
  );
}

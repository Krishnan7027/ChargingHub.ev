'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { authApi } from '@/lib/api';
import Navbar from '@/components/layout/Navbar';

export default function ProfilePage() {
  const { user, loading, refreshProfile } = useAuth();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setPhone(user.phone || '');
      setAvatarUrl(user.avatar_url || '');
    }
  }, [user]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  function getInitials(name: string): string {
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await authApi.updateProfile({ fullName, phone, avatarUrl: avatarUrl || undefined });
      await refreshProfile();
      setSuccess('Profile updated successfully');
      setEditing(false);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
    <Navbar />
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => router.back()} className="btn-ghost text-sm py-1 px-2 -ml-2 mb-2 flex items-center gap-1 text-theme-secondary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back
        </button>
        <h1 className="text-2xl font-bold text-theme-primary mb-6">My Profile</h1>

        <div className="glass-heavy rounded-2xl p-6 border border-glass">
          {/* Avatar section */}
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-glass">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.full_name}
                className="w-20 h-20 rounded-full object-cover ring-4 ring-primary-500/20"
              />
            ) : (
              <div className="w-20 h-20 bg-primary-500/15 text-primary-500 rounded-full flex items-center justify-center text-2xl font-bold">
                {getInitials(user.full_name)}
              </div>
            )}
            <div>
              <h2 className="text-lg font-semibold text-theme-primary">{user.full_name}</h2>
              <p className="text-sm text-theme-muted">{user.email}</p>
              <span className="badge-blue capitalize text-xs mt-1 inline-block">{user.role}</span>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">{error}</div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-sm text-green-400">{success}</div>
          )}

          {editing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-theme-secondary mb-1">Full Name</label>
                <input type="text" className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-secondary mb-1">Phone</label>
                <input type="tel" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-secondary mb-1">Avatar URL</label>
                <input type="url" className="input" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://example.com/avatar.jpg" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleSave} className="btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button onClick={() => { setEditing(false); setError(''); setSuccess(''); }} className="btn-secondary">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-theme-muted uppercase tracking-wide">Full Name</p>
                  <p className="text-sm text-theme-primary mt-1">{user.full_name}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-theme-muted uppercase tracking-wide">Email</p>
                  <p className="text-sm text-theme-primary mt-1">{user.email}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-theme-muted uppercase tracking-wide">Phone</p>
                  <p className="text-sm text-theme-primary mt-1">{user.phone || 'Not set'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-theme-muted uppercase tracking-wide">Member Since</p>
                  <p className="text-sm text-theme-primary mt-1">{new Date(user.created_at).toLocaleDateString()}</p>
                </div>
              </div>
              <button onClick={() => setEditing(true)} className="btn-primary mt-4">
                Edit Profile
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}

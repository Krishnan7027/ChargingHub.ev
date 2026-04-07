'use client';

import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import ProtectedRoute from '@/components/ui/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { useCountry } from '@/context/CountryContext';
import { formatCurrency } from '@/lib/formatCurrency';
import { useMyReservations, useActiveSessions, useCancelReservation } from '@/hooks/useStations';
import { useWalletSummary, useUserCarbon, useRangeAlerts } from '@/hooks/useIntelligent';
import { useSocket } from '@/hooks/useSocket';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import toast from 'react-hot-toast';

export default function CustomerDashboard() {
  const { user } = useAuth();
  const { country } = useCountry();
  const queryClient = useQueryClient();
  const { on } = useSocket();
  const { data: reservations, isLoading: resLoading } = useMyReservations();
  const { data: activeSessions } = useActiveSessions();
  const cancelReservation = useCancelReservation();
  const { data: wallet } = useWalletSummary();
  const { data: carbon } = useUserCarbon();
  const { data: alertsData } = useRangeAlerts({ limit: 5, unreadOnly: true });

  // Real-time updates for gamification and charging
  useEffect(() => {
    const cleanups = [
      on('charging:update', () => {
        queryClient.invalidateQueries({ queryKey: ['charging', 'active'] });
      }),
      on('points:awarded', (data: { points: number; description: string }) => {
        toast.success(`+${data.points} points: ${data.description}`);
        queryClient.invalidateQueries({ queryKey: ['gamification'] });
      }),
      on('badge:earned', (data: { name: string }) => {
        toast.success(`Badge earned: ${data.name}!`);
        queryClient.invalidateQueries({ queryKey: ['gamification'] });
      }),
      on('level:up', (data: { levelName: string }) => {
        toast.success(`Level up! You're now ${data.levelName}`);
        queryClient.invalidateQueries({ queryKey: ['gamification'] });
      }),
      on('range:alert', () => {
        queryClient.invalidateQueries({ queryKey: ['range-safety', 'alerts'] });
      }),
      on('reservation:updated', () => {
        queryClient.invalidateQueries({ queryKey: ['reservations'] });
      }),
      on('charging:completed', (data: { energyDeliveredKwh: number; cost: number }) => {
        toast.success(`Charging complete! ${data.energyDeliveredKwh} kWh - ${formatCurrency(data.cost, country)}`);
        queryClient.invalidateQueries({ queryKey: ['charging', 'active'] });
        queryClient.invalidateQueries({ queryKey: ['carbon', 'me'] });
      }),
    ];
    return () => cleanups.forEach((fn) => fn());
  }, [on, queryClient]);

  async function handleCancel(id: string) {
    try {
      await cancelReservation.mutateAsync(id);
      toast.success('Reservation cancelled');
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel');
    }
  }

  const unreadAlerts = alertsData?.alerts?.length ?? 0;

  return (
    <ProtectedRoute roles={['customer']}>
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-theme-primary mb-6">Welcome, {user?.full_name}</h1>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {/* Points */}
          <Link href="/rewards" className="card hover:shadow-md transition-shadow group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-500/10 text-yellow-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-theme-secondary">Points</p>
                <p className="text-lg font-bold text-theme-primary">{wallet?.wallet?.totalPoints?.toLocaleString() ?? '0'}</p>
                {wallet?.level && (
                  <p className="text-xs text-yellow-500">{wallet.level.current.name}</p>
                )}
              </div>
            </div>
          </Link>

          {/* Carbon Saved */}
          <Link href="/reviews" className="card hover:shadow-md transition-shadow group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/10 text-green-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-theme-secondary">CO2 Saved</p>
                <p className="text-lg font-bold text-theme-primary">{carbon?.totals?.carbonSavedKg ? `${Number(carbon.totals.carbonSavedKg).toFixed(1)} kg` : '0 kg'}</p>
              </div>
            </div>
          </Link>

          {/* Active Sessions */}
          <div className="card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/10 text-blue-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-theme-secondary">Charging</p>
                <p className="text-lg font-bold text-theme-primary">{activeSessions?.length ?? 0}</p>
                <p className="text-xs text-blue-500">{activeSessions?.length ? 'In progress' : 'None active'}</p>
              </div>
            </div>
          </div>

          {/* Range Alerts */}
          <Link href="/range-safety" className="card hover:shadow-md transition-shadow group">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${unreadAlerts > 0 ? 'bg-red-500/10 text-red-500' : 'bg-[var(--bg-tertiary)] text-theme-muted'}`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-theme-secondary">Alerts</p>
                <p className="text-lg font-bold text-theme-primary">{unreadAlerts}</p>
                <p className={`text-xs ${unreadAlerts > 0 ? 'text-red-500' : 'text-theme-muted'}`}>
                  {unreadAlerts > 0 ? 'Unread' : 'All clear'}
                </p>
              </div>
            </div>
          </Link>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-theme-primary mb-3">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Link href="/map" className="flex flex-col items-center gap-2 p-4 glass rounded-xl hover:bg-primary-50 hover:border-primary-200 transition-colors text-center border border-[var(--border-default)]">
              <svg className="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
              <span className="text-sm font-medium text-theme-secondary">Find Station</span>
            </Link>
            <Link href="/smart-schedule" className="flex flex-col items-center gap-2 p-4 glass rounded-xl hover:bg-primary-50 hover:border-primary-200 transition-colors text-center border border-[var(--border-default)]">
              <svg className="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm font-medium text-theme-secondary">Smart Schedule</span>
            </Link>
            <Link href="/route-planner" className="flex flex-col items-center gap-2 p-4 glass rounded-xl hover:bg-primary-50 hover:border-primary-200 transition-colors text-center border border-[var(--border-default)]">
              <svg className="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <span className="text-sm font-medium text-theme-secondary">Route Plan</span>
            </Link>
            <Link href="/battery-health" className="flex flex-col items-center gap-2 p-4 glass rounded-xl hover:bg-primary-50 hover:border-primary-200 transition-colors text-center border border-[var(--border-default)]">
              <svg className="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              <span className="text-sm font-medium text-theme-secondary">Battery Health</span>
            </Link>
            <Link href="/payments" className="flex flex-col items-center gap-2 p-4 glass rounded-xl hover:bg-primary-50 hover:border-primary-200 transition-colors text-center border border-[var(--border-default)]">
              <svg className="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              <span className="text-sm font-medium text-theme-secondary">Payments</span>
            </Link>
          </div>
        </div>

        {/* Active Charging Sessions */}
        {activeSessions && activeSessions.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-theme-primary mb-4">Active Charging</h2>
            <div className="grid gap-4">
              {activeSessions.map((session) => (
                <div key={session.id} className="card border-l-4 border-l-green-500">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold text-theme-primary">{session.station_name}</h3>
                      <p className="text-sm text-theme-secondary">Slot #{session.slot_number}</p>
                    </div>
                    <StatusBadge status="charging" />
                  </div>
                  <div className="mb-2">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-theme-primary">{session.current_percentage}%</span>
                      <span className="text-theme-primary">{session.target_percentage}%</span>
                    </div>
                    <div className="w-full bg-[var(--bg-tertiary)] rounded-full h-3">
                      <div
                        className="bg-green-500 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${(session.current_percentage / session.target_percentage) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex justify-between text-sm text-theme-secondary">
                    <span>{session.energy_delivered_kwh} kWh delivered</span>
                    <span>{formatCurrency(session.cost, country)}</span>
                  </div>
                  {session.estimated_minutes_remaining && (
                    <p className="text-xs text-theme-muted mt-1">
                      ~{session.estimated_minutes_remaining} min remaining
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Gamification Progress */}
        {wallet?.level && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-theme-primary mb-4">Your Progress</h2>
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-sm font-medium text-theme-secondary">Level {wallet.level.current.level}</span>
                  <span className="mx-2 text-theme-muted">|</span>
                  <span className="text-sm text-primary-600 font-medium">{wallet.level.current.name}</span>
                </div>
                {wallet.level.next && (
                  <span className="text-xs text-theme-secondary">Next: {wallet.level.next.name}</span>
                )}
              </div>
              <div className="w-full bg-[var(--bg-tertiary)] rounded-full h-2.5 mb-2">
                <div
                  className="bg-primary-600 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${wallet.level.progressPct}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-theme-secondary">
                <span>{wallet.wallet.lifetimePoints.toLocaleString()} lifetime pts</span>
                <span>{Math.round(wallet.level.progressPct)}% to next level</span>
              </div>
              {/* Recent badges */}
              {wallet.badges && wallet.badges.filter((b) => b.earned).length > 0 && (
                <div className="mt-4 pt-4 border-t border-[var(--border-default)]">
                  <p className="text-xs text-theme-secondary mb-2">Recent Badges</p>
                  <div className="flex flex-wrap gap-2">
                    {wallet.badges.filter((b) => b.earned).slice(0, 6).map((badge) => (
                      <div key={badge.id} className="flex items-center gap-1.5 bg-[var(--bg-tertiary)] px-2.5 py-1 rounded-full" title={badge.description}>
                        <span>{badge.icon}</span>
                        <span className="text-xs font-medium text-theme-secondary">{badge.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Reservations */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-theme-primary">Your Reservations</h2>
            <Link href="/reservations" className="text-sm text-primary-600 hover:underline">View all</Link>
          </div>
          {resLoading ? (
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="card h-24 bg-[var(--bg-tertiary)]" />)}
            </div>
          ) : !reservations || reservations.length === 0 ? (
            <EmptyState
              title="No reservations yet"
              description="Find a station on the map to make your first reservation."
              action={<Link href="/map" className="btn-primary text-sm">Find a Station</Link>}
            />
          ) : (
            <div className="space-y-3">
              {reservations.slice(0, 5).map((res) => (
                <div key={res.id} className="card">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-theme-primary">{res.station_name}</h3>
                      <p className="text-sm text-theme-secondary">{res.station_address}</p>
                      <p className="text-sm text-theme-secondary mt-1">
                        Slot #{res.slot_number} &middot; {res.charging_type?.replace('_', ' ')}
                      </p>
                      <p className="text-sm text-theme-primary mt-1">
                        {new Date(res.scheduled_start).toLocaleString()} - {new Date(res.scheduled_end).toLocaleString()}
                      </p>
                    </div>
                    <StatusBadge status={res.status} />
                  </div>
                  {['pending', 'confirmed'].includes(res.status) && (
                    <button
                      onClick={() => handleCancel(res.id)}
                      disabled={cancelReservation.isPending}
                      className="mt-3 text-sm text-red-500 hover:text-red-400"
                    >
                      Cancel reservation
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}

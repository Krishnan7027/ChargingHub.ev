'use client';

import { useState } from 'react';
import { useSessionHistory, useSessionStats } from '@/hooks/useSessionHistory';
import { useCountry } from '@/context/CountryContext';
import { formatCurrency } from '@/lib/formatCurrency';
import Link from 'next/link';
import PageTransition from '@/components/ui/PageTransition';
import type { SessionHistoryFilters } from '@/types';

export default function ChargingHistoryPage() {
  const { country } = useCountry();
  const [filters, setFilters] = useState<SessionHistoryFilters>({
    page: 1,
    limit: 20,
    sort_by: 'started_at',
    sort_order: 'desc',
  });

  const { data: history, isLoading } = useSessionHistory(filters);
  const { data: stats } = useSessionStats();

  const updateFilter = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value || undefined, page: 1 }));
  };

  const totalPages = history ? Math.ceil(history.total / history.limit) : 0;

  return (
    <PageTransition>
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6 dark:text-white">Charging History</h1>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Sessions</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalSessions}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">Energy Used</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.totalEnergyKwh} kWh</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Cost</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(stats.totalCost, country)}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">Avg Duration</p>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.avgDurationMin} min</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={filters.status || ''}
          onChange={(e) => updateFilter('status', e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm dark:text-gray-200"
        >
          <option value="">All Statuses</option>
          <option value="completed">Completed</option>
          <option value="charging">Active</option>
          <option value="failed">Failed</option>
        </select>

        <input
          type="date"
          value={filters.start_date || ''}
          onChange={(e) => updateFilter('start_date', e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm dark:text-gray-200"
          placeholder="From"
        />
        <input
          type="date"
          value={filters.end_date || ''}
          onChange={(e) => updateFilter('end_date', e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm dark:text-gray-200"
          placeholder="To"
        />

        <select
          value={filters.sort_by || 'started_at'}
          onChange={(e) => updateFilter('sort_by', e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm dark:text-gray-200"
        >
          <option value="started_at">Date</option>
          <option value="cost">Cost</option>
          <option value="energy_delivered_kwh">Energy</option>
        </select>

        <button
          type="button"
          onClick={() => setFilters((prev) => ({
            ...prev,
            sort_order: prev.sort_order === 'desc' ? 'asc' : 'desc',
          }))}
          className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          {filters.sort_order === 'desc' ? 'Newest First' : 'Oldest First'}
        </button>
      </div>

      {/* Sessions List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-3" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
            </div>
          ))}
        </div>
      ) : !history || history.sessions.length === 0 ? (
        <div className="text-center py-16">
          <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-gray-500 dark:text-gray-400 text-lg">No charging sessions found</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {history.sessions.map((session) => {
              const duration = session.completed_at
                ? Math.round((new Date(session.completed_at).getTime() - new Date(session.started_at).getTime()) / 60_000)
                : null;

              return (
                <Link
                  key={session.id}
                  href={`/stations/${session.station_id}`}
                  className="block bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:text-white truncate">{session.station_name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {new Date(session.started_at).toLocaleDateString()} at {new Date(session.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {duration && ` - ${duration} min`}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        Slot #{session.slot_number} - {session.charging_type} - {session.connector_type}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 sm:text-right">
                      <div>
                        <p className="text-sm font-medium text-green-600 dark:text-green-400">{session.energy_delivered_kwh} kWh</p>
                        <p className="text-xs text-gray-400">{session.start_percentage}% → {session.current_percentage}%</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(session.cost, country)}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          session.status === 'completed'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : session.status === 'charging'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {session.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-8">
              <button
                type="button"
                onClick={() => setFilters((prev) => ({ ...prev, page: Math.max(1, (prev.page || 1) - 1) }))}
                disabled={(filters.page || 1) <= 1}
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-200"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Page {history.page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setFilters((prev) => ({ ...prev, page: Math.min(totalPages, (prev.page || 1) + 1) }))}
                disabled={(filters.page || 1) >= totalPages}
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-200"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
    </PageTransition>
  );
}

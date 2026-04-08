'use client';

import { useState } from 'react';
import Navbar from '@/components/layout/Navbar';
import ProtectedRoute from '@/components/ui/ProtectedRoute';
import { usePlatformAnalytics } from '@/hooks/useIntelligent';

function BarChart({ data, labelKey, valueKey, color = 'bg-primary-500' }: {
  data: any[];
  labelKey: string;
  valueKey: string;
  color?: string;
}) {
  if (!data || data.length === 0) return <p className="text-theme-muted text-sm">No data</p>;
  const max = Math.max(...data.map((d) => Number(d[valueKey]) || 0), 1);

  return (
    <div className="space-y-2">
      {data.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-xs text-theme-secondary w-20 text-right truncate">{item[labelKey]}</span>
          <div className="flex-1 glass rounded-full h-5 overflow-hidden">
            <div
              className={`${color} h-full rounded-full transition-all flex items-center justify-end pr-2`}
              style={{ width: `${Math.max((Number(item[valueKey]) / max) * 100, 2)}%` }}
            >
              <span className="text-[10px] text-white font-medium">{item[valueKey]}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<string>('daily');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  const { data: analytics, isLoading } = usePlatformAnalytics({
    ...dateRange,
    period,
  });

  return (
    <ProtectedRoute roles={['admin']}>
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
          <div className="flex gap-2 items-center">
            <input
              type="date"
              className="input text-sm"
              value={dateRange.startDate}
              onChange={(e) => setDateRange((prev) => ({ ...prev, startDate: e.target.value }))}
            />
            <span className="text-theme-muted">to</span>
            <input
              type="date"
              className="input text-sm"
              value={dateRange.endDate}
              onChange={(e) => setDateRange((prev) => ({ ...prev, endDate: e.target.value }))}
            />
            <select
              className="input text-sm w-auto"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <div key={i} className="card h-24 animate-pulse glass" />)}
          </div>
        ) : analytics ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
              {[
                { label: 'Total Sessions', value: analytics.summary.total_sessions, color: 'text-blue-600' },
                { label: 'Reservations', value: analytics.summary.total_reservations, color: 'text-indigo-600' },
                { label: 'Energy (kWh)', value: analytics.summary.total_energy_kwh, color: 'text-green-600' },
                { label: 'Revenue', value: `$${Number(analytics.summary.total_revenue || 0).toFixed(2)}`, color: 'text-emerald-600' },
                { label: 'Avg Duration', value: `${analytics.summary.avg_session_duration_min || 0} min`, color: 'text-purple-600' },
                { label: 'Unique Users', value: analytics.summary.total_unique_users, color: 'text-orange-600' },
              ].map((s) => (
                <div key={s.label} className="card">
                  <p className="text-xs text-theme-secondary">{s.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value || 0}</p>
                </div>
              ))}
            </div>

            <div className="grid lg:grid-cols-2 gap-6 mb-8">
              {/* Sessions Trend */}
              <div className="card">
                <h3 className="font-semibold mb-4">Sessions Over Time</h3>
                <BarChart
                  data={analytics.trends.map((t) => ({ ...t, label: t.period?.slice(5) || '' }))}
                  labelKey="label"
                  valueKey="sessions"
                  color="bg-blue-500"
                />
              </div>

              {/* Revenue Trend */}
              <div className="card">
                <h3 className="font-semibold mb-4">Revenue Over Time</h3>
                <BarChart
                  data={analytics.trends.map((t) => ({ ...t, label: t.period?.slice(5) || '', rev: Number(t.revenue).toFixed(0) }))}
                  labelKey="label"
                  valueKey="rev"
                  color="bg-emerald-500"
                />
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6 mb-8">
              {/* Most Used Stations */}
              <div className="card">
                <h3 className="font-semibold mb-4">Most Used Stations</h3>
                {analytics.topStations.length === 0 ? (
                  <p className="text-theme-muted text-sm">No data yet</p>
                ) : (
                  <div className="space-y-3">
                    {analytics.topStations.map((s, i) => (
                      <div key={s.id} className="flex items-center gap-3">
                        <span className="text-lg font-bold text-gray-300 w-8">#{i + 1}</span>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{s.name}</p>
                          <p className="text-xs text-theme-secondary">{s.city}</p>
                        </div>
                        <div className="text-right text-sm">
                          <p className="font-semibold">{s.total_sessions} sessions</p>
                          <p className="text-xs text-theme-secondary">{s.total_energy_kwh} kWh</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Peak Charging Hours */}
              <div className="card">
                <h3 className="font-semibold mb-4">Peak Charging Hours</h3>
                <BarChart
                  data={analytics.peakHours}
                  labelKey="label"
                  valueKey="sessions"
                  color="bg-purple-500"
                />
              </div>
            </div>

            {/* Daily Reservations */}
            <div className="card">
              <h3 className="font-semibold mb-4">Daily Reservations</h3>
              <BarChart
                data={analytics.dailyReservations.map((d) => ({ ...d, label: d.day?.slice(5) || '' }))}
                labelKey="label"
                valueKey="total"
                color="bg-indigo-500"
              />
            </div>
          </>
        ) : (
          <div className="card text-center py-12 text-theme-secondary">
            No analytics data available. Data is aggregated hourly from charging sessions.
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}

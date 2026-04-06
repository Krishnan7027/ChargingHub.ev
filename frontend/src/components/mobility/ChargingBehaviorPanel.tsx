'use client';

import { useState } from 'react';
import { useBehaviorStats, useAvailableCities } from '@/hooks/useIntelligent';
import type { BehaviorStats } from '@/types';

const timeLabels = ['Night (0-6)', 'Morning (6-12)', 'Afternoon (12-18)', 'Evening (18-24)'];

function DurationChart({ stats }: { stats: BehaviorStats }) {
  const bars = [
    { label: 'Average', value: Number(stats.avg_session_duration_min), color: 'bg-blue-500' },
    { label: 'Median', value: Number(stats.median_session_duration_min), color: 'bg-green-500' },
    { label: 'P90', value: Number(stats.p90_session_duration_min), color: 'bg-orange-500' },
  ];
  const max = Math.max(...bars.map(b => b.value), 1);

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-gray-600">Session Duration (min)</p>
      {bars.map((b) => (
        <div key={b.label} className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 w-12">{b.label}</span>
          <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${b.color}`}
              style={{ width: `${(b.value / max) * 100}%` }}
            />
          </div>
          <span className="text-[11px] font-medium text-gray-700 w-10 text-right">{b.value.toFixed(0)}</span>
        </div>
      ))}
    </div>
  );
}

function ChargerTypeChart({ stats }: { stats: BehaviorStats }) {
  const total = stats.level1_sessions + stats.level2_sessions + stats.dc_fast_sessions;
  if (total === 0) return <p className="text-xs text-gray-400">No data</p>;

  const segments = [
    { label: 'Level 1', value: stats.level1_sessions, color: 'bg-gray-400' },
    { label: 'Level 2', value: stats.level2_sessions, color: 'bg-blue-500' },
    { label: 'DC Fast', value: stats.dc_fast_sessions, color: 'bg-orange-500' },
  ];

  return (
    <div>
      <p className="text-xs font-medium text-gray-600 mb-2">Charger Type Distribution</p>
      <div className="flex h-5 rounded-full overflow-hidden mb-2">
        {segments.map((s) => (
          s.value > 0 && (
            <div
              key={s.label}
              className={`${s.color}`}
              style={{ width: `${(s.value / total) * 100}%` }}
            />
          )
        ))}
      </div>
      <div className="flex gap-3">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${s.color}`} />
            <span className="text-[10px] text-gray-500">{s.label} ({((s.value / total) * 100).toFixed(0)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TimeDistributionChart({ stats }: { stats: BehaviorStats }) {
  const values = [stats.night_sessions, stats.morning_sessions, stats.afternoon_sessions, stats.evening_sessions];
  const max = Math.max(...values, 1);
  const colors = ['bg-indigo-400', 'bg-yellow-400', 'bg-orange-400', 'bg-blue-600'];

  return (
    <div>
      <p className="text-xs font-medium text-gray-600 mb-2">Time of Day Distribution</p>
      <div className="flex items-end gap-2 h-20">
        {values.map((v, i) => (
          <div key={i} className="flex-1 flex flex-col items-center">
            <span className="text-[9px] text-gray-500 mb-0.5">{v}</span>
            <div
              className={`w-full rounded-t ${colors[i]}`}
              style={{ height: `${Math.max((v / max) * 100, 4)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-1">
        {timeLabels.map((l, i) => (
          <div key={i} className="flex-1 text-center">
            <span className="text-[8px] text-gray-400">{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ChargingBehaviorPanel() {
  const { data: citiesData } = useAvailableCities();
  const [selectedCity, setSelectedCity] = useState<string>('');

  const { data, isLoading } = useBehaviorStats({
    city: selectedCity || undefined,
  });

  // Use the latest stats entry per city for display
  const latestStats = data?.stats?.[0] as BehaviorStats | undefined;

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <h3 className="font-semibold text-gray-900">Charging Behavior Analysis</h3>
      </div>

      <div className="mb-4">
        <select
          value={selectedCity}
          onChange={(e) => setSelectedCity(e.target.value)}
          className="input text-sm py-1.5"
        >
          <option value="">All Cities</option>
          {citiesData?.cities?.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin w-6 h-6 border-3 border-primary-600 border-t-transparent rounded-full" />
        </div>
      ) : latestStats ? (
        <div className="space-y-5">
          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-3">
            <div className="text-center p-2 bg-gray-50 rounded-lg">
              <p className="text-lg font-bold text-gray-900">{latestStats.total_sessions}</p>
              <p className="text-[10px] text-gray-500">Sessions</p>
            </div>
            <div className="text-center p-2 bg-gray-50 rounded-lg">
              <p className="text-lg font-bold text-gray-900">{latestStats.unique_users}</p>
              <p className="text-[10px] text-gray-500">Unique Users</p>
            </div>
            <div className="text-center p-2 bg-gray-50 rounded-lg">
              <p className="text-lg font-bold text-blue-600">{Number(latestStats.avg_energy_kwh).toFixed(1)}</p>
              <p className="text-[10px] text-gray-500">Avg kWh</p>
            </div>
            <div className="text-center p-2 bg-gray-50 rounded-lg">
              <p className="text-lg font-bold text-green-600">
                {latestStats.peak_hour != null ? `${latestStats.peak_hour}:00` : '--'}
              </p>
              <p className="text-[10px] text-gray-500">Peak Hour</p>
            </div>
          </div>

          {/* SoC range */}
          <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-red-50 to-green-50 rounded-lg">
            <div className="text-center flex-1">
              <p className="text-xs text-gray-500">Avg Start SoC</p>
              <p className="text-xl font-bold text-red-600">{Number(latestStats.avg_start_soc).toFixed(0)}%</p>
            </div>
            <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            <div className="text-center flex-1">
              <p className="text-xs text-gray-500">Avg End SoC</p>
              <p className="text-xl font-bold text-green-600">{Number(latestStats.avg_end_soc).toFixed(0)}%</p>
            </div>
          </div>

          <DurationChart stats={latestStats} />
          <ChargerTypeChart stats={latestStats} />
          <TimeDistributionChart stats={latestStats} />
        </div>
      ) : (
        <p className="text-sm text-gray-400 text-center py-8">
          No behavior data available. Run data aggregation to generate insights.
        </p>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  useBatteryHealth,
  useAnalyzeBatteryHealth,
  useUpdateBatteryProfile,
  useDismissHealthRecommendation,
} from '@/hooks/useIntelligent';
import type { BatteryHealthResponse, HealthRecommendation, HealthSnapshot } from '@/types';

// ── Health Gauge ─────────────────────────────────────────────────
function HealthGauge({ healthPct }: { healthPct: number }) {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const progress = (healthPct / 100) * circumference;
  const color = healthPct >= 90 ? '#22c55e' : healthPct >= 80 ? '#f59e0b' : healthPct >= 70 ? '#f97316' : '#ef4444';

  return (
    <div className="relative flex items-center justify-center">
      <svg width="180" height="180" viewBox="0 0 180 180">
        <circle cx="90" cy="90" r={radius} fill="none" stroke="#f3f4f6" strokeWidth="12" />
        <circle
          cx="90" cy="90" r={radius} fill="none"
          stroke={color} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          transform="rotate(-90 90 90)"
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-4xl font-bold" style={{ color }}>{healthPct.toFixed(1)}%</p>
        <p className="text-xs text-gray-500">Battery Health</p>
      </div>
    </div>
  );
}

// ── Health Trend Chart ───────────────────────────────────────────
function HealthTrendChart({ snapshots }: { snapshots: HealthSnapshot[] }) {
  if (snapshots.length < 2) return null;

  const sorted = [...snapshots].reverse(); // oldest first
  const min = Math.min(...sorted.map(s => s.healthPct));
  const max = Math.max(...sorted.map(s => s.healthPct));
  const range = Math.max(max - min, 1);
  const chartHeight = 100;
  const chartWidth = 100;

  const points = sorted.map((s, i) => {
    const x = (i / (sorted.length - 1)) * chartWidth;
    const y = chartHeight - ((s.healthPct - min + 1) / (range + 2)) * chartHeight;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div>
      <p className="text-xs font-medium text-gray-600 mb-2">Health Over Time</p>
      <svg viewBox={`-5 -5 ${chartWidth + 10} ${chartHeight + 10}`} className="w-full h-24">
        <polyline
          points={points}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {sorted.map((s, i) => {
          const x = (i / (sorted.length - 1)) * chartWidth;
          const y = chartHeight - ((s.healthPct - min + 1) / (range + 2)) * chartHeight;
          return <circle key={i} cx={x} cy={y} r="2.5" fill="#3b82f6" />;
        })}
      </svg>
      <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
        <span>{new Date(sorted[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
        <span>{new Date(sorted[sorted.length - 1].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
      </div>
    </div>
  );
}

// ── Charging Pattern Bars ────────────────────────────────────────
function ChargingPatternViz({ data }: { data: BatteryHealthResponse }) {
  if (!data.chargingPatterns) return null;
  const p = data.chargingPatterns;

  const socBarWidth = 100;
  const startPx = (p.avgStartSoc / 100) * socBarWidth;
  const endPx = (p.avgEndSoc / 100) * socBarWidth;

  return (
    <div className="space-y-4">
      {/* SoC Range */}
      <div>
        <p className="text-xs font-medium text-gray-600 mb-2">Average Charging Range</p>
        <div className="relative h-8 bg-gray-100 rounded-full overflow-hidden">
          {/* Ideal zone indicator */}
          <div className="absolute h-full bg-green-100 rounded-full" style={{ left: '20%', width: '60%' }} />
          {/* Actual range */}
          <div
            className="absolute h-full bg-blue-500 rounded-full opacity-70"
            style={{ left: `${startPx}%`, width: `${Math.max(endPx - startPx, 1)}%` }}
          />
          {/* Labels */}
          <div className="absolute inset-0 flex items-center justify-between px-3">
            <span className="text-[10px] font-medium text-gray-600">{p.avgStartSoc.toFixed(0)}%</span>
            <span className="text-[10px] font-medium text-gray-600">{p.avgEndSoc.toFixed(0)}%</span>
          </div>
        </div>
        <div className="flex justify-between text-[9px] text-gray-400 mt-1 px-1">
          <span>0%</span>
          <span className="text-green-500">Ideal: 20-80%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Fast vs Normal */}
      <div>
        <p className="text-xs font-medium text-gray-600 mb-2">Charging Speed Distribution</p>
        <div className="flex h-5 rounded-full overflow-hidden">
          {p.normalChargeSessions > 0 && (
            <div
              className="bg-blue-500 flex items-center justify-center"
              style={{ width: `${100 - p.fastChargePct}%` }}
            >
              {100 - p.fastChargePct > 15 && (
                <span className="text-[9px] text-white font-medium">Normal</span>
              )}
            </div>
          )}
          {p.fastChargeSessions > 0 && (
            <div
              className="bg-orange-500 flex items-center justify-center"
              style={{ width: `${p.fastChargePct}%` }}
            >
              {p.fastChargePct > 15 && (
                <span className="text-[9px] text-white font-medium">Fast</span>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-4 mt-1.5">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-[10px] text-gray-500">Normal: {p.normalChargeSessions}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-orange-500" />
            <span className="text-[10px] text-gray-500">DC Fast: {p.fastChargeSessions}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Recommendation Card ──────────────────────────────────────────
function RecommendationCard({ rec, onDismiss }: { rec: HealthRecommendation; onDismiss: (id: string) => void }) {
  const severityStyles = {
    critical: 'border-red-300 bg-red-50',
    warning: 'border-yellow-300 bg-yellow-50',
    info: 'border-blue-200 bg-blue-50',
  };
  const iconStyles = {
    critical: 'text-red-500',
    warning: 'text-yellow-500',
    info: 'text-blue-500',
  };

  return (
    <div className={`border rounded-lg p-3 ${severityStyles[rec.severity]}`}>
      <div className="flex items-start gap-2">
        <svg className={`w-4 h-4 mt-0.5 flex-shrink-0 ${iconStyles[rec.severity]}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {rec.severity === 'critical' ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          ) : rec.severity === 'warning' ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          )}
        </svg>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">{rec.title}</p>
            <button onClick={() => onDismiss(rec.id)} className="text-[10px] text-gray-400 hover:text-gray-600 flex-shrink-0 ml-2">
              Dismiss
            </button>
          </div>
          <p className="text-xs text-gray-600 mt-1">{rec.description}</p>
          {rec.potentialHealthImpactPct > 0 && (
            <p className="text-[10px] text-green-600 mt-1">
              Potential improvement: up to {rec.potentialHealthImpactPct.toFixed(1)}% less degradation/year
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Vehicle Profile Editor ───────────────────────────────────────
function VehicleProfileEditor({ profile, onSave }: {
  profile: BatteryHealthResponse['profile'];
  onSave: (data: { vehicleName?: string; batteryCapacityKwh?: number; manufactureYear?: number }) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile?.vehicleName || 'My EV');
  const [capacity, setCapacity] = useState(profile?.batteryCapacityKwh || 60);
  const [year, setYear] = useState(profile?.manufactureYear || new Date().getFullYear());

  if (!editing) {
    return (
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
        <div>
          <p className="font-medium text-gray-900">{profile?.vehicleName || 'My EV'}</p>
          <p className="text-xs text-gray-500">
            {profile?.batteryCapacityKwh || 60} kWh
            {profile?.manufactureYear ? ` | ${profile.manufactureYear}` : ''}
            {profile?.calendarAgeMonths ? ` | ${profile.calendarAgeMonths} months old` : ''}
          </p>
        </div>
        <button onClick={() => setEditing(true)} className="text-xs text-primary-500 hover:text-primary-700">
          Edit
        </button>
      </div>
    );
  }

  return (
    <div className="p-3 bg-gray-50 rounded-lg space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] text-gray-500">Vehicle Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} className="input text-sm py-1" />
        </div>
        <div>
          <label className="text-[10px] text-gray-500">Battery kWh</label>
          <input type="number" value={capacity} onChange={e => setCapacity(Number(e.target.value))} className="input text-sm py-1" min={10} max={200} />
        </div>
        <div>
          <label className="text-[10px] text-gray-500">Year</label>
          <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} className="input text-sm py-1" min={2010} max={2030} />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => { onSave({ vehicleName: name, batteryCapacityKwh: capacity, manufactureYear: year }); setEditing(false); }}
          className="btn-primary text-xs py-1 px-3"
        >Save</button>
        <button onClick={() => setEditing(false)} className="btn-secondary text-xs py-1 px-3">Cancel</button>
      </div>
    </div>
  );
}

// ── Main Dashboard ───────────────────────────────────────────────
export default function BatteryHealthDashboard() {
  const { data, isLoading } = useBatteryHealth();
  const analyze = useAnalyzeBatteryHealth();
  const updateProfile = useUpdateBatteryProfile();
  const dismiss = useDismissHealthRecommendation();

  const handleAnalyze = async () => {
    try {
      await analyze.mutateAsync();
      toast.success('Battery health analysis complete!');
    } catch (err: any) {
      toast.error(err.message || 'Analysis failed');
    }
  };

  const handleUpdateProfile = async (profileData: { vehicleName?: string; batteryCapacityKwh?: number; manufactureYear?: number }) => {
    try {
      await updateProfile.mutateAsync(profileData);
      toast.success('Vehicle profile updated');
    } catch (err: any) {
      toast.error(err.message || 'Update failed');
    }
  };

  const handleDismiss = async (recId: string) => {
    try {
      await dismiss.mutateAsync(recId);
    } catch (err: any) {
      toast.error(err.message || 'Failed to dismiss');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const hasData = data?.profile && data.profile.healthPct > 0 && data.chargingPatterns && data.chargingPatterns.totalSessions > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <h2 className="text-2xl font-bold text-gray-900">Battery Health</h2>
          <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">AI Prediction</span>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={analyze.isPending}
          className="btn-primary text-sm py-2 px-4"
        >
          {analyze.isPending ? 'Analyzing...' : hasData ? 'Re-Analyze' : 'Analyze My Battery'}
        </button>
      </div>

      {/* Vehicle Profile */}
      <VehicleProfileEditor profile={data?.profile ?? null} onSave={handleUpdateProfile} />

      {!hasData ? (
        <div className="card text-center py-12">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-600 mb-2">No battery health data yet</h3>
          <p className="text-sm text-gray-400 max-w-md mx-auto">
            Click &quot;Analyze My Battery&quot; to scan your charging history and generate personalized health predictions and recommendations.
          </p>
        </div>
      ) : (
        <>
          {/* Health Overview */}
          <div className="grid md:grid-cols-3 gap-6">
            {/* Gauge */}
            <div className="card flex flex-col items-center justify-center">
              <HealthGauge healthPct={data!.profile!.healthPct} />
              <div className="mt-3 text-center">
                <p className="text-sm text-gray-600">
                  Degradation: <span className="font-semibold">{data!.profile!.degradationRatePctPerYear.toFixed(1)}%/year</span>
                </p>
                {data!.profile!.estimatedYearsTo80Pct && (
                  <p className="text-xs text-gray-400 mt-1">
                    ~{data!.profile!.estimatedYearsTo80Pct.toFixed(1)} years to 80% threshold
                  </p>
                )}
              </div>
            </div>

            {/* Key Metrics */}
            <div className="card">
              <p className="text-xs font-medium text-gray-600 mb-3">Battery Metrics</p>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Total Cycles</span>
                  <span className="text-sm font-semibold">{data!.profile!.totalCycles.toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Energy Throughput</span>
                  <span className="text-sm font-semibold">{data!.profile!.totalEnergyThroughputKwh.toFixed(0)} kWh</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Capacity</span>
                  <span className="text-sm font-semibold">{data!.profile!.batteryCapacityKwh} kWh</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Total Sessions</span>
                  <span className="text-sm font-semibold">{data!.chargingPatterns!.totalSessions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Deep Discharges</span>
                  <span className={`text-sm font-semibold ${data!.chargingPatterns!.deepDischargeCount > 5 ? 'text-red-600' : 'text-gray-900'}`}>
                    {data!.chargingPatterns!.deepDischargeCount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Overcharge Events</span>
                  <span className={`text-sm font-semibold ${data!.chargingPatterns!.overchargeCount > 5 ? 'text-orange-600' : 'text-gray-900'}`}>
                    {data!.chargingPatterns!.overchargeCount}
                  </span>
                </div>
                {data!.chargingPatterns!.avgSessionTempCelsius && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Avg Temp</span>
                    <span className={`text-sm font-semibold ${data!.chargingPatterns!.avgSessionTempCelsius > 35 ? 'text-red-600' : 'text-gray-900'}`}>
                      {data!.chargingPatterns!.avgSessionTempCelsius.toFixed(1)}°C
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Health Trend */}
            <div className="card">
              <HealthTrendChart snapshots={data!.healthHistory} />
              {data!.healthHistory.length < 2 && (
                <p className="text-xs text-gray-400 text-center mt-4">
                  Trend data will appear after multiple analysis runs over time
                </p>
              )}
            </div>
          </div>

          {/* Charging Patterns */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">Charging Patterns</h3>
            <ChargingPatternViz data={data!} />
          </div>

          {/* Recommendations */}
          {data!.recommendations.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">AI Recommendations</h3>
              <div className="space-y-2">
                {data!.recommendations.map((rec) => (
                  <RecommendationCard key={rec.id} rec={rec} onDismiss={handleDismiss} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

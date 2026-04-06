'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  useUpdateRangeProfile,
  useCheckTripSafety,
  useRangeAlerts,
  useMarkAllAlertsRead,
} from '@/hooks/useIntelligent';
import { rangeSafetyApi } from '@/lib/api';
import type {
  VehicleRangeProfile, RangeEstimate, RangeAssessment,
  NearbyStationRange, TripSafetyResult,
} from '@/types';

// ── Status Colors ─────────────────────────────────────────────

const statusConfig: Record<string, { bg: string; text: string; label: string; icon: string }> = {
  safe: { bg: 'bg-green-50 border-green-200', text: 'text-green-700', label: 'Safe', icon: '✓' },
  warning: { bg: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-700', label: 'Warning', icon: '!' },
  critical: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', label: 'Critical', icon: '✕' },
  no_location: { bg: 'bg-gray-50 border-gray-200', text: 'text-gray-600', label: 'No Location', icon: '?' },
};

// ── Range Gauge ───────────────────────────────────────────────

function RangeGauge({ range, batteryPct }: { range: RangeEstimate; batteryPct: number }) {
  const pct = Math.min(100, Math.max(0, batteryPct));
  const color = pct > 50 ? '#22c55e' : pct > 25 ? '#f59e0b' : pct > 10 ? '#f97316' : '#ef4444';
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const progress = (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg width="130" height="130" viewBox="0 0 130 130">
          <circle cx="65" cy="65" r={radius} fill="none" stroke="#f3f4f6" strokeWidth="8" />
          <circle
            cx="65" cy="65" r={radius} fill="none"
            stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            transform="rotate(-90 65 65)"
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-2xl font-bold" style={{ color }}>{Math.round(pct)}%</p>
          <p className="text-[10px] text-gray-400">battery</p>
        </div>
      </div>
      <div className="mt-2 text-center">
        <p className="text-lg font-bold text-gray-900">{range.safeRangeKm} km</p>
        <p className="text-[10px] text-gray-500">safe range</p>
      </div>
    </div>
  );
}

// ── Station Card ──────────────────────────────────────────────

function StationCard({ station, rangeKm }: { station: NearbyStationRange; rangeKm: number }) {
  const pctOfRange = (station.distance_km / rangeKm) * 100;
  const barColor = pctOfRange > 90 ? 'bg-red-500' : pctOfRange > 70 ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-white">
      <div className="flex items-start justify-between mb-1">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900 text-sm truncate">{station.name}</p>
          <p className="text-xs text-gray-500 truncate">{station.address}, {station.city}</p>
        </div>
        <span className="text-sm font-bold text-gray-700 ml-2 whitespace-nowrap">{station.distance_km} km</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2 mb-1">
        <div className={`h-1.5 rounded-full ${barColor} transition-all`} style={{ width: `${Math.min(100, pctOfRange)}%` }} />
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${station.available_slots > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {station.available_slots}/{station.total_slots} slots
        </span>
        {station.max_power_kw && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">{station.max_power_kw} kW</span>
        )}
        {station.rating > 0 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">★ {station.rating}</span>
        )}
      </div>
    </div>
  );
}

// ── Alert Banner ──────────────────────────────────────────────

function AlertBanner({ alerts }: { alerts: Array<{ type: string; severity: string; title: string; message: string }> }) {
  if (!alerts.length) return null;
  return (
    <div className="space-y-2">
      {alerts.map((alert, i) => {
        const sev = alert.severity === 'critical' ? 'bg-red-50 border-red-300 text-red-800'
          : alert.severity === 'warning' ? 'bg-yellow-50 border-yellow-300 text-yellow-800'
          : 'bg-blue-50 border-blue-300 text-blue-800';
        return (
          <div key={i} className={`border rounded-lg p-3 ${sev}`}>
            <p className="text-sm font-semibold">{alert.title}</p>
            <p className="text-xs mt-0.5">{alert.message}</p>
          </div>
        );
      })}
    </div>
  );
}

// ── Vehicle Profile Editor ────────────────────────────────────

function ProfileEditor({ profile, range, onUpdate }: {
  profile: VehicleRangeProfile;
  range: RangeEstimate;
  onUpdate: (data: Record<string, any>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    vehicleName: profile.vehicleName,
    batteryCapacityKwh: profile.batteryCapacityKwh,
    currentBatteryPct: profile.currentBatteryPct,
    efficiencyKwhPerKm: profile.efficiencyKwhPerKm,
    drivingStyle: profile.drivingStyle,
    climateControlOn: profile.climateControlOn,
    avgSpeedKmh: profile.avgSpeedKmh,
  });

  useEffect(() => {
    setForm({
      vehicleName: profile.vehicleName,
      batteryCapacityKwh: profile.batteryCapacityKwh,
      currentBatteryPct: profile.currentBatteryPct,
      efficiencyKwhPerKm: profile.efficiencyKwhPerKm,
      drivingStyle: profile.drivingStyle,
      climateControlOn: profile.climateControlOn,
      avgSpeedKmh: profile.avgSpeedKmh,
    });
  }, [profile]);

  const handleSave = () => {
    onUpdate(form);
    setEditing(false);
  };

  if (!editing) {
    return (
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Vehicle Profile</h3>
          <button onClick={() => setEditing(true)} className="text-xs text-primary-600 hover:underline">Edit</button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div>
            <p className="text-xs text-gray-500">Vehicle</p>
            <p className="text-sm font-medium text-gray-900">{profile.vehicleName}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Battery</p>
            <p className="text-sm font-medium text-gray-900">{profile.batteryCapacityKwh} kWh</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Efficiency</p>
            <p className="text-sm font-medium text-gray-900">{profile.efficiencyKwhPerKm} kWh/km</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Style</p>
            <p className="text-sm font-medium text-gray-900 capitalize">{profile.drivingStyle}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {range.modifiers.climate.active && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">A/C On (-10%)</span>
          )}
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
            {range.modifiers.speed.avgKmh} km/h avg (×{range.modifiers.speed.multiplier})
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
            {range.modifiers.style.factor} (×{range.modifiers.style.multiplier})
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Edit Vehicle Profile</h3>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Vehicle Name</label>
          <input className="input text-sm py-1.5" value={form.vehicleName}
            onChange={(e) => setForm({ ...form, vehicleName: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Battery Capacity (kWh)</label>
          <input type="number" className="input text-sm py-1.5" value={form.batteryCapacityKwh}
            onChange={(e) => setForm({ ...form, batteryCapacityKwh: Number(e.target.value) })} />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Current Battery %</label>
          <input type="number" min="0" max="100" className="input text-sm py-1.5" value={form.currentBatteryPct}
            onChange={(e) => setForm({ ...form, currentBatteryPct: Number(e.target.value) })} />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Efficiency (kWh/km)</label>
          <input type="number" step="0.01" className="input text-sm py-1.5" value={form.efficiencyKwhPerKm}
            onChange={(e) => setForm({ ...form, efficiencyKwhPerKm: Number(e.target.value) })} />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Driving Style</label>
          <select className="input text-sm py-1.5" value={form.drivingStyle}
            onChange={(e) => setForm({ ...form, drivingStyle: e.target.value as any })}>
            <option value="eco">Eco</option>
            <option value="normal">Normal</option>
            <option value="sport">Sport</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Avg Speed (km/h)</label>
          <input type="number" className="input text-sm py-1.5" value={form.avgSpeedKmh}
            onChange={(e) => setForm({ ...form, avgSpeedKmh: Number(e.target.value) })} />
        </div>
        <div className="flex items-center gap-2 sm:col-span-2">
          <input type="checkbox" id="climate" checked={form.climateControlOn}
            onChange={(e) => setForm({ ...form, climateControlOn: e.target.checked })} />
          <label htmlFor="climate" className="text-sm text-gray-700">Climate control on</label>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={handleSave} className="btn-primary text-sm py-1.5 px-4">Save</button>
        <button onClick={() => setEditing(false)} className="btn-secondary text-sm py-1.5 px-4">Cancel</button>
      </div>
    </div>
  );
}

// ── Trip Safety Checker ───────────────────────────────────────

function TripChecker() {
  const [originLat, setOriginLat] = useState('');
  const [originLng, setOriginLng] = useState('');
  const [destLat, setDestLat] = useState('');
  const [destLng, setDestLng] = useState('');
  const [result, setResult] = useState<TripSafetyResult | null>(null);
  const checkTrip = useCheckTripSafety();

  const handleCheck = async () => {
    try {
      const data = await checkTrip.mutateAsync({
        originLat: parseFloat(originLat),
        originLng: parseFloat(originLng),
        destLat: parseFloat(destLat),
        destLng: parseFloat(destLng),
      });
      setResult(data);
    } catch (err: any) {
      toast.error(err.message || 'Trip check failed');
    }
  };

  const handleUseMyLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setOriginLat(pos.coords.latitude.toFixed(6));
          setOriginLng(pos.coords.longitude.toFixed(6));
        },
        () => toast.error('Could not get location'),
      );
    }
  };

  const tripStatus = result ? statusConfig[result.status] || statusConfig.safe : null;

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Trip Safety Check</h3>
      <p className="text-xs text-gray-500 mb-3">Check if your battery can safely cover a trip distance.</p>

      <div className="grid sm:grid-cols-2 gap-3 mb-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-gray-600">Origin Latitude</label>
            <button onClick={handleUseMyLocation} className="text-[10px] text-primary-600 hover:underline">
              Use My Location
            </button>
          </div>
          <input type="number" step="any" className="input text-sm py-1.5" placeholder="e.g. 40.7128"
            value={originLat} onChange={(e) => setOriginLat(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Origin Longitude</label>
          <input type="number" step="any" className="input text-sm py-1.5" placeholder="e.g. -74.0060"
            value={originLng} onChange={(e) => setOriginLng(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Destination Latitude</label>
          <input type="number" step="any" className="input text-sm py-1.5" placeholder="e.g. 42.3601"
            value={destLat} onChange={(e) => setDestLat(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Destination Longitude</label>
          <input type="number" step="any" className="input text-sm py-1.5" placeholder="e.g. -71.0589"
            value={destLng} onChange={(e) => setDestLng(e.target.value)} />
        </div>
      </div>

      <button
        onClick={handleCheck}
        disabled={checkTrip.isPending || !originLat || !originLng || !destLat || !destLng}
        className="w-full btn-primary py-2 text-sm"
      >
        {checkTrip.isPending ? (
          <span className="flex items-center justify-center gap-2">
            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            Checking trip safety...
          </span>
        ) : 'Check Trip Safety'}
      </button>

      {result && tripStatus && (
        <div className="mt-4 space-y-3">
          <div className={`border rounded-lg p-4 ${tripStatus.bg}`}>
            <div className="flex items-center gap-2 mb-3">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${tripStatus.text} bg-white`}>
                {tripStatus.icon}
              </span>
              <span className={`text-sm font-semibold ${tripStatus.text}`}>
                Trip is {tripStatus.label}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xs text-gray-500">Trip Distance</p>
                <p className="text-xl font-bold text-gray-900">{result.tripDistanceKm} km</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Your Range</p>
                <p className="text-xl font-bold text-gray-900">{result.estimatedRangeKm} km</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Buffer</p>
                <p className={`text-xl font-bold ${result.rangeBufferKm >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {result.rangeBufferKm} km
                </p>
              </div>
            </div>

            {/* Range vs trip bar */}
            <div className="mt-3">
              <div className="w-full bg-gray-200 rounded-full h-3 relative overflow-hidden">
                <div
                  className={`h-3 rounded-full transition-all ${result.isSafe ? 'bg-green-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(100, (result.tripDistanceKm / result.estimatedRangeKm) * 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-gray-500 mt-0.5">
                <span>0 km</span>
                <span>{result.estimatedRangeKm} km (range)</span>
              </div>
            </div>
          </div>

          <AlertBanner alerts={result.alerts} />

          {result.suggestedStop && (
            <div className="border border-primary-200 bg-primary-50 rounded-lg p-3">
              <p className="text-xs font-semibold text-primary-700 mb-1">Suggested Charging Stop</p>
              <StationCard station={result.suggestedStop} rangeKm={result.estimatedRangeKm} />
            </div>
          )}

          {result.destinationStations?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-2">Stations Near Destination</p>
              <div className="space-y-2">
                {result.destinationStations.slice(0, 3).map((s) => (
                  <StationCard key={s.id} station={s} rangeKm={result.estimatedRangeKm} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────

export default function RangeSafetyAssistant() {
  const [assessment, setAssessment] = useState<RangeAssessment | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'overview' | 'trip'>('overview');
  const updateProfile = useUpdateRangeProfile();
  const alertsQuery = useRangeAlerts({ limit: 10 });
  const markAllRead = useMarkAllAlertsRead();

  const handleAssess = async (latitude?: number, longitude?: number) => {
    setLoading(true);
    try {
      const data = await rangeSafetyApi.assessRange(
        latitude && longitude ? { latitude, longitude } : undefined,
      );
      setAssessment(data);
    } catch (err: any) {
      toast.error(err.message || 'Assessment failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLocateAndAssess = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => handleAssess(pos.coords.latitude, pos.coords.longitude),
        () => {
          toast.error('Could not get location. Assessing without location...');
          handleAssess();
        },
      );
    } else {
      handleAssess();
    }
  };

  const handleProfileUpdate = async (data: Record<string, any>) => {
    try {
      await updateProfile.mutateAsync(data);
      toast.success('Profile updated');
      // Re-assess if we have a location
      if (assessment?.profile?.lastLatitude && assessment?.profile?.lastLongitude) {
        handleAssess(assessment.profile.lastLatitude, assessment.profile.lastLongitude);
      }
    } catch (err: any) {
      toast.error(err.message || 'Update failed');
    }
  };

  useEffect(() => {
    handleLocateAndAssess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const status = assessment ? statusConfig[assessment.status] || statusConfig.safe : null;
  const unreadAlerts = alertsQuery.data?.alerts?.filter((a) => !a.is_read).length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <svg className="w-6 h-6 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        <h2 className="text-2xl font-bold text-gray-900">Range Safety Assistant</h2>
        <span className="text-[10px] bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium">AI</span>
      </div>
      <p className="text-sm text-gray-500">
        Monitor your driving range and get alerts when battery is low or stations are far away.
      </p>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setTab('overview')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'overview' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Range Overview
        </button>
        <button
          onClick={() => setTab('trip')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'trip' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Trip Safety Check
        </button>
      </div>

      {tab === 'overview' && (
        <div className="space-y-4">
          {/* Assess button */}
          <button
            onClick={handleLocateAndAssess}
            disabled={loading}
            className="w-full btn-primary py-2.5 text-sm"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                Assessing range...
              </span>
            ) : 'Assess My Range'}
          </button>

          {assessment && status && (
            <>
              {/* Status + Gauge */}
              <div className={`border rounded-xl p-5 ${status.bg}`}>
                <div className="flex items-center gap-2 mb-4">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${status.text} bg-white`}>
                    {status.icon}
                  </span>
                  <span className={`text-sm font-semibold ${status.text}`}>
                    Status: {status.label}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <RangeGauge range={assessment.range} batteryPct={assessment.range.batteryPct} />

                  <div className="flex-1 grid grid-cols-2 gap-3 w-full">
                    <div className="text-center p-3 bg-white rounded-lg">
                      <p className="text-xs text-gray-500">Base Range</p>
                      <p className="text-lg font-bold text-gray-900">{assessment.range.baseRangeKm} km</p>
                    </div>
                    <div className="text-center p-3 bg-white rounded-lg">
                      <p className="text-xs text-gray-500">Adjusted Range</p>
                      <p className="text-lg font-bold text-gray-900">{assessment.range.adjustedRangeKm} km</p>
                    </div>
                    <div className="text-center p-3 bg-white rounded-lg">
                      <p className="text-xs text-gray-500">Safe Range</p>
                      <p className="text-lg font-bold text-green-600">{assessment.range.safeRangeKm} km</p>
                    </div>
                    <div className="text-center p-3 bg-white rounded-lg">
                      <p className="text-xs text-gray-500">Stations In Range</p>
                      <p className="text-lg font-bold text-gray-900">{assessment.nearbyStations.length}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Alerts */}
              <AlertBanner alerts={assessment.alerts} />

              {/* Profile */}
              <ProfileEditor
                profile={assessment.profile}
                range={assessment.range}
                onUpdate={handleProfileUpdate}
              />

              {/* Nearby Stations */}
              {assessment.nearbyStations.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    Charging Stations Within Range ({assessment.nearbyStations.length})
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {assessment.nearbyStations.slice(0, 6).map((s) => (
                      <StationCard key={s.id} station={s} rangeKm={assessment.range.safeRangeKm} />
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Alerts */}
              {alertsQuery.data && alertsQuery.data.alerts.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-700">
                      Recent Alerts {unreadAlerts > 0 && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full ml-1">{unreadAlerts} new</span>}
                    </h3>
                    {unreadAlerts > 0 && (
                      <button onClick={() => markAllRead.mutate()} className="text-xs text-primary-600 hover:underline">
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {alertsQuery.data.alerts.slice(0, 5).map((alert) => {
                      const sev = alert.severity === 'critical' ? 'border-l-red-500'
                        : alert.severity === 'warning' ? 'border-l-yellow-500' : 'border-l-blue-500';
                      return (
                        <div key={alert.id} className={`border border-gray-200 border-l-4 ${sev} rounded-r-lg p-2 ${!alert.is_read ? 'bg-gray-50' : ''}`}>
                          <p className="text-xs font-medium text-gray-800">{alert.title}</p>
                          <p className="text-[10px] text-gray-500">{alert.message}</p>
                          <p className="text-[9px] text-gray-400 mt-0.5">{new Date(alert.created_at).toLocaleString()}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'trip' && <TripChecker />}
    </div>
  );
}

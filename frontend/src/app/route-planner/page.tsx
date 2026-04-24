'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import PageTransition from '@/components/ui/PageTransition';
import StationMap from '@/components/map/StationMap';
import LocationSearchInput from '@/components/route/LocationSearchInput';
import { usePlanRoute } from '@/hooks/useIntelligent';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useAuth } from '@/context/AuthContext';
import { useCountry } from '@/context/CountryContext';
import { formatCurrency } from '@/lib/formatCurrency';
import { useAuthAction } from '@/hooks/useAuthAction';
import AuthModal from '@/components/ui/AuthModal';
import toast from 'react-hot-toast';
import type { RoutePlan, Station } from '@/types';

interface LocationState {
  displayName: string;
  lat: number;
  lng: number;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function buildGoogleMapsUrl(plan: RoutePlan): string {
  const origin = `${plan.route.start.lat},${plan.route.start.lng}`;
  const dest = `${plan.route.end.lat},${plan.route.end.lng}`;
  const waypoints = plan.stops.map((s) => `${s.latitude},${s.longitude}`).join('|');
  const base = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}`;
  return waypoints ? `${base}&waypoints=${waypoints}` : base;
}

export default function RoutePlannerPage() {
  const router = useRouter();
  const { position } = useGeolocation();
  const { country } = useCountry();
  const { user } = useAuth();
  const { requireAuth, authModalProps } = useAuthAction();
  const planRoute = usePlanRoute();

  const [startLocation, setStartLocation] = useState<LocationState | null>(null);
  const [endLocation, setEndLocation] = useState<LocationState | null>(null);
  const [batteryPct, setBatteryPct] = useState('100');
  const [rangeKm, setRangeKm] = useState('400');
  const [capacityKwh, setCapacityKwh] = useState('60');
  const [plan, setPlan] = useState<RoutePlan | null>(null);

  const handleUseMyLocation = useCallback(() => {
    if (position) {
      setStartLocation({
        displayName: 'My Location',
        lat: position.latitude,
        lng: position.longitude,
      });
    }
  }, [position]);

  async function handlePlanRoute(e: React.FormEvent) {
    e.preventDefault();

    if (!startLocation || !endLocation) {
      toast.error('Set both start and destination');
      return;
    }

    const dlat = startLocation.lat - endLocation.lat;
    const dlng = startLocation.lng - endLocation.lng;
    if (Math.sqrt(dlat * dlat + dlng * dlng) < 0.01) {
      toast.error('Start and destination are too close');
      return;
    }

    try {
      const result = await planRoute.mutateAsync({
        startLat: startLocation.lat,
        startLng: startLocation.lng,
        endLat: endLocation.lat,
        endLng: endLocation.lng,
        batteryPercentage: parseFloat(batteryPct),
        vehicleRangeKm: parseFloat(rangeKm),
        vehicleBatteryCapacityKwh: parseFloat(capacityKwh),
      });
      setPlan(result);
      if (result.totalStops === 0) {
        toast.success("No charging needed — you'll arrive with battery to spare!");
      } else {
        toast.success(`Route planned with ${result.totalStops} charging stop(s)`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to plan route');
    }
  }

  const mapStations: Station[] = plan?.stops.map((s) => ({
    id: s.stationId,
    name: s.stationName,
    address: s.address,
    city: s.city,
    latitude: s.latitude,
    longitude: s.longitude,
    available_slots: s.availableSlots,
    total_slots: s.totalSlots,
    rating: s.rating,
    pricing_per_kwh: s.pricingPerKwh,
  })) as Station[] ?? [];

  const mapCenter = plan
    ? { lat: plan.route.start.lat, lng: plan.route.start.lng }
    : position
      ? { lat: position.latitude, lng: position.longitude }
      : country.defaultCenter;

  const routeLineData = plan ? plan.route : undefined;
  const canPlan = !!startLocation && !!endLocation;
  const isRealRouting = plan?.route?.provider && plan.route.provider !== 'haversine-fallback';

  return (
    <>
      <Navbar />
      <PageTransition>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* ── Page header ──────────────────────────────────── */}
        <div className="mb-6">
          <button onClick={() => router.back()} className="btn-ghost text-sm py-1 px-2 -ml-2 mb-2 flex items-center gap-1 text-theme-secondary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Back
          </button>
          <h1 className="text-2xl font-bold text-theme-primary mb-1">EV Route Planner</h1>
          <p className="text-sm text-theme-muted">Real-road routing with optimal charging stops</p>
        </div>

        {/* ── Main layout: Map (left) + Form (right) ─────── */}
        <div className="flex flex-col lg:flex-row gap-6">

          {/* ── Map container ────────────────────────────── */}
          <div className="lg:w-[65%] lg:flex-shrink-0">
            <div className="glass-heavy rounded-2xl overflow-hidden relative">
              <StationMap
                stations={mapStations}
                center={mapCenter}
                className="h-[280px] sm:h-[380px] lg:h-[520px]"
                currencySymbol={country.currencySymbol}
                startMarker={startLocation ? { lat: startLocation.lat, lng: startLocation.lng } : undefined}
                endMarker={endLocation ? { lat: endLocation.lat, lng: endLocation.lng } : undefined}
                routeLine={routeLineData}
              />
            </div>

            {/* Status chips below map */}
            <div className="mt-2 flex items-center gap-3 text-xs text-theme-muted flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${position ? 'bg-green-500' : 'bg-yellow-500'}`} />
                {position ? 'Using your location' : `Default (${country.name})`}
              </span>
              {plan && (
                <span className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${isRealRouting ? 'bg-blue-500' : 'bg-yellow-500'}`} />
                  {isRealRouting ? 'Road-based routing' : 'Approximate routing'}
                </span>
              )}
            </div>
          </div>

          {/* ── Right panel: form + results ─────────────────── */}
          <div className="lg:w-[35%] lg:max-h-[560px] lg:overflow-y-auto lg:scrollbar-hide space-y-4">
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Plan Your Trip</h2>
              <form onSubmit={handlePlanRoute} className="space-y-4">
                <LocationSearchInput
                  label="From"
                  placeholder="Start location"
                  icon="start"
                  value={startLocation}
                  onChange={(loc) => { setStartLocation(loc); setPlan(null); }}
                  onUseMyLocation={position ? handleUseMyLocation : undefined}
                />

                <LocationSearchInput
                  label="To"
                  placeholder="Where are you going?"
                  icon="end"
                  value={endLocation}
                  onChange={(loc) => { setEndLocation(loc); setPlan(null); }}
                />

                {/* Vehicle settings */}
                <div className="pt-2 border-t" style={{ borderColor: 'var(--border-default)' }}>
                  <p className="text-xs text-theme-muted uppercase tracking-wide font-medium mb-3">Vehicle Settings</p>
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-sm font-medium text-theme-secondary">Battery Level</label>
                        <span className="text-sm font-semibold tabular-nums text-primary-600">{batteryPct}%</span>
                      </div>
                      <input
                        type="range"
                        min="5"
                        max="100"
                        value={batteryPct}
                        onChange={(e) => { setBatteryPct(e.target.value); setPlan(null); }}
                        className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-primary-600" style={{ background: 'var(--border-default)' }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-theme-secondary mb-1">Range (km)</label>
                        <input
                          type="number"
                          className="input text-sm"
                          min="50"
                          max="1000"
                          value={rangeKm}
                          onChange={(e) => setRangeKm(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-theme-secondary mb-1">Capacity (kWh)</label>
                        <input
                          type="number"
                          className="input text-sm"
                          min="10"
                          max="200"
                          value={capacityKwh}
                          onChange={(e) => setCapacityKwh(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn-primary w-full"
                  disabled={planRoute.isPending || !canPlan}
                >
                  {planRoute.isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Planning...
                    </span>
                  ) : !canPlan ? 'Enter start & destination' : 'Plan Route'}
                </button>
              </form>
            </div>

            {/* ── Route results ──────────────────────────────── */}
            {plan && (
              <div className="space-y-4 animate-in">

                {/* Fallback warning */}
                {!isRealRouting && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 flex items-center gap-2 text-sm">
                    <svg className="w-5 h-5 text-yellow-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="text-yellow-700 dark:text-yellow-400">Live road routing unavailable — showing approximate route</span>
                  </div>
                )}

                {/* Route summary card */}
                <div className="card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {isRealRouting && (
                        <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs font-medium px-2 py-0.5 rounded-full">
                          Fastest Route
                        </span>
                      )}
                    </div>
                    <a
                      href={buildGoogleMapsUrl(plan)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1"
                    >
                      Open in Maps
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <div>
                      <p className="text-xs text-theme-muted">Distance</p>
                      <p className="text-xl font-bold text-primary-600 tabular-nums">{plan.totalDistanceKm} km</p>
                    </div>
                    <div>
                      <p className="text-xs text-theme-muted">Total Time</p>
                      <p className="text-xl font-bold text-blue-600 tabular-nums">
                        {plan.totalDurationMin ? formatDuration(plan.totalDurationMin) : '—'}
                      </p>
                      {plan.totalDrivingMin && plan.totalStops > 0 && (
                        <p className="text-xs text-theme-muted">
                          {formatDuration(plan.totalDrivingMin)} driving + {formatDuration(plan.estimatedTotalChargingMin)} charging
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-theme-muted">Charging Stops</p>
                      <p className="text-xl font-bold text-accent-600 tabular-nums">{plan.totalStops}</p>
                    </div>
                    <div>
                      <p className="text-xs text-theme-muted">Est. Cost</p>
                      <p className="text-xl font-bold text-green-500 tabular-nums">{formatCurrency(plan.estimatedTotalCost, country)}</p>
                    </div>
                  </div>
                </div>

                {/* Charging stops */}
                {plan.stops.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-theme-secondary mb-3">Charging Stops</h3>
                    <div className="space-y-3">
                      {plan.stops.map((stop) => (
                        <div key={stop.stopNumber} className="card py-4 px-5 border-l-4 border-l-primary-500">
                          <div className="flex justify-between items-start gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="bg-primary-100 text-primary-700 text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0">
                                  {stop.stopNumber}
                                </span>
                                <h4 className="font-semibold text-sm truncate">{stop.stationName}</h4>
                              </div>
                              <p className="text-xs text-theme-muted ml-8">{stop.address}, {stop.city}</p>
                              <div className="flex flex-wrap gap-2 mt-2 ml-8 text-xs text-theme-muted">
                                <span>{stop.distanceFromPrevKm} km from prev</span>
                                <span>{stop.chargingSpeedKw} kW</span>
                                <span className={stop.availableSlots > 0 ? 'text-green-600' : 'text-red-500'}>
                                  {stop.availableSlots}/{stop.totalSlots} slots
                                </span>
                                {stop.detourKm !== undefined && stop.detourKm > 0.5 && (
                                  <span className="text-yellow-600">+{stop.detourKm} km detour</span>
                                )}
                              </div>
                            </div>
                            <div className="text-right text-xs flex-shrink-0">
                              <p className="font-semibold text-sm">{stop.estimatedChargingMin} min</p>
                              {stop.estimatedWaitMin > 0 && (
                                <p className="text-yellow-600">+{stop.estimatedWaitMin} min wait</p>
                              )}
                              <p className="text-green-500 font-medium">{formatCurrency(stop.estimatedCost, country)}</p>
                            </div>
                          </div>
                          <div className="mt-3 ml-8 flex items-center gap-2 text-xs">
                            <span className="text-theme-muted tabular-nums">{stop.arrivalBatteryPct}%</span>
                            <div className="flex-1 rounded-full h-2 relative" style={{ background: 'var(--border-default)' }}>
                              <div
                                className="absolute inset-y-0 left-0 bg-yellow-400 rounded-full"
                                style={{ width: `${stop.departureBatteryPct}%` }}
                              />
                              <div
                                className="absolute inset-y-0 left-0 bg-red-300 rounded-full"
                                style={{ width: `${stop.arrivalBatteryPct}%` }}
                              />
                            </div>
                            <span className="text-primary-600 font-medium tabular-nums">{stop.departureBatteryPct}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Arrival banner */}
                {plan.arrivalBatteryPct > 0 && (
                  <div className="bg-green-500/10 border rounded-xl p-4 flex items-center gap-3" style={{ borderColor: 'var(--border-default)' }}>
                    <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-green-500">Arrive with {plan.arrivalBatteryPct}% battery</p>
                      {plan.totalStops === 0 && (
                        <p className="text-sm text-green-500">No charging stops needed!</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Start Journey button */}
                <button
                  onClick={() => requireAuth(() => window.open(buildGoogleMapsUrl(plan), '_blank'))}
                  className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  Start Journey
                </button>
              </div>
            )}

            {/* Empty state */}
            {!plan && !planRoute.isPending && (
              <div className="card text-center py-8 text-theme-muted">
                <svg className="w-10 h-10 mx-auto mb-3 text-theme-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                <p className="text-sm">Enter your trip details to get a route<br />with optimal charging stops</p>
              </div>
            )}
          </div>
        </div>
      </main>
      </PageTransition>
      <AuthModal {...authModalProps} />
    </>
  );
}

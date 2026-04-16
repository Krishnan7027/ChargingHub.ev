'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Navbar from '@/components/layout/Navbar';
import PageTransition from '@/components/ui/PageTransition';
import SlotGrid from '@/components/stations/SlotGrid';
import PredictionBanner from '@/components/stations/PredictionBanner';
import DemandForecastPanel from '@/components/stations/DemandForecastPanel';
import PricingPanel from '@/components/stations/PricingPanel';
import BatteryDigitalTwinPanel from '@/components/energy/BatteryDigitalTwinPanel';
import CongestionPredictionPanel from '@/components/energy/CongestionPredictionPanel';
import GridLoadPanel from '@/components/energy/GridLoadPanel';
import CarbonFootprintPanel from '@/components/energy/CarbonFootprintPanel';
import SmartSlotAllocation from '@/components/stations/SmartSlotAllocation';
import Modal from '@/components/ui/Modal';
import { useAuth } from '@/context/AuthContext';
import { useCountry } from '@/context/CountryContext';
import { formatPricePerKwh } from '@/lib/formatCurrency';
import { getReturnAction, clearReturnAction, buildDirectionsUrl } from '@/lib/navigationFlow';
import { useAuthAction } from '@/hooks/useAuthAction';
import AuthModal from '@/components/ui/AuthModal';
import { useStation, useCreateReservation } from '@/hooks/useStations';
import { useSocket } from '@/hooks/useSocket';
import { subscribeToStation, unsubscribeFromStation } from '@/lib/socket';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ChargingSlot } from '@/types';

function DetailSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 animate-pulse">
      <div className="h-4 bg-[var(--border-default)] rounded w-16 mb-4" />
      <div className="h-8 bg-[var(--border-default)] rounded w-72 mb-2" />
      <div className="h-4 bg-[var(--border-default)] rounded w-48 mb-8" />
      <div className="h-24 bg-[var(--border-default)] rounded-2xl mb-6" />
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {[1, 2, 3].map((i) => <div key={i} className="h-28 bg-[var(--border-default)] rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-36 bg-[var(--border-default)] rounded-xl" />)}
      </div>
    </div>
  );
}

export default function StationDetailPage() {
  const { country } = useCountry();
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { on } = useSocket();
  const stationId = params.id as string;

  const { data: station, isLoading, error } = useStation(stationId);
  const createReservation = useCreateReservation();
  const { requireAuth, authModalProps } = useAuthAction();

  const [selectedSlot, setSelectedSlot] = useState<ChargingSlot | null>(null);
  const [reserveForm, setReserveForm] = useState({ start: '', end: '' });
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleAiSlotSelect = (slotId: string) => {
    const slot = station?.slots?.find((s) => s.id === slotId);
    if (slot) {
      setSelectedSlot(slot);
      const now = new Date();
      const end = new Date(now.getTime() + 3600000);
      const fmt = (d: Date) => d.toISOString().slice(0, 16);
      setReserveForm({ start: fmt(now), end: fmt(end) });
    }
  };

  useEffect(() => {
    subscribeToStation(stationId);
    return () => unsubscribeFromStation(stationId);
  }, [stationId]);

  useEffect(() => {
    const invalidatePredictions = () => {
      queryClient.invalidateQueries({ queryKey: ['smart-prediction', stationId] });
      queryClient.invalidateQueries({ queryKey: ['station', stationId, 'predictions'] });
    };

    const cleanups = [
      on('slot:statusChanged', () => {
        queryClient.invalidateQueries({ queryKey: ['station', stationId] });
        invalidatePredictions();
      }),
      on('slot:updated', () => {
        queryClient.invalidateQueries({ queryKey: ['station', stationId] });
        queryClient.invalidateQueries({ queryKey: ['twin', 'station', stationId] });
        invalidatePredictions();
      }),
      on('twin:updated', () => {
        queryClient.invalidateQueries({ queryKey: ['twin', 'station', stationId] });
      }),
      on('congestion:updated', () => {
        queryClient.invalidateQueries({ queryKey: ['congestion', stationId] });
      }),
      on('grid:alert', () => {
        queryClient.invalidateQueries({ queryKey: ['grid-load', stationId] });
      }),
      on('queue:updated', () => {
        queryClient.invalidateQueries({ queryKey: ['allocation', stationId] });
      }),
      on('reservation:changed', () => {
        queryClient.invalidateQueries({ queryKey: ['station', stationId] });
        invalidatePredictions();
      }),
    ];
    return () => cleanups.forEach((fn) => fn());
  }, [on, stationId, queryClient]);

  // Auto-trigger action after login redirect (e.g., directions)
  useEffect(() => {
    if (!station || !user) return;
    const returnAction = getReturnAction();
    if (returnAction?.action === 'directions' && returnAction.returnTo.includes(stationId)) {
      clearReturnAction();
      const url = buildDirectionsUrl(station.latitude, station.longitude);
      window.open(url, '_blank');
    }
  }, [station, user, stationId]);

  function handleDirections() {
    if (!station) return;
    requireAuth(() => {
      window.open(buildDirectionsUrl(station.latitude, station.longitude), '_blank');
    });
  }

  async function handleReserve() {
    if (!selectedSlot || !reserveForm.start || !reserveForm.end || !user) return;
    try {
      await createReservation.mutateAsync({
        slotId: selectedSlot.id,
        stationId,
        scheduledStart: new Date(reserveForm.start).toISOString(),
        scheduledEnd: new Date(reserveForm.end).toISOString(),
      });
      toast.success('Reservation created successfully!');
      setSelectedSlot(null);
      setReserveForm({ start: '', end: '' });
    } catch (err: any) {
      toast.error(err.message || 'Failed to create reservation');
    }
  }

  if (isLoading) {
    return (
      <>
        <Navbar />
        <DetailSkeleton />
      </>
    );
  }

  if (error || !station) {
    return (
      <>
        <Navbar />
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
          <div className="w-16 h-16 glass rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-theme-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-theme-primary mb-1">Station not found</h2>
          <p className="text-theme-secondary mb-4">This station may have been removed or doesn&apos;t exist.</p>
          <button onClick={() => router.push('/map')} className="btn-primary">
            Browse stations
          </button>
        </div>
      </>
    );
  }

  const available = station.available_slots ?? 0;
  const total = station.total_slots ?? 0;

  return (
    <>
      <Navbar />
      <PageTransition>
      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8 animate-in">
        {/* Header */}
        <div className="mb-6">
          <button onClick={() => router.back()} className="btn-ghost text-sm py-1 px-2 -ml-2 mb-2 flex items-center gap-1 text-theme-secondary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-theme-primary">{station.name}</h1>
              <p className="text-theme-secondary mt-1 flex items-center gap-1.5">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
                {station.address}, {station.city}{station.state ? `, ${station.state}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {station.rating > 0 && (
                <div className="flex items-center gap-1 bg-yellow-500/10 px-2.5 py-1 rounded-lg">
                  <svg className="w-4 h-4 text-yellow-500 fill-current" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="font-semibold text-sm">{Number(station.rating).toFixed(1)}</span>
                </div>
              )}
              {station.pricing_per_kwh && (
                <span className="badge-blue text-sm">{formatPricePerKwh(station.pricing_per_kwh, country)}</span>
              )}
              <button
                onClick={handleDirections}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-500 hover:text-primary-400 bg-primary-500/10 hover:bg-primary-500/15 rounded-xl px-3 py-1.5 transition-colors"
                title={user ? 'Open in Google Maps' : 'Sign up to get directions'}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Directions
              </button>
            </div>
          </div>
        </div>

        {/* Prediction Banner */}
        <div className="mb-6">
          <PredictionBanner stationId={stationId} />
        </div>

        {/* Quick Info Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mb-8">
          <div className="card py-4 px-5">
            <p className="text-xs text-theme-secondary uppercase tracking-wide font-medium">Hours</p>
            {station.operating_hours?.type === 'SCHEDULED' && station.operating_hours.schedule ? (
              <>
                <p className="text-sm font-semibold mt-1 text-green-600">Scheduled</p>
                <div className="text-xs text-theme-secondary mt-0.5 space-y-0.5">
                  {Object.entries(station.operating_hours.schedule).slice(0, 3).map(([day, times]: [string, any]) => (
                    <p key={day}><span className="uppercase font-medium">{day}</span> {times.open}–{times.close}</p>
                  ))}
                  {Object.keys(station.operating_hours.schedule).length > 3 && (
                    <p className="text-theme-muted">+{Object.keys(station.operating_hours.schedule).length - 3} more</p>
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="text-lg font-semibold mt-1 text-green-600">24/7</p>
                <p className="text-xs text-theme-muted">Always Open</p>
              </>
            )}
          </div>
          <div className="card py-4 px-5">
            <p className="text-xs text-theme-secondary uppercase tracking-wide font-medium">Availability</p>
            <p className="text-lg font-semibold mt-1">
              <span className={available > 0 ? 'text-green-600' : 'text-red-500'}>{available}</span>
              <span className="text-theme-muted font-normal"> / {total}</span>
            </p>
            <p className="text-xs text-theme-muted">{available > 0 ? 'Slots open' : 'All occupied'}</p>
          </div>
          <div className="card py-4 px-5 col-span-2 md:col-span-1">
            <p className="text-xs text-theme-secondary uppercase tracking-wide font-medium">Amenities</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {station.amenities?.length ? station.amenities.map((a) => (
                <span key={a} className="badge-gray capitalize">{a}</span>
              )) : (
                <span className="text-xs text-theme-muted">None listed</span>
              )}
            </div>
          </div>
        </div>

        {station.description && (
          <p className="text-theme-secondary mb-8 leading-relaxed">{station.description}</p>
        )}

        {/* Smart Slot Allocation */}
        {user && (
          <div className="mb-8">
            <SmartSlotAllocation stationId={stationId} onSlotSelected={handleAiSlotSelect} />
          </div>
        )}

        {/* Charging Slots */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">Charging Slots</h2>
          {station.slots && station.slots.length > 0 ? (
            <SlotGrid
              slots={station.slots}
              selectable={!!user}
              onSelect={(slot) => {
                setSelectedSlot(slot);
                const now = new Date();
                const end = new Date(now.getTime() + 3600000);
                const fmt = (d: Date) => d.toISOString().slice(0, 16);
                setReserveForm({ start: fmt(now), end: fmt(end) });
              }}
            />
          ) : (
            <div className="card text-center py-8 text-theme-secondary">
              No slots configured yet.
            </div>
          )}
        </div>

        {/* Advanced Panels — Collapsible */}
        <div className="mb-8">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm font-medium text-theme-secondary hover:text-theme-secondary transition-colors mb-4"
          >
            <svg className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {showAdvanced ? 'Hide' : 'Show'} advanced analytics
          </button>

          {showAdvanced && (
            <div className="space-y-6 animate-in">
              <div className="grid md:grid-cols-2 gap-6">
                <PricingPanel stationId={stationId} />
                <DemandForecastPanel stationId={stationId} />
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <BatteryDigitalTwinPanel stationId={stationId} />
                <GridLoadPanel stationId={stationId} />
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <CongestionPredictionPanel stationId={stationId} />
                <CarbonFootprintPanel stationId={stationId} />
              </div>
            </div>
          )}
        </div>

        {/* Reservation Modal */}
        <Modal
          open={!!selectedSlot && !!user}
          onClose={() => { setSelectedSlot(null); setReserveForm({ start: '', end: '' }); }}
          title={`Reserve Slot #${selectedSlot?.slot_number ?? ''}`}
        >
          {selectedSlot && (
            <div className="space-y-5">
              {/* Slot summary */}
              <div className="flex items-center gap-3 p-3 bg-theme-secondary rounded-xl">
                <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                  <span className="text-lg font-bold text-primary-700">#{selectedSlot.slot_number}</span>
                </div>
                <div>
                  <p className="font-medium text-theme-primary">
                    {selectedSlot.charging_type.replace('_', ' ')} &middot; {selectedSlot.power_output_kw} kW
                  </p>
                  <p className="text-sm text-theme-secondary">{selectedSlot.connector_type.toUpperCase()} connector</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-theme-secondary mb-1.5">Start Time</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={reserveForm.start}
                  onChange={(e) => setReserveForm((prev) => ({ ...prev, start: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-secondary mb-1.5">End Time</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={reserveForm.end}
                  onChange={(e) => setReserveForm((prev) => ({ ...prev, end: e.target.value }))}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleReserve}
                  className="btn-primary flex-1"
                  disabled={createReservation.isPending || !reserveForm.start || !reserveForm.end}
                >
                  {createReservation.isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Reserving...
                    </span>
                  ) : 'Confirm Reservation'}
                </button>
                <button
                  onClick={() => { setSelectedSlot(null); setReserveForm({ start: '', end: '' }); }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </Modal>

        <AuthModal {...authModalProps} />
      </div>
      </PageTransition>
    </>
  );
}

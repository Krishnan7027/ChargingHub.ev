'use client';

import { useState } from 'react';
import Navbar from '@/components/layout/Navbar';
import StatusBadge from '@/components/ui/StatusBadge';
import ProtectedRoute from '@/components/ui/ProtectedRoute';
import EmptyState from '@/components/ui/EmptyState';
import { useMyReservations, useCancelReservation } from '@/hooks/useStations';
import toast from 'react-hot-toast';

export default function ReservationsPage() {
  const [filter, setFilter] = useState('all');
  const params = filter !== 'all' ? { status: filter } : undefined;
  const { data: reservations, isLoading } = useMyReservations(params);
  const cancelReservation = useCancelReservation();

  async function handleCancel(id: string) {
    try {
      await cancelReservation.mutateAsync(id);
      toast.success('Reservation cancelled');
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel');
    }
  }

  return (
    <ProtectedRoute>
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">My Reservations</h1>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {['all', 'confirmed', 'active', 'completed', 'cancelled'].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filter === s ? 'bg-primary-600 text-white' : 'glass text-theme-secondary hover:bg-primary-500/10'
              }`}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="card h-28 animate-pulse" />)}
          </div>
        ) : !reservations || reservations.length === 0 ? (
          <EmptyState title="No reservations found" description="Find a station on the map to make your first reservation." />
        ) : (
          <div className="space-y-3">
            {reservations.map((res) => (
              <div key={res.id} className="card">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold">{res.station_name}</h3>
                    <p className="text-sm text-theme-muted">{res.station_address}</p>
                    <div className="flex gap-3 mt-2 text-sm text-theme-secondary">
                      <span>Slot #{res.slot_number}</span>
                      <span>{res.charging_type?.replace('_', ' ')}</span>
                    </div>
                    <p className="text-sm text-theme-muted mt-1">
                      {new Date(res.scheduled_start).toLocaleString()} - {new Date(res.scheduled_end).toLocaleString()}
                    </p>
                  </div>
                  <StatusBadge status={res.status} />
                </div>
                {['pending', 'confirmed'].includes(res.status) && (
                  <button
                    onClick={() => handleCancel(res.id)}
                    disabled={cancelReservation.isPending}
                    className="mt-3 text-sm text-red-600 hover:text-red-700"
                  >
                    Cancel reservation
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}

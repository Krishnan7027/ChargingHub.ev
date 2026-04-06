'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { stationApi, slotApi, reservationApi, chargingApi } from '@/lib/api';

// ── Station queries ────────────────────────────────────────
export function useNearbyStations(lat: number | null, lng: number | null, radiusKm = 25) {
  return useQuery({
    queryKey: ['stations', 'nearby', lat, lng, radiusKm],
    queryFn: () => stationApi.getNearby(lat!, lng!, radiusKm),
    enabled: lat !== null && lng !== null,
    staleTime: 30_000,
  });
}

export function useSearchStations(params: Record<string, string>) {
  return useQuery({
    queryKey: ['stations', 'search', params],
    queryFn: () => stationApi.search(params),
    enabled: Object.values(params).some((v) => v.length > 0),
    staleTime: 30_000,
  });
}

export function useStation(id: string) {
  return useQuery({
    queryKey: ['station', id],
    queryFn: () => stationApi.getById(id),
    enabled: !!id,
    staleTime: 10_000,
  });
}

export function useManagerStations() {
  return useQuery({
    queryKey: ['stations', 'manager'],
    queryFn: () => stationApi.getManagerStations(),
    staleTime: 15_000,
  });
}

export function useStationPrediction(id: string) {
  return useQuery({
    queryKey: ['station', id, 'predictions'],
    queryFn: () => stationApi.getPredictions(id),
    enabled: !!id,
    refetchInterval: 30_000,
  });
}

// ── Station mutations ──────────────────────────────────────
export function useCreateStation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: stationApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stations'] }),
  });
}

export function useUpdateStation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<any> }) => stationApi.update(id, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['station', vars.id] });
      qc.invalidateQueries({ queryKey: ['stations'] });
    },
  });
}

// ── Slot mutations ─────────────────────────────────────────
export function useAddSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ stationId, data }: { stationId: string; data: any }) => slotApi.add(stationId, data),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['station', vars.stationId] }),
  });
}

export function useUpdateSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ stationId, slotId, data }: { stationId: string; slotId: string; data: any }) =>
      slotApi.update(stationId, slotId, data),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['station', vars.stationId] }),
  });
}

export function useDeleteSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ stationId, slotId }: { stationId: string; slotId: string }) =>
      slotApi.remove(stationId, slotId),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['station', vars.stationId] }),
  });
}

// ── Reservations ───────────────────────────────────────────
export function useMyReservations(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['reservations', 'my', params],
    queryFn: () => reservationApi.getMy(params),
    staleTime: 10_000,
  });
}

export function useStationReservations(stationId: string) {
  return useQuery({
    queryKey: ['reservations', 'station', stationId],
    queryFn: () => reservationApi.getByStation(stationId),
    enabled: !!stationId,
    staleTime: 10_000,
  });
}

export function useCreateReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: reservationApi.create,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['reservations'] });
      qc.invalidateQueries({ queryKey: ['station', res.station_id] });
    },
  });
}

export function useCancelReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: reservationApi.cancel,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservations'] });
      qc.invalidateQueries({ queryKey: ['stations'] });
    },
  });
}

// ── Charging ───────────────────────────────────────────────
export function useActiveSessions() {
  return useQuery({
    queryKey: ['charging', 'active'],
    queryFn: () => chargingApi.getActive(),
    refetchInterval: 15_000,
  });
}

export function useStartCharging() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: chargingApi.start,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['charging'] });
      qc.invalidateQueries({ queryKey: ['stations'] });
    },
  });
}

export function useCompleteCharging() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: chargingApi.complete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['charging'] });
      qc.invalidateQueries({ queryKey: ['stations'] });
    },
  });
}

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, stationApi } from '@/lib/api';

export function usePlatformStats() {
  return useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => adminApi.getStats(),
    refetchInterval: 30_000,
  });
}

export function useAdminUsers(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['admin', 'users', params],
    queryFn: () => adminApi.getUsers(params),
    staleTime: 10_000,
  });
}

export function useAdminStations(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['admin', 'stations', params],
    queryFn: () => adminApi.getStations(params),
    staleTime: 10_000,
  });
}

export function useToggleUserStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: adminApi.toggleUserStatus,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });
}

export function useApproveStation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: stationApi.approve,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'stations'] });
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });
}

export function useRejectStation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: stationApi.reject,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'stations'] });
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });
}

export function useDisableStation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: stationApi.disable,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'stations'] });
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });
}

export function useAuditLogs(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['admin', 'audit-logs', params],
    queryFn: () => adminApi.getAuditLogs(params),
    staleTime: 15_000,
  });
}

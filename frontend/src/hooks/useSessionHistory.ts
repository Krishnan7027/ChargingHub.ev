'use client';

import { useQuery } from '@tanstack/react-query';
import { sessionHistoryApi } from '@/lib/api';
import type { SessionHistoryFilters } from '@/types';

export function useSessionHistory(filters?: SessionHistoryFilters) {
  return useQuery({
    queryKey: ['session-history', filters],
    queryFn: () => sessionHistoryApi.list(filters),
    staleTime: 30_000,
  });
}

export function useSessionDetail(sessionId: string) {
  return useQuery({
    queryKey: ['session-history', sessionId],
    queryFn: () => sessionHistoryApi.getDetail(sessionId),
    enabled: !!sessionId,
    staleTime: 60_000,
  });
}

export function useSessionStats() {
  return useQuery({
    queryKey: ['session-stats'],
    queryFn: sessionHistoryApi.getStats,
    staleTime: 60_000,
  });
}

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { favoriteApi } from '@/lib/api';

export function useFavorites() {
  return useQuery({
    queryKey: ['favorites'],
    queryFn: favoriteApi.list,
    staleTime: 30_000,
  });
}

export function useFavoriteStatus(stationId: string) {
  return useQuery({
    queryKey: ['favorite-status', stationId],
    queryFn: () => favoriteApi.getStatus(stationId),
    enabled: !!stationId,
    staleTime: 30_000,
  });
}

export function useToggleFavorite() {
  const qc = useQueryClient();

  const addMutation = useMutation({
    mutationFn: favoriteApi.add,
    onSuccess: (_data, stationId) => {
      qc.invalidateQueries({ queryKey: ['favorites'] });
      qc.invalidateQueries({ queryKey: ['favorite-status', stationId] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: favoriteApi.remove,
    onSuccess: (_data, stationId) => {
      qc.invalidateQueries({ queryKey: ['favorites'] });
      qc.invalidateQueries({ queryKey: ['favorite-status', stationId] });
    },
  });

  return {
    add: addMutation,
    remove: removeMutation,
    toggle: (stationId: string, isFavorited: boolean) => {
      if (isFavorited) {
        removeMutation.mutate(stationId);
      } else {
        addMutation.mutate(stationId);
      }
    },
    isLoading: addMutation.isPending || removeMutation.isPending,
  };
}

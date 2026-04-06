'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { routePlannerApi, intelligentApi, mobilityApi, batteryHealthApi, schedulingApi, rangeSafetyApi, reviewApi, gamificationApi, paymentApi } from '@/lib/api';
import type { CreateReviewData } from '@/types';
import type { RoutePlanRequest } from '@/types';

// ── Route Planner ─────────────────────────────────────────
export function usePlanRoute() {
  return useMutation({
    mutationFn: (data: RoutePlanRequest) => routePlannerApi.plan(data),
  });
}

export function useSaveRoutePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: routePlannerApi.save,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['route-plans'] }),
  });
}

export function useMyRoutePlans() {
  return useQuery({
    queryKey: ['route-plans'],
    queryFn: () => routePlannerApi.getMyPlans(),
  });
}

// ── Smart Predictions ─────────────────────────────────────
export function useSmartPrediction(stationId: string) {
  return useQuery({
    queryKey: ['smart-prediction', stationId],
    queryFn: () => intelligentApi.getSmartPrediction(stationId),
    enabled: !!stationId,
    refetchInterval: 30_000,
  });
}

// ── Demand Forecasting ────────────────────────────────────
export function useDemandForecast(stationId: string, day?: number) {
  return useQuery({
    queryKey: ['demand-forecast', stationId, day],
    queryFn: () => intelligentApi.getDemandForecast(stationId, day),
    enabled: !!stationId,
    staleTime: 60_000,
  });
}

export function useTodayDemand(stationId: string) {
  return useQuery({
    queryKey: ['demand-today', stationId],
    queryFn: () => intelligentApi.getTodayDemand(stationId),
    enabled: !!stationId,
    staleTime: 60_000,
  });
}

// ── Recommendations ───────────────────────────────────────
export function useRecommendations(params: {
  latitude: number | null;
  longitude: number | null;
  radiusKm?: number;
  chargingType?: string;
}) {
  return useQuery({
    queryKey: ['recommendations', params],
    queryFn: () =>
      intelligentApi.getRecommendations({
        latitude: params.latitude!,
        longitude: params.longitude!,
        radiusKm: params.radiusKm,
        chargingType: params.chargingType,
      }),
    enabled: params.latitude !== null && params.longitude !== null,
    staleTime: 30_000,
  });
}

// ── Dynamic Pricing ───────────────────────────────────────
export function usePricingSchedule(stationId: string) {
  return useQuery({
    queryKey: ['pricing', stationId],
    queryFn: () => intelligentApi.getPricingSchedule(stationId),
    enabled: !!stationId,
  });
}

export function useCurrentPrice(stationId: string) {
  return useQuery({
    queryKey: ['pricing', stationId, 'current'],
    queryFn: () => intelligentApi.getCurrentPrice(stationId),
    enabled: !!stationId,
    refetchInterval: 60_000,
  });
}

export function useCostEstimate(stationId: string, energyKwh: number) {
  return useQuery({
    queryKey: ['pricing', stationId, 'estimate', energyKwh],
    queryFn: () => intelligentApi.estimateCost(stationId, energyKwh),
    enabled: !!stationId && energyKwh > 0,
  });
}

export function useCreatePricingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ stationId, data }: { stationId: string; data: any }) =>
      intelligentApi.createPricingRule(stationId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pricing'] }),
  });
}

export function useDeletePricingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: intelligentApi.deletePricingRule,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pricing'] }),
  });
}

// ── Analytics ─────────────────────────────────────────────
export function usePlatformAnalytics(params?: { startDate?: string; endDate?: string; period?: string }) {
  return useQuery({
    queryKey: ['analytics', 'platform', params],
    queryFn: () => intelligentApi.getPlatformAnalytics(params),
    staleTime: 60_000,
  });
}

export function useStationAnalytics(stationId: string, params?: { startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: ['analytics', 'station', stationId, params],
    queryFn: () => intelligentApi.getStationAnalytics(stationId, params),
    enabled: !!stationId,
    staleTime: 60_000,
  });
}

// ── Battery Digital Twin ─────────────────────────────────────
export function useTwinBySession(sessionId: string) {
  return useQuery({
    queryKey: ['twin', 'session', sessionId],
    queryFn: () => intelligentApi.getTwinBySession(sessionId),
    enabled: !!sessionId,
    refetchInterval: 10_000,
  });
}

export function useStationTwins(stationId: string) {
  return useQuery({
    queryKey: ['twin', 'station', stationId],
    queryFn: () => intelligentApi.getStationTwins(stationId),
    enabled: !!stationId,
    refetchInterval: 15_000,
  });
}

export function useSimulateTwinStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => intelligentApi.simulateTwinStep(sessionId),
    onSuccess: (_, sessionId) => {
      qc.invalidateQueries({ queryKey: ['twin', 'session', sessionId] });
      qc.invalidateQueries({ queryKey: ['twin', 'station'] });
    },
  });
}

// ── Congestion Prediction ────────────────────────────────────
export function useCongestionPredictions(stationId: string, hours?: number) {
  return useQuery({
    queryKey: ['congestion', stationId, hours],
    queryFn: () => intelligentApi.getCongestionPredictions(stationId, hours),
    enabled: !!stationId,
    staleTime: 300_000, // 5 min
  });
}

// ── Grid Load Balancing ──────────────────────────────────────
export function useGridLoad(stationId: string) {
  return useQuery({
    queryKey: ['grid-load', stationId],
    queryFn: () => intelligentApi.getGridLoad(stationId),
    enabled: !!stationId,
    refetchInterval: 30_000,
  });
}

export function useUpdateGridSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ stationId, data }: { stationId: string; data: { gridCapacityKw?: number; warningThresholdPct?: number; criticalThresholdPct?: number } }) =>
      intelligentApi.updateGridSettings(stationId, data),
    onSuccess: (_, { stationId }) => qc.invalidateQueries({ queryKey: ['grid-load', stationId] }),
  });
}

// ── Carbon Footprint ─────────────────────────────────────────
export function useUserCarbon() {
  return useQuery({
    queryKey: ['carbon', 'me'],
    queryFn: () => intelligentApi.getUserCarbon(),
    staleTime: 60_000,
  });
}

export function useStationCarbon(stationId: string, params?: { startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: ['carbon', 'station', stationId, params],
    queryFn: () => intelligentApi.getStationCarbon(stationId, params),
    enabled: !!stationId,
    staleTime: 60_000,
  });
}

export function usePlatformCarbon() {
  return useQuery({
    queryKey: ['carbon', 'platform'],
    queryFn: () => intelligentApi.getPlatformCarbon(),
    staleTime: 60_000,
  });
}

// ── Energy Optimization ──────────────────────────────────────
export function useStationOptimizations(stationId: string) {
  return useQuery({
    queryKey: ['optimization', stationId],
    queryFn: () => intelligentApi.getOptimizationRecs(stationId),
    enabled: !!stationId,
    staleTime: 300_000,
  });
}

export function usePlatformOptimization() {
  return useQuery({
    queryKey: ['optimization', 'platform'],
    queryFn: () => intelligentApi.getPlatformOptimization(),
    staleTime: 60_000,
  });
}

export function useGenerateOptimizations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (stationId: string) => intelligentApi.generateOptimizations(stationId),
    onSuccess: (_, stationId) => qc.invalidateQueries({ queryKey: ['optimization', stationId] }),
  });
}

export function useUpdateOptimizationRec() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ recId, status }: { recId: string; status: 'accepted' | 'rejected' }) =>
      intelligentApi.updateOptimizationRec(recId, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['optimization'] }),
  });
}

// ── Autonomous Slot Allocation ───────────────────────────────
export function useSlotAllocation(stationId: string, params: {
  batteryPercentage: number | null;
  targetPercentage?: number;
  batteryCapacityKwh?: number;
  connectorType?: string;
  chargingType?: string;
}) {
  return useQuery({
    queryKey: ['allocation', stationId, params],
    queryFn: () => intelligentApi.recommendSlot(stationId, {
      batteryPercentage: params.batteryPercentage!,
      targetPercentage: params.targetPercentage,
      batteryCapacityKwh: params.batteryCapacityKwh,
      connectorType: params.connectorType,
      chargingType: params.chargingType,
    }),
    enabled: !!stationId && params.batteryPercentage !== null,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useJoinQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ stationId, data }: { stationId: string; data: {
      batteryPercentage: number; targetPercentage?: number;
      batteryCapacityKwh?: number; connectorType?: string; chargingType?: string;
    }}) => intelligentApi.joinQueue(stationId, data),
    onSuccess: (_, { stationId }) => {
      qc.invalidateQueries({ queryKey: ['allocation', stationId] });
    },
  });
}

export function useLeaveQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (stationId: string) => intelligentApi.leaveQueue(stationId),
    onSuccess: (_, stationId) => {
      qc.invalidateQueries({ queryKey: ['allocation', stationId] });
    },
  });
}

// ── Mobility Intelligence ─────────────────────────────────────

export function useHeatmapData(params?: { minLat?: number; maxLat?: number; minLng?: number; maxLng?: number; periodStart?: string; periodEnd?: string }) {
  return useQuery({
    queryKey: ['mobility', 'heatmap', params],
    queryFn: () => mobilityApi.getHeatmapData(params),
    staleTime: 120_000,
  });
}

export function useBehaviorStats(params?: { city?: string; startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: ['mobility', 'behavior', params],
    queryFn: () => mobilityApi.getBehaviorStats(params),
    staleTime: 120_000,
  });
}

export function useCityTrends(params?: { city?: string; startMonth?: string; endMonth?: string }) {
  return useQuery({
    queryKey: ['mobility', 'trends', params],
    queryFn: () => mobilityApi.getCityTrends(params),
    staleTime: 120_000,
  });
}

export function useAvailableCities() {
  return useQuery({
    queryKey: ['mobility', 'cities'],
    queryFn: () => mobilityApi.getAvailableCities(),
    staleTime: 300_000,
  });
}

export function useInfraRecommendations(params?: { city?: string; status?: string; minScore?: number; limit?: number }) {
  return useQuery({
    queryKey: ['mobility', 'infrastructure', params],
    queryFn: () => mobilityApi.getInfraRecommendations(params),
    staleTime: 120_000,
  });
}

export function useCitySummary(city: string) {
  return useQuery({
    queryKey: ['mobility', 'city-summary', city],
    queryFn: () => mobilityApi.getCitySummary(city),
    enabled: !!city,
    staleTime: 120_000,
  });
}

export function useGenerateInfraRecommendations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data?: { city?: string; minGapScore?: number }) => mobilityApi.generateInfraRecommendations(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mobility', 'infrastructure'] }),
  });
}

export function useAggregateHeatmap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ periodStart, periodEnd }: { periodStart: string; periodEnd: string }) =>
      mobilityApi.aggregateHeatmap(periodStart, periodEnd),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mobility', 'heatmap'] }),
  });
}

export function useAggregateBehavior() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (date: string) => mobilityApi.aggregateBehavior(date),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mobility', 'behavior'] }),
  });
}

export function useAggregateCityTrends() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (month: string) => mobilityApi.aggregateCityTrends(month),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mobility', 'trends'] }),
  });
}

// ── Battery Health Prediction ─────────────────────────────────

export function useBatteryHealth() {
  return useQuery({
    queryKey: ['battery-health'],
    queryFn: () => batteryHealthApi.getHealth(),
    staleTime: 60_000,
  });
}

export function useAnalyzeBatteryHealth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => batteryHealthApi.analyzeHealth(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['battery-health'] });
    },
  });
}

export function useUpdateBatteryProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { vehicleName?: string; batteryCapacityKwh?: number; manufactureYear?: number }) =>
      batteryHealthApi.updateProfile(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['battery-health'] }),
  });
}

export function useDismissHealthRecommendation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (recId: string) => batteryHealthApi.dismissRecommendation(recId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['battery-health'] }),
  });
}

// ── Predictive Scheduling ─────────────────────────────────────

export function useFindOptimalSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      stationId?: string; date: string; durationMin?: number;
      flexibilityHours?: number; preferredStartHour?: number;
      latitude?: number; longitude?: number; radiusKm?: number;
    }) => schedulingApi.findOptimalSchedule(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scheduling'] }),
  });
}

export function useQuickSchedule(params: { latitude: number | null; longitude: number | null; durationMin?: number }) {
  return useQuery({
    queryKey: ['scheduling', 'quick', params],
    queryFn: () => schedulingApi.quickRecommend({
      latitude: params.latitude!,
      longitude: params.longitude!,
      durationMin: params.durationMin,
    }),
    enabled: params.latitude !== null && params.longitude !== null,
    staleTime: 60_000,
  });
}

export function useAcceptScheduleRecommendation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (recId: string) => schedulingApi.acceptRecommendation(recId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scheduling'] });
      qc.invalidateQueries({ queryKey: ['reservations'] });
    },
  });
}

export function useMyScheduleRecommendations(limit?: number) {
  return useQuery({
    queryKey: ['scheduling', 'my-recommendations', limit],
    queryFn: () => schedulingApi.getMyRecommendations(limit),
    staleTime: 60_000,
  });
}

export function useSchedulingPreferences() {
  return useQuery({
    queryKey: ['scheduling', 'preferences'],
    queryFn: () => schedulingApi.getPreferences(),
    staleTime: 300_000,
  });
}

export function useUpdateSchedulingPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, any>) => schedulingApi.updatePreferences(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scheduling', 'preferences'] }),
  });
}

// ── Range Safety Assistant ────────────────────────────────────────

export function useRangeProfile() {
  return useQuery({
    queryKey: ['range-safety', 'profile'],
    queryFn: () => rangeSafetyApi.getProfile(),
    staleTime: 60_000,
  });
}

export function useUpdateRangeProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      vehicleName?: string; batteryCapacityKwh?: number; currentBatteryPct?: number;
      efficiencyKwhPerKm?: number; drivingStyle?: string; climateControlOn?: boolean;
      avgSpeedKmh?: number; lastLatitude?: number; lastLongitude?: number;
    }) => rangeSafetyApi.updateProfile(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['range-safety'] });
    },
  });
}

export function useRangeAssessment(params?: { latitude?: number; longitude?: number }) {
  return useQuery({
    queryKey: ['range-safety', 'assess', params],
    queryFn: () => rangeSafetyApi.assessRange(params),
    enabled: !!params?.latitude && !!params?.longitude,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useCheckTripSafety() {
  return useMutation({
    mutationFn: (data: { originLat: number; originLng: number; destLat: number; destLng: number }) =>
      rangeSafetyApi.checkTripSafety(data),
  });
}

export function useRangeAlerts(params?: { limit?: number; unreadOnly?: boolean }) {
  return useQuery({
    queryKey: ['range-safety', 'alerts', params],
    queryFn: () => rangeSafetyApi.getAlerts(params),
    staleTime: 30_000,
  });
}

export function useMarkAlertRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (alertId: string) => rangeSafetyApi.markAlertRead(alertId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['range-safety', 'alerts'] }),
  });
}

export function useMarkAllAlertsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => rangeSafetyApi.markAllAlertsRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['range-safety', 'alerts'] }),
  });
}

export function useNearbyStationsRange(params: { latitude: number | null; longitude: number | null; rangeKm?: number }) {
  return useQuery({
    queryKey: ['range-safety', 'nearby', params],
    queryFn: () => rangeSafetyApi.getNearbyStations({
      latitude: params.latitude!,
      longitude: params.longitude!,
      rangeKm: params.rangeKm,
    }),
    enabled: params.latitude !== null && params.longitude !== null,
    staleTime: 30_000,
  });
}

export function useRangeTripHistory(limit?: number) {
  return useQuery({
    queryKey: ['range-safety', 'trip-history', limit],
    queryFn: () => rangeSafetyApi.getTripHistory(limit),
    staleTime: 60_000,
  });
}

// ── Community Reviews & Reliability ───────────────────────────────

export function useStationReviews(stationId: string, params?: { page?: number; limit?: number; sort?: string }) {
  return useQuery({
    queryKey: ['reviews', 'station', stationId, params],
    queryFn: () => reviewApi.getStationReviews(stationId, params),
    enabled: !!stationId,
    staleTime: 30_000,
  });
}

export function useUserReviews() {
  return useQuery({
    queryKey: ['reviews', 'my'],
    queryFn: () => reviewApi.getUserReviews(),
    staleTime: 60_000,
  });
}

export function useCreateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ stationId, data }: { stationId: string; data: CreateReviewData }) =>
      reviewApi.createReview(stationId, data),
    onSuccess: (_, { stationId }) => {
      qc.invalidateQueries({ queryKey: ['reviews', 'station', stationId] });
      qc.invalidateQueries({ queryKey: ['reviews', 'my'] });
      qc.invalidateQueries({ queryKey: ['reliability', stationId] });
      qc.invalidateQueries({ queryKey: ['reliability', 'leaderboard'] });
    },
  });
}

export function useDeleteReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reviewId: string) => reviewApi.deleteReview(reviewId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reviews'] });
      qc.invalidateQueries({ queryKey: ['reliability'] });
    },
  });
}

export function useVoteHelpful() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reviewId, isHelpful }: { reviewId: string; isHelpful: boolean }) =>
      reviewApi.voteHelpful(reviewId, isHelpful),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reviews'] }),
  });
}

export function useReportReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reviewId: string) => reviewApi.reportReview(reviewId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reviews'] }),
  });
}

export function useReliabilityScore(stationId: string) {
  return useQuery({
    queryKey: ['reliability', stationId],
    queryFn: () => reviewApi.getReliabilityScore(stationId),
    enabled: !!stationId,
    staleTime: 60_000,
  });
}

export function useReliabilityLeaderboard(params?: { city?: string; limit?: number; minReviews?: number }) {
  return useQuery({
    queryKey: ['reliability', 'leaderboard', params],
    queryFn: () => reviewApi.getLeaderboard(params),
    staleTime: 120_000,
  });
}

// ── Gamification & Rewards ────────────────────────────────────────

export function useWalletSummary() {
  return useQuery({
    queryKey: ['gamification', 'wallet'],
    queryFn: () => gamificationApi.getWalletSummary(),
    staleTime: 30_000,
  });
}

export function usePointsHistory(params?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['gamification', 'history', params],
    queryFn: () => gamificationApi.getPointsHistory(params),
    staleTime: 30_000,
  });
}

export function useGamificationStats() {
  return useQuery({
    queryKey: ['gamification', 'stats'],
    queryFn: () => gamificationApi.getUserStats(),
    staleTime: 60_000,
  });
}

export function useAwardSessionPoints() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => gamificationApi.awardSessionPoints(sessionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gamification'] }),
  });
}

export function useAwardReviewPoints() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reviewId: string) => gamificationApi.awardReviewPoints(reviewId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gamification'] }),
  });
}

export function useBadgeCatalog() {
  return useQuery({
    queryKey: ['gamification', 'badges'],
    queryFn: () => gamificationApi.getBadgeCatalog(),
    staleTime: 60_000,
  });
}

export function useRewardCatalog() {
  return useQuery({
    queryKey: ['gamification', 'rewards'],
    queryFn: () => gamificationApi.getRewardCatalog(),
    staleTime: 60_000,
  });
}

export function useRedeemReward() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rewardId: string) => gamificationApi.redeemReward(rewardId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gamification'] });
    },
  });
}

export function useUserRedemptions(status?: string) {
  return useQuery({
    queryKey: ['gamification', 'redemptions', status],
    queryFn: () => gamificationApi.getUserRedemptions(status),
    staleTime: 30_000,
  });
}

export function useGamificationLeaderboard(limit?: number) {
  return useQuery({
    queryKey: ['gamification', 'leaderboard', limit],
    queryFn: () => gamificationApi.getLeaderboard(limit),
    staleTime: 120_000,
  });
}

// ── Payments ────────────────────────────────────────────────────

export function useMyPayments(params?: { status?: string; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['payments', 'my', params],
    queryFn: () => paymentApi.getMy(params),
    staleTime: 15_000,
  });
}

export function useRefundPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (paymentId: string) => paymentApi.refund(paymentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payments'] }),
  });
}

import axios, { AxiosError, type AxiosInstance } from 'axios';
import type {
  AuthResponse, User, Station, ChargingSlot, Reservation,
  ChargingSession, SlotPrediction, PlatformStats, PaginatedResponse,
  RoutePlanRequest, RoutePlan, SmartPrediction, DemandForecast,
  RecommendationResponse, PricingRule, CurrentPrice, CostEstimate,
  PlatformAnalytics, BatteryDigitalTwin, StationTwinsResponse,
  CongestionResponse, GridLoadResponse, CarbonRecord, CarbonSummary,
  EnergyOptimizationResponse, PlatformOptimizationSummary,
  SlotAllocationResponse, QueueEntry,
  HeatmapResponse, BehaviorStatsResponse, CityTrendsResponse,
  InfraRecommendationsResponse, CitySummary,
  BatteryHealthResponse,
  ScheduleResponse, SchedulingPreferences,
  RangeAssessment, TripSafetyResult, VehicleRangeProfile, RangeEstimate, RangeAlert, NearbyStationRange,
  StationReview, StationReviewsResponse, ReliabilityScore, CreateReviewData,
  WalletSummary, Badge, Reward, RewardRedemption, PointsTransaction, LeaderboardEntry,
  Payment, CostEstimateResponse, PlugChargeVehicle, PlugEventResult, ArrivalPrediction,
  Favorite, FavoriteStatus,
  SessionHistoryResponse, SessionHistoryStats, SessionHistoryFilters, SessionHistoryItem,
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// ── Axios instance ─────────────────────────────────────────
const http: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — attach JWT
http.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — unwrap errors
http.interceptors.response.use(
  (res) => res,
  (error: AxiosError<{ error: string }>) => {
    const msg = error.response?.data?.error || error.message || 'Request failed';
    return Promise.reject(new Error(msg));
  },
);

// ── Token helpers ──────────────────────────────────────────
export function setToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) localStorage.setItem('token', token);
  else localStorage.removeItem('token');
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

// ── Auth ───────────────────────────────────────────────────
export const authApi = {
  register: (data: { email: string; password: string; fullName: string; phone?: string; role?: string }) =>
    http.post<AuthResponse>('/auth/register', data).then((r) => r.data),

  login: (data: { email: string; password: string }) =>
    http.post<AuthResponse>('/auth/login', data).then((r) => r.data),

  getProfile: () =>
    http.get<User>('/auth/profile').then((r) => r.data),

  updateProfile: (data: { fullName?: string; phone?: string }) =>
    http.put<User>('/auth/profile', data).then((r) => r.data),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    http.post('/auth/change-password', data).then((r) => r.data),
};

// ── Stations ───────────────────────────────────────────────
export const stationApi = {
  getNearby: (lat: number, lng: number, radiusKm = 25, limit = 50) =>
    http.get<Station[]>('/stations/nearby', { params: { latitude: lat, longitude: lng, radiusKm, limit } }).then((r) => r.data),

  search: (params: Record<string, string>) =>
    http.get<PaginatedResponse<Station>>('/stations/search', { params }).then((r) => r.data),

  getById: (id: string) =>
    http.get<Station>(`/stations/${id}`).then((r) => r.data),

  create: (data: Partial<Station>) =>
    http.post<Station>('/stations', data).then((r) => r.data),

  update: (id: string, data: Partial<Station>) =>
    http.put<Station>(`/stations/${id}`, data).then((r) => r.data),

  getManagerStations: () =>
    http.get<Station[]>('/stations/manager/my-stations').then((r) => r.data),

  getPredictions: (id: string) =>
    http.get<SlotPrediction>(`/stations/${id}/predictions`).then((r) => r.data),

  // Admin actions
  approve: (id: string) => http.patch<Station>(`/stations/${id}/approve`).then((r) => r.data),
  reject: (id: string) => http.patch<Station>(`/stations/${id}/reject`).then((r) => r.data),
  disable: (id: string) => http.patch<Station>(`/stations/${id}/disable`).then((r) => r.data),
};

// ── Slots ──────────────────────────────────────────────────
export const slotApi = {
  add: (stationId: string, data: { slotNumber: number; chargingType: string; connectorType: string; powerOutputKw: number }) =>
    http.post<ChargingSlot>(`/stations/${stationId}/slots`, data).then((r) => r.data),

  update: (stationId: string, slotId: string, data: Partial<ChargingSlot>) =>
    http.put<ChargingSlot>(`/stations/${stationId}/slots/${slotId}`, data).then((r) => r.data),

  remove: (stationId: string, slotId: string) =>
    http.delete(`/stations/${stationId}/slots/${slotId}`),
};

// ── Reservations ───────────────────────────────────────────
export const reservationApi = {
  create: (data: { slotId: string; stationId: string; scheduledStart: string; scheduledEnd: string; vehicleInfo?: Record<string, string>; notes?: string }) =>
    http.post<Reservation>('/reservations', data).then((r) => r.data),

  getMy: (params?: Record<string, string>) =>
    http.get<Reservation[]>('/reservations/my', { params }).then((r) => r.data),

  getById: (id: string) =>
    http.get<Reservation>(`/reservations/${id}`).then((r) => r.data),

  cancel: (id: string) =>
    http.patch<Reservation>(`/reservations/${id}/cancel`).then((r) => r.data),

  getByStation: (stationId: string) =>
    http.get<Reservation[]>(`/reservations/station/${stationId}`).then((r) => r.data),
};

// ── Charging sessions ──────────────────────────────────────
export const chargingApi = {
  start: (data: { slotId: string; startPercentage: number; targetPercentage?: number; reservationId?: string }) =>
    http.post<ChargingSession>('/charging/start', data).then((r) => r.data),

  updateProgress: (id: string, data: { currentPercentage: number; energyDeliveredKwh?: number; averagePowerKw?: number; cost?: number }) =>
    http.patch<ChargingSession>(`/charging/${id}/progress`, data).then((r) => r.data),

  complete: (id: string) =>
    http.patch<ChargingSession>(`/charging/${id}/complete`).then((r) => r.data),

  getActive: () =>
    http.get<ChargingSession[]>('/charging/active').then((r) => r.data),

  getById: (id: string) =>
    http.get<ChargingSession>(`/charging/${id}`).then((r) => r.data),

  getByStation: (stationId: string, params?: Record<string, string>) =>
    http.get<ChargingSession[]>(`/charging/station/${stationId}`, { params }).then((r) => r.data),
};

// ── Admin ──────────────────────────────────────────────────
export const adminApi = {
  getStats: () =>
    http.get<PlatformStats>('/admin/stats').then((r) => r.data),

  getUsers: (params?: Record<string, string>) =>
    http.get<PaginatedResponse<User>>('/admin/users', { params }).then((r) => r.data),

  toggleUserStatus: (id: string) =>
    http.patch<User>(`/admin/users/${id}/toggle-status`).then((r) => r.data),

  updateUserRole: (id: string, role: string) =>
    http.patch<User>(`/admin/users/${id}/role`, { role }).then((r) => r.data),

  deleteUser: (id: string) =>
    http.delete(`/admin/users/${id}`),

  getStations: (params?: Record<string, string>) =>
    http.get<PaginatedResponse<Station>>('/admin/stations', { params }).then((r) => r.data),

  getAuditLogs: (params?: Record<string, string>) =>
    http.get('/admin/audit-logs', { params }).then((r) => r.data),
};

// ── Route Planner ─────────────────────────────────────────
export const routePlannerApi = {
  plan: (data: RoutePlanRequest) =>
    http.post<RoutePlan>('/route-planner/plan', data).then((r) => r.data),

  save: (data: any) =>
    http.post('/route-planner/save', data).then((r) => r.data),

  getMyPlans: () =>
    http.get('/route-planner/my-plans').then((r) => r.data),
};

// ── Intelligent Features ──────────────────────────────────
export const intelligentApi = {
  // Smart predictions (enhanced)
  getSmartPrediction: (stationId: string) =>
    http.get<SmartPrediction>(`/intelligent/predictions/${stationId}`).then((r) => r.data),

  // Demand forecasting
  getDemandForecast: (stationId: string, day?: number) =>
    http.get<DemandForecast>(`/intelligent/demand/${stationId}`, {
      params: day !== undefined ? { day } : undefined,
    }).then((r) => r.data),

  getTodayDemand: (stationId: string) =>
    http.get<DemandForecast>(`/intelligent/demand/${stationId}/today`).then((r) => r.data),

  // Recommendations
  getRecommendations: (params: { latitude: number; longitude: number; radiusKm?: number; chargingType?: string; connectorType?: string }) =>
    http.get<RecommendationResponse>('/intelligent/recommendations', { params }).then((r) => r.data),

  // Dynamic pricing
  getPricingSchedule: (stationId: string) =>
    http.get<{ rules: PricingRule[] }>(`/intelligent/pricing/${stationId}`).then((r) => r.data),

  getCurrentPrice: (stationId: string) =>
    http.get<CurrentPrice>(`/intelligent/pricing/${stationId}/current`).then((r) => r.data),

  estimateCost: (stationId: string, energyKwh: number) =>
    http.get<CostEstimate>(`/intelligent/pricing/${stationId}/estimate`, {
      params: { energyKwh },
    }).then((r) => r.data),

  createPricingRule: (stationId: string, data: any) =>
    http.post(`/intelligent/pricing/${stationId}/rules`, data).then((r) => r.data),

  updatePricingRule: (ruleId: string, data: any) =>
    http.put(`/intelligent/pricing/rules/${ruleId}`, data).then((r) => r.data),

  deletePricingRule: (ruleId: string) =>
    http.delete(`/intelligent/pricing/rules/${ruleId}`),

  // Analytics
  getPlatformAnalytics: (params?: { startDate?: string; endDate?: string; period?: string }) =>
    http.get<PlatformAnalytics>('/intelligent/analytics/platform', { params }).then((r) => r.data),

  getStationAnalytics: (stationId: string, params?: { startDate?: string; endDate?: string }) =>
    http.get(`/intelligent/analytics/stations/${stationId}`, { params }).then((r) => r.data),

  // Battery Digital Twin
  getTwinBySession: (sessionId: string) =>
    http.get<BatteryDigitalTwin>(`/intelligent/twin/session/${sessionId}`).then((r) => r.data),

  simulateTwinStep: (sessionId: string) =>
    http.post<BatteryDigitalTwin>(`/intelligent/twin/session/${sessionId}/simulate`).then((r) => r.data),

  getStationTwins: (stationId: string) =>
    http.get<StationTwinsResponse>(`/intelligent/twin/station/${stationId}`).then((r) => r.data),

  // Congestion Prediction
  getCongestionPredictions: (stationId: string, hours?: number) =>
    http.get<CongestionResponse>(`/intelligent/congestion/${stationId}`, {
      params: hours ? { hours } : undefined,
    }).then((r) => r.data),

  refreshCongestionPredictions: (stationId: string, hours?: number) =>
    http.post<CongestionResponse>(`/intelligent/congestion/${stationId}/predict`, null, {
      params: hours ? { hours } : undefined,
    }).then((r) => r.data),

  // Grid Load Balancing
  getGridLoad: (stationId: string) =>
    http.get<GridLoadResponse>(`/intelligent/grid/${stationId}`).then((r) => r.data),

  updateGridSettings: (stationId: string, data: { gridCapacityKw?: number; warningThresholdPct?: number; criticalThresholdPct?: number }) =>
    http.put<GridLoadResponse>(`/intelligent/grid/${stationId}/settings`, data).then((r) => r.data),

  // Carbon Footprint
  getSessionCarbon: (sessionId: string) =>
    http.get<CarbonRecord>(`/intelligent/carbon/session/${sessionId}`).then((r) => r.data),

  recordSessionCarbon: (sessionId: string) =>
    http.post<CarbonRecord>(`/intelligent/carbon/session/${sessionId}/record`).then((r) => r.data),

  getUserCarbon: () =>
    http.get<CarbonSummary>('/intelligent/carbon/me').then((r) => r.data),

  getStationCarbon: (stationId: string, params?: { startDate?: string; endDate?: string }) =>
    http.get<CarbonSummary>(`/intelligent/carbon/station/${stationId}`, { params }).then((r) => r.data),

  getPlatformCarbon: () =>
    http.get<CarbonSummary>('/intelligent/carbon/platform').then((r) => r.data),

  // Energy Optimization
  getOptimizationRecs: (stationId: string) =>
    http.get<EnergyOptimizationResponse>(`/intelligent/optimization/${stationId}`).then((r) => r.data),

  generateOptimizations: (stationId: string) =>
    http.post(`/intelligent/optimization/${stationId}/generate`).then((r) => r.data),

  getPlatformOptimization: () =>
    http.get<PlatformOptimizationSummary>('/intelligent/optimization/platform/summary').then((r) => r.data),

  updateOptimizationRec: (recId: string, status: 'accepted' | 'rejected') =>
    http.put(`/intelligent/optimization/recommendations/${recId}`, { status }).then((r) => r.data),

  // Autonomous Slot Allocation
  recommendSlot: (stationId: string, params: {
    batteryPercentage: number; targetPercentage?: number;
    batteryCapacityKwh?: number; preferredStart?: string;
    connectorType?: string; chargingType?: string;
  }) =>
    http.get<SlotAllocationResponse>(`/intelligent/allocation/${stationId}/recommend`, { params }).then((r) => r.data),

  joinQueue: (stationId: string, data: {
    batteryPercentage: number; targetPercentage?: number;
    batteryCapacityKwh?: number; connectorType?: string; chargingType?: string;
  }) =>
    http.post<QueueEntry>(`/intelligent/allocation/${stationId}/queue`, data).then((r) => r.data),

  leaveQueue: (stationId: string) =>
    http.delete(`/intelligent/allocation/${stationId}/queue`).then((r) => r.data),

  getMyQueueStatus: (stationId: string) =>
    http.get(`/intelligent/allocation/${stationId}/queue/me`).then((r) => r.data),

  getStationQueue: (stationId: string) =>
    http.get(`/intelligent/allocation/${stationId}/queue`).then((r) => r.data),
};

// ── Mobility Intelligence ─────────────────────────────────────
export const mobilityApi = {
  // Heatmap
  getHeatmapData: (params?: { minLat?: number; maxLat?: number; minLng?: number; maxLng?: number; periodStart?: string; periodEnd?: string }) =>
    http.get<HeatmapResponse>('/intelligent/mobility/heatmap', { params }).then((r) => r.data),

  aggregateHeatmap: (periodStart: string, periodEnd: string) =>
    http.post('/intelligent/mobility/heatmap/aggregate', { periodStart, periodEnd }).then((r) => r.data),

  // Behavior
  getBehaviorStats: (params?: { city?: string; startDate?: string; endDate?: string }) =>
    http.get<BehaviorStatsResponse>('/intelligent/mobility/behavior', { params }).then((r) => r.data),

  aggregateBehavior: (date: string) =>
    http.post('/intelligent/mobility/behavior/aggregate', { date }).then((r) => r.data),

  // City Trends
  getCityTrends: (params?: { city?: string; startMonth?: string; endMonth?: string }) =>
    http.get<CityTrendsResponse>('/intelligent/mobility/trends', { params }).then((r) => r.data),

  aggregateCityTrends: (month: string) =>
    http.post('/intelligent/mobility/trends/aggregate', { month }).then((r) => r.data),

  getAvailableCities: () =>
    http.get<{ cities: string[] }>('/intelligent/mobility/cities').then((r) => r.data),

  // Infrastructure Planning
  generateInfraRecommendations: (data?: { city?: string; minGapScore?: number }) =>
    http.post('/intelligent/mobility/infrastructure/generate', data).then((r) => r.data),

  getInfraRecommendations: (params?: { city?: string; status?: string; minScore?: number; limit?: number }) =>
    http.get<InfraRecommendationsResponse>('/intelligent/mobility/infrastructure', { params }).then((r) => r.data),

  updateInfraRecommendation: (recId: string, status: string) =>
    http.put(`/intelligent/mobility/infrastructure/${recId}`, { status }).then((r) => r.data),

  getCitySummary: (city: string) =>
    http.get<CitySummary>(`/intelligent/mobility/infrastructure/city/${city}`).then((r) => r.data),
};

// ── Battery Health Prediction ─────────────────────────────────
export const batteryHealthApi = {
  getHealth: () =>
    http.get<BatteryHealthResponse>('/intelligent/battery-health').then((r) => r.data),

  analyzeHealth: () =>
    http.post<BatteryHealthResponse>('/intelligent/battery-health/analyze').then((r) => r.data),

  updateProfile: (data: { vehicleName?: string; batteryCapacityKwh?: number; manufactureYear?: number }) =>
    http.put('/intelligent/battery-health/profile', data).then((r) => r.data),

  getHistory: (limit?: number) =>
    http.get<{ snapshots: Array<any> }>('/intelligent/battery-health/history', { params: limit ? { limit } : undefined }).then((r) => r.data),

  getRecommendations: () =>
    http.get<{ recommendations: Array<any> }>('/intelligent/battery-health/recommendations').then((r) => r.data),

  dismissRecommendation: (recId: string) =>
    http.patch(`/intelligent/battery-health/recommendations/${recId}/dismiss`).then((r) => r.data),
};

// ── Predictive Scheduling ─────────────────────────────────────
export const schedulingApi = {
  findOptimalSchedule: (data: {
    stationId?: string; date: string; durationMin?: number;
    flexibilityHours?: number; preferredStartHour?: number;
    latitude?: number; longitude?: number; radiusKm?: number;
  }) =>
    http.post<ScheduleResponse>('/intelligent/scheduling/find', data).then((r) => r.data),

  quickRecommend: (params: { latitude: number; longitude: number; durationMin?: number }) =>
    http.get<ScheduleResponse>('/intelligent/scheduling/quick', { params }).then((r) => r.data),

  acceptRecommendation: (recId: string) =>
    http.post(`/intelligent/scheduling/accept/${recId}`).then((r) => r.data),

  getMyRecommendations: (limit?: number) =>
    http.get<{ recommendations: Array<any> }>('/intelligent/scheduling/my-recommendations', {
      params: limit ? { limit } : undefined,
    }).then((r) => r.data),

  getPreferences: () =>
    http.get<SchedulingPreferences>('/intelligent/scheduling/preferences').then((r) => r.data),

  updatePreferences: (data: Partial<SchedulingPreferences>) =>
    http.put<SchedulingPreferences>('/intelligent/scheduling/preferences', data).then((r) => r.data),
};

// ── Range Safety Assistant ────────────────────────────────────────
export const rangeSafetyApi = {
  getProfile: () =>
    http.get<{ profile: VehicleRangeProfile; range: RangeEstimate }>('/intelligent/range-safety/profile').then((r) => r.data),

  updateProfile: (data: {
    vehicleName?: string; batteryCapacityKwh?: number; currentBatteryPct?: number;
    efficiencyKwhPerKm?: number; drivingStyle?: string; climateControlOn?: boolean;
    avgSpeedKmh?: number; lastLatitude?: number; lastLongitude?: number;
  }) =>
    http.put<{ profile: VehicleRangeProfile; range: RangeEstimate }>('/intelligent/range-safety/profile', data).then((r) => r.data),

  assessRange: (params?: { latitude?: number; longitude?: number }) =>
    http.get<RangeAssessment>('/intelligent/range-safety/assess', { params }).then((r) => r.data),

  checkTripSafety: (data: { originLat: number; originLng: number; destLat: number; destLng: number }) =>
    http.post<TripSafetyResult>('/intelligent/range-safety/trip-check', data).then((r) => r.data),

  getAlerts: (params?: { limit?: number; unreadOnly?: boolean }) =>
    http.get<{ alerts: RangeAlert[]; count: number }>('/intelligent/range-safety/alerts', { params }).then((r) => r.data),

  markAlertRead: (alertId: string) =>
    http.patch(`/intelligent/range-safety/alerts/${alertId}/read`).then((r) => r.data),

  markAllAlertsRead: () =>
    http.post('/intelligent/range-safety/alerts/read-all').then((r) => r.data),

  getNearbyStations: (params: { latitude: number; longitude: number; rangeKm?: number; limit?: number }) =>
    http.get<{ stations: NearbyStationRange[]; count: number }>('/intelligent/range-safety/stations-nearby', { params }).then((r) => r.data),

  getTripHistory: (limit?: number) =>
    http.get<{ trips: Array<any>; count: number }>('/intelligent/range-safety/trip-history', { params: limit ? { limit } : undefined }).then((r) => r.data),
};

// ── Community Reviews & Reliability ───────────────────────────────
export const reviewApi = {
  createReview: (stationId: string, data: CreateReviewData) =>
    http.post<StationReview>(`/intelligent/reviews/${stationId}`, data).then((r) => r.data),

  getStationReviews: (stationId: string, params?: { page?: number; limit?: number; sort?: string }) =>
    http.get<StationReviewsResponse>(`/intelligent/reviews/station/${stationId}`, { params }).then((r) => r.data),

  getUserReviews: () =>
    http.get<{ reviews: StationReview[]; count: number }>('/intelligent/reviews/my').then((r) => r.data),

  deleteReview: (reviewId: string) =>
    http.delete(`/intelligent/reviews/${reviewId}`).then((r) => r.data),

  voteHelpful: (reviewId: string, isHelpful: boolean) =>
    http.post<{ helpfulCount: number }>(`/intelligent/reviews/${reviewId}/vote`, { isHelpful }).then((r) => r.data),

  reportReview: (reviewId: string) =>
    http.post(`/intelligent/reviews/${reviewId}/report`).then((r) => r.data),

  getReliabilityScore: (stationId: string) =>
    http.get<ReliabilityScore>(`/intelligent/reliability/${stationId}`).then((r) => r.data),

  getLeaderboard: (params?: { city?: string; limit?: number; minReviews?: number }) =>
    http.get<{ stations: ReliabilityScore[]; count: number }>('/intelligent/reliability/leaderboard', { params }).then((r) => r.data),
};

// ── Gamification & Rewards ────────────────────────────────────────
export const gamificationApi = {
  getWalletSummary: () =>
    http.get<WalletSummary>('/intelligent/rewards/wallet').then((r) => r.data),

  getPointsHistory: (params?: { limit?: number; offset?: number }) =>
    http.get<{ transactions: PointsTransaction[]; total: number }>('/intelligent/rewards/history', { params }).then((r) => r.data),

  getUserStats: () =>
    http.get<Record<string, number>>('/intelligent/rewards/stats').then((r) => r.data),

  awardSessionPoints: (sessionId: string) =>
    http.post('/intelligent/rewards/award-session', { sessionId }).then((r) => r.data),

  awardReviewPoints: (reviewId: string) =>
    http.post('/intelligent/rewards/award-review', { reviewId }).then((r) => r.data),

  getBadgeCatalog: () =>
    http.get<{ badges: Badge[]; count: number }>('/intelligent/rewards/badges').then((r) => r.data),

  getRewardCatalog: () =>
    http.get<{ rewards: Reward[]; count: number }>('/intelligent/rewards/catalog').then((r) => r.data),

  redeemReward: (rewardId: string) =>
    http.post<{ redemption: RewardRedemption; newBalance: number }>('/intelligent/rewards/redeem', { rewardId }).then((r) => r.data),

  getUserRedemptions: (status?: string) =>
    http.get<{ redemptions: RewardRedemption[]; count: number }>('/intelligent/rewards/redemptions', { params: status ? { status } : undefined }).then((r) => r.data),

  getLeaderboard: (limit?: number) =>
    http.get<{ leaders: LeaderboardEntry[]; count: number }>('/intelligent/rewards/leaderboard', { params: limit ? { limit } : undefined }).then((r) => r.data),
};

// ── Payment API ─────────────────────────────────────────────
export const paymentApi = {
  create: (data: { amount: number; reservationId?: string; sessionId?: string; paymentMethod?: string }) =>
    http.post<Payment>('/payments', data).then((r) => r.data),

  process: (paymentId: string) =>
    http.post<Payment>(`/payments/${paymentId}/process`).then((r) => r.data),

  refund: (paymentId: string) =>
    http.post<Payment>(`/payments/${paymentId}/refund`).then((r) => r.data),

  getMy: (params?: { status?: string; limit?: number; offset?: number }) =>
    http.get<Payment[]>('/payments/my', { params }).then((r) => r.data),

  getById: (paymentId: string) =>
    http.get<Payment>(`/payments/${paymentId}`).then((r) => r.data),

  estimateCost: (stationId: string, params: { batteryPct: number; targetPct: number; batteryCapacityKwh?: number }) =>
    http.get<CostEstimateResponse>(`/payments/estimate/${stationId}`, { params }).then((r) => r.data),
};

// ── Plug & Charge API ───────────────────────────────────────
export const plugChargeApi = {
  registerVehicle: (data: { vehicleId: string; vehicleName?: string; connectorType?: string; batteryCapacityKwh?: number; defaultTargetPercentage?: number }) =>
    http.post<PlugChargeVehicle>('/plug-charge/vehicles', data).then((r) => r.data),

  getMyVehicles: () =>
    http.get<PlugChargeVehicle[]>('/plug-charge/vehicles').then((r) => r.data),

  deregisterVehicle: (vehicleId: string) =>
    http.delete<{ message: string; vehicle: PlugChargeVehicle }>(`/plug-charge/vehicles/${vehicleId}`).then((r) => r.data),

  simulatePlug: (data: { vehicleId: string; slotId: string; currentBatteryPct?: number }) =>
    http.post<PlugEventResult>('/plug-charge/simulate-plug', data).then((r) => r.data),
};

// ── ETA Prediction API ──────────────────────────────────────
export const predictionApi = {
  getNextAvailable: (stationId: string) =>
    http.get(`/predictions/stations/${stationId}/next-available`).then((r) => r.data),

  getArrivalPrediction: (stationId: string, params: { eta: number; connectorType?: string; chargingType?: string }) =>
    http.get<ArrivalPrediction>(`/predictions/stations/${stationId}/arrival`, { params }).then((r) => r.data),

  getDemandProfile: () =>
    http.get('/predictions/demand-profile').then((r) => r.data),
};

// ── Favorites ─────────────────────────────────────────────────
export const favoriteApi = {
  list: () =>
    http.get<Favorite[]>('/favorites').then((r) => r.data),

  add: (stationId: string) =>
    http.post<Favorite>(`/favorites/${stationId}`).then((r) => r.data),

  remove: (stationId: string) =>
    http.delete(`/favorites/${stationId}`).then((r) => r.data),

  getStatus: (stationId: string) =>
    http.get<FavoriteStatus>(`/favorites/${stationId}/status`).then((r) => r.data),
};

// ── Session History ───────────────────────────────────────────
export const sessionHistoryApi = {
  list: (filters?: SessionHistoryFilters) =>
    http.get<SessionHistoryResponse>('/charging/history', { params: filters }).then((r) => r.data),

  getDetail: (sessionId: string) =>
    http.get<SessionHistoryItem>(`/charging/history/${sessionId}`).then((r) => r.data),

  getStats: () =>
    http.get<SessionHistoryStats>('/charging/history/stats').then((r) => r.data),
};

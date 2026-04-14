// ── Enums ──────────────────────────────────────────────────
export type UserRole = 'customer' | 'manager' | 'admin';
export type StationStatus = 'pending' | 'approved' | 'rejected' | 'disabled';
export type SlotStatus = 'available' | 'occupied' | 'reserved' | 'maintenance';
export type ChargingType = 'level1' | 'level2' | 'dc_fast';
export type ConnectorType = 'type1' | 'type2' | 'ccs' | 'chademo' | 'tesla';
export type ReservationStatus = 'pending' | 'confirmed' | 'active' | 'completed' | 'cancelled' | 'expired';
export type SessionStatus = 'pending' | 'charging' | 'completed' | 'failed';

// ── Operating Hours ─────────────────────────────────────────
export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface DaySchedule {
  open: string; // HH:mm
  close: string; // HH:mm
}

export interface OperatingHours {
  type: 'ALWAYS_OPEN' | 'SCHEDULED';
  schedule: Partial<Record<DayKey, DaySchedule>> | null;
}

// ── Domain models ──────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: UserRole;
  avatar_url?: string;
  is_active: boolean;
  email_verified?: boolean;
  created_at: string;
  updated_at?: string;
}

export interface Station {
  id: string;
  manager_id: string;
  name: string;
  description?: string;
  address: string;
  city: string;
  state?: string;
  zip_code?: string;
  country: string;
  latitude: number;
  longitude: number;
  status: StationStatus;
  operating_hours: OperatingHours;
  amenities: string[];
  images: string[];
  pricing_per_kwh?: number;
  rating: number;
  total_reviews: number;
  total_slots?: number;
  available_slots?: number;
  distance_meters?: number;
  manager_name?: string;
  slots?: ChargingSlot[];
  created_at: string;
}

export interface ChargingSlot {
  id: string;
  station_id: string;
  slot_number: number;
  charging_type: ChargingType;
  connector_type: ConnectorType;
  power_output_kw: number;
  status: SlotStatus;
  current_session_id?: string;
  active_session?: ActiveSession | null;
}

export interface ActiveSession {
  id: string;
  status: SessionStatus;
  current_percentage: number;
  target_percentage: number;
  start_percentage: number;
  energy_delivered_kwh: number;
  average_power_kw?: number;
  cost?: number;
  started_at: string;
  estimated_minutes_remaining?: number;
  estimated_completion_time?: string;
}

export interface Reservation {
  id: string;
  user_id: string;
  slot_id: string;
  station_id: string;
  status: ReservationStatus;
  scheduled_start: string;
  scheduled_end: string;
  actual_start?: string;
  actual_end?: string;
  vehicle_info?: Record<string, string>;
  notes?: string;
  station_name?: string;
  station_address?: string;
  slot_number?: number;
  charging_type?: ChargingType;
  connector_type?: ConnectorType;
  user_name?: string;
  user_email?: string;
  created_at: string;
}

export interface ChargingSession {
  id: string;
  reservation_id?: string;
  slot_id: string;
  user_id: string;
  status: SessionStatus;
  start_percentage: number;
  current_percentage: number;
  target_percentage: number;
  energy_delivered_kwh: number;
  average_power_kw?: number;
  cost: number;
  started_at?: string;
  completed_at?: string;
  station_name?: string;
  station_id?: string;
  slot_number?: number;
  power_output_kw?: number;
  charging_type?: ChargingType;
  estimated_minutes_remaining?: number;
  estimated_completion_time?: string;
  user_name?: string;
}

export interface PredictionSlotInfo {
  slotId: string;
  slotNumber: number;
  powerKw: number;
  chargingType: string;
  connectorType?: string;
}

export interface SlotPredictionEntry {
  slotId: string;
  slotNumber: number;
  predictedMinutes: number;
  confidence: number;
  source: 'charging_progress' | 'charging_near_complete' | 'reservation_schedule' | 'historical_average' | 'default_estimate';
  details: Record<string, any>;
}

export interface SlotPrediction {
  available: boolean;
  availableSlots: number;
  estimatedMinutes: number | null;
  slots: PredictionSlotInfo[];
  predictions: SlotPredictionEntry[];
  nextAvailable: {
    slotNumber: number;
    predictedMinutes: number;
    confidence: number;
    source: string;
    predictedAvailableAt: string;
  } | null;
  message: string;
}

export interface PlatformStats {
  total_users: string;
  total_customers: string;
  total_managers: string;
  total_stations: string;
  approved_stations: string;
  pending_stations: string;
  rejected_stations: string;
  disabled_stations: string;
  total_slots: string;
  available_slots: string;
  occupied_slots: string;
  total_reservations: string;
  active_reservations: string;
  confirmed_reservations: string;
  total_sessions: string;
  active_sessions: string;
  total_energy_kwh: string;
  total_revenue: string;
}

// ── API response wrappers ──────────────────────────────────
export interface AuthResponse {
  user: User;
  token: string;
}

export interface PaginatedResponse<T> {
  stations?: T[];
  users?: T[];
  total: number;
}

export interface ApiError {
  error: string;
  details?: Array<{ field: string; message: string }>;
}

// ── Intelligent Features ──────────────────────────────────

export interface RoutePlanRequest {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  batteryPercentage: number;
  vehicleRangeKm: number;
  vehicleBatteryCapacityKwh?: number;
}

export interface ChargingStop {
  stopNumber: number;
  stationId: string;
  stationName: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  distanceFromPrevKm: number;
  arrivalBatteryPct: number;
  departureBatteryPct: number;
  estimatedChargingMin: number;
  estimatedWaitMin: number;
  chargingSpeedKw: number;
  availableSlots: number;
  totalSlots: number;
  rating: number;
  pricingPerKwh: number;
  estimatedCost: number;
}

export interface RoutePlan {
  totalDistanceKm: number;
  totalStops: number;
  estimatedTotalChargingMin: number;
  estimatedTotalCost: number;
  arrivalBatteryPct: number;
  stops: ChargingStop[];
  route: {
    start: { lat: number; lng: number };
    end: { lat: number; lng: number };
    waypoints: Array<{ lat: number; lng: number }>;
  };
}

/** @deprecated Use SlotPrediction instead — unified prediction type */
export type SmartPrediction = SlotPrediction;

export interface DemandHour {
  hour: number;
  timeRange: string;
  demandLevel: 'low' | 'medium' | 'high';
  avgOccupancyRate: number;
  avgWaitMinutes: number;
  avgSessions: number;
  avgReservations: number;
  sampleCount: number;
}

export interface DemandDay {
  dayName: string;
  dayOfWeek: number;
  hours: DemandHour[];
  peakHour: number | null;
}

export interface DemandForecast {
  forecast: DemandDay[];
}

export interface StationRecommendation {
  stationId: string;
  name: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  availableSlots: number;
  totalSlots: number;
  maxPowerKw: number;
  avgPowerKw: number;
  speedLabel: string;
  rating: number;
  totalReviews: number;
  pricingPerKwh: number | null;
  estimatedWaitMin: number;
  amenities: string[];
  reliabilityPct: number;
  communityReviews: number;
  score: number;
  label: string;
  scoreBreakdown: {
    distance: number;
    availability: number;
    speed: number;
    waitTime: number;
    rating: number;
    reliability: number;
  };
}

export interface RecommendationResponse {
  recommendations: StationRecommendation[];
  topPick: StationRecommendation | null;
  message: string;
}

export interface PricingRule {
  id: string;
  name: string;
  pricePerKwh: number;
  days: string[];
  startTime: string;
  endTime: string;
  priority: number;
  isActive: boolean;
}

export interface CurrentPrice {
  pricePerKwh: number;
  ruleName: string;
  ruleId: string | null;
}

export interface CostEstimate {
  estimatedCost: number;
  pricePerKwh: number;
  energyKwh: number;
  ruleName: string;
}

export interface AnalyticsSummary {
  total_sessions: number;
  total_reservations: number;
  total_energy_kwh: number;
  total_revenue: number;
  avg_session_duration_min: number;
  total_unique_users: number;
}

export interface AnalyticsTrend {
  period: string;
  sessions: number;
  reservations: number;
  energy_kwh: number;
  revenue: number;
  unique_users: number;
}

export interface TopStation {
  id: string;
  name: string;
  city: string;
  total_sessions: number;
  total_energy_kwh: number;
  total_revenue: number;
  avg_duration_min: number;
}

export interface PeakHour {
  hour: number;
  label: string;
  sessions: number;
}

export interface PlatformAnalytics {
  period: { start: string; end: string; groupBy: string };
  summary: AnalyticsSummary;
  trends: AnalyticsTrend[];
  topStations: TopStation[];
  peakHours: PeakHour[];
  dailyReservations: Array<{
    day: string;
    total: number;
    completed: number;
    cancelled: number;
  }>;
}

// ── Energy Intelligence (Round 2) ────────────────────────────

export interface BatteryDigitalTwin {
  id: string;
  sessionId: string;
  slotId: string;
  battery: {
    currentSoc: number;
    targetSoc: number;
    capacityKwh: number;
    healthPct: number;
    cycleCount: number;
    degradationPct: number;
  };
  charging: {
    currentPowerKw: number;
    maxPowerKw: number;
    efficiency: number;
    energyDeliveredKwh: number;
    estimatedTotalKwh: number;
  };
  thermal: {
    batteryTempCelsius: number;
    ambientTempCelsius: number;
    thermalStatus: 'normal' | 'warm' | 'derated';
  };
  prediction: {
    minutesRemaining: number;
    estimatedCompletionTime: string | null;
  };
  simulationStep: number;
  isActive: boolean;
  updatedAt: string;
}

export interface StationTwinsResponse {
  stationId: string;
  twins: BatteryDigitalTwin[];
  count: number;
}

export interface CongestionPrediction {
  predictedFor: string;
  hour: number;
  congestionLevel: 'low' | 'medium' | 'high' | 'critical';
  predictedOccupancyPct: number;
  predictedWaitMinutes: number;
  predictedQueueLength: number;
  confidence: number;
  factors: Record<string, any>;
}

export interface CongestionResponse {
  stationId: string;
  totalSlots?: number;
  currentOccupancy?: {
    occupied: number;
    percentage: number;
    level: string;
  };
  predictions: CongestionPrediction[];
  bestTimeToVisit?: {
    hour: number;
    time: string;
    congestionLevel: string;
    estimatedWait: number;
  } | null;
  message?: string;
  cached?: boolean;
}

export interface GridSlotAllocation {
  slotId: string;
  slotNumber: number;
  maxPowerKw: number;
  currentPowerKw: number;
  isCharging: boolean;
  currentSoc: number | null;
  targetSoc: number | null;
  sessionId: string | null;
}

export interface GridLoadRecommendation {
  slotId?: string;
  slotNumber?: number;
  action: string;
  currentPowerKw?: number;
  recommendedPowerKw?: number;
  reductionKw?: number;
  reason: string;
  priority: string;
}

export interface GridLoadResponse {
  stationId: string;
  grid: {
    capacityKw: number;
    currentLoadKw: number;
    loadPercentage: number;
    status: 'normal' | 'warning' | 'critical' | 'emergency';
    loadBalancingActive: boolean;
    peakLoadKw: number;
    warningThresholdPct: number;
    criticalThresholdPct: number;
  };
  slots: GridSlotAllocation[];
  recommendations: GridLoadRecommendation[];
  message: string;
}

export interface CarbonRecord {
  id: string;
  sessionId: string;
  userId: string;
  stationId: string;
  energyKwh: number;
  gridCarbonIntensity: number;
  gasolineCo2AvoidedKg: number;
  netCarbonSavedKg: number;
  treesEquivalent: number;
  milesOffset: number;
  renewablePercentage: number;
  createdAt: string;
}

export interface CarbonSummary {
  userId?: string;
  stationId?: string;
  period?: { start: string; end: string };
  totals: {
    sessions: number;
    energyKwh: number;
    gasolineCo2AvoidedKg: number;
    carbonSavedKg: number;
    treesEquivalent: number;
    milesOffset: number;
    avgRenewablePct?: number;
    uniqueUsers?: number;
    uniqueStations?: number;
  };
  monthlyTrend?: Array<{
    month: string;
    energyKwh: number;
    carbonSavedKg: number;
    sessions: number;
  }>;
  dailyTrend?: Array<{
    day: string;
    energyKwh: number;
    carbonSavedKg: number;
    sessions: number;
  }>;
}

export interface EnergyOptimizationRec {
  id: string;
  stationId: string;
  type: 'load_shift' | 'demand_redirect' | 'schedule_optimize' | 'power_reduce';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  estimatedSavingsKwh: number;
  estimatedCostSavings: number;
  estimatedCarbonSavingsKg: number;
  status: string;
  metadata: Record<string, any>;
  expiresAt: string | null;
  createdAt: string;
}

export interface EnergyOptimizationResponse {
  stationId: string;
  recommendations: EnergyOptimizationRec[];
}

export interface PlatformOptimizationSummary {
  recommendations: Array<{
    recommendation_type: string;
    priority: string;
    count: number;
    total_savings_kwh: number;
    total_cost_savings: number;
    total_carbon_savings_kg: number;
  }>;
  gridOverview: Array<{
    grid_status: string;
    count: number;
    avg_load_pct: number;
    max_load_pct: number;
  }>;
}

// ── Autonomous Slot Allocation ───────────────────────────────

export interface SlotAllocationScores {
  availability: number;
  chargingSpeed: number;
  gridLoad: number;
  congestion: number;
  reservationFit: number;
  chargeTime: number;
}

export interface SlotRanking {
  slotId: string;
  slotNumber: number;
  chargingType: ChargingType;
  connectorType: ConnectorType;
  powerOutputKw: number;
  status: SlotStatus;
  totalScore: number;
  scores: SlotAllocationScores;
  availableIn: number;
  estimatedChargeMinutes: number;
  estimatedCompletionTime: string;
  chargingStartTime: string;
  prediction: {
    predictedMinutes: number;
    confidence: number;
    source: string;
  } | null;
}

export interface SlotAllocationRecommendation {
  slotId: string;
  slotNumber: number;
  chargingType: ChargingType;
  connectorType: ConnectorType;
  powerOutputKw: number;
  status: SlotStatus;
  score: number;
  chargingStartTime: string;
  estimatedChargeMinutes: number;
  estimatedCompletionTime: string;
  availableIn: number;
  reason: string;
}

export interface SlotAllocationQueue {
  position: number;
  estimatedWaitMinutes: number;
  nextSlotAvailable: {
    slotNumber: number;
    availableIn: number;
    powerKw: number;
  } | null;
  message: string;
}

export interface SlotAllocationResponse {
  recommendation: SlotAllocationRecommendation | null;
  rankings: SlotRanking[];
  queue: SlotAllocationQueue | null;
  factors: {
    batteryPercentage: number;
    targetPercentage: number;
    gridStatus: string;
    gridLoadPct: number | null;
    congestionLevel: string;
    totalSlots: number;
    availableSlots: number;
  };
  message: string;
}

export interface QueueEntry {
  id: string;
  userId: string;
  stationId: string;
  userName?: string;
  batteryPercentage: number;
  targetPercentage: number;
  connectorPreference: string | null;
  chargingTypePreference: string | null;
  queuePosition: number;
  estimatedWaitMinutes: number;
  status: string;
  assignedSlotId: string | null;
  createdAt: string;
}

// ── Mobility Intelligence ────────────────────────────────────

export interface HeatmapCell {
  id: string;
  grid_lat: number;
  grid_lng: number;
  total_sessions: number;
  total_energy_kwh: number;
  unique_users: number;
  avg_session_duration_min: number;
  station_count: number;
  total_slots: number;
  avg_occupancy_pct: number;
  demand_intensity: number;
  infrastructure_gap_score: number;
  period_start: string;
  period_end: string;
}

export interface HeatmapResponse {
  cells: HeatmapCell[];
  count: number;
}

export interface BehaviorStats {
  id: string;
  city: string;
  stat_date: string;
  avg_session_duration_min: number;
  median_session_duration_min: number;
  p90_session_duration_min: number;
  level1_sessions: number;
  level2_sessions: number;
  dc_fast_sessions: number;
  peak_hour: number | null;
  off_peak_hour: number | null;
  morning_sessions: number;
  afternoon_sessions: number;
  evening_sessions: number;
  night_sessions: number;
  avg_energy_kwh: number;
  avg_start_soc: number;
  avg_end_soc: number;
  total_sessions: number;
  unique_users: number;
  repeat_users: number;
}

export interface BehaviorStatsResponse {
  stats: BehaviorStats[];
  count: number;
}

export interface CityEvTrend {
  id: string;
  city: string;
  stat_month: string;
  total_users: number;
  new_users: number;
  active_users: number;
  total_sessions: number;
  total_energy_kwh: number;
  total_revenue: number;
  total_stations: number;
  total_slots: number;
  new_stations: number;
  total_carbon_saved_kg: number;
  user_growth_pct: number;
  session_growth_pct: number;
  energy_growth_pct: number;
}

export interface CityTrendsResponse {
  trends: CityEvTrend[];
  count: number;
}

export interface InfraRecommendation {
  id: string;
  latitude: number;
  longitude: number;
  city: string;
  area_description: string;
  overall_score: number;
  demand_score: number;
  coverage_gap_score: number;
  traffic_score: number;
  recommended_slots: number;
  recommended_charger_types: string[];
  estimated_daily_sessions: number;
  nearest_station_km: number | null;
  avg_demand_in_area: number;
  population_density_score: number;
  reason: string;
  status: 'proposed' | 'approved' | 'rejected' | 'built';
  created_at: string;
}

export interface InfraRecommendationsResponse {
  recommendations: InfraRecommendation[];
  count: number;
}

export interface CitySummary {
  city: string;
  recommendations: Array<{ status: string; count: number; avg_score: number }>;
  infrastructure: { total_stations: number; total_slots: number };
  demand: { avg_demand: number; avg_gap_score: number; total_sessions: number };
}

// ── Battery Health Prediction ────────────────────────────────

export interface BatteryHealthProfile {
  id: string;
  vehicleName: string;
  batteryCapacityKwh: number;
  originalCapacityKwh: number;
  manufactureYear: number | null;
  healthPct: number;
  estimatedRangeKm: number | null;
  totalCycles: number;
  totalEnergyThroughputKwh: number;
  degradationRatePctPerYear: number;
  estimatedYearsTo80Pct: number | null;
  calendarAgeMonths: number;
}

export interface ChargingPatterns {
  totalSessions: number;
  fastChargeSessions: number;
  normalChargeSessions: number;
  fastChargePct: number;
  avgDepthOfDischarge: number;
  avgStartSoc: number;
  avgEndSoc: number;
  avgSessionTempCelsius: number | null;
  deepDischargeCount: number;
  overchargeCount: number;
  lastSessionAt: string | null;
}

export interface HealthSnapshot {
  date: string;
  healthPct: number;
  totalCycles: number;
  degradationRate: number;
  riskScore: number;
  fastChargePct: number;
}

export interface HealthRecommendation {
  id: string;
  category: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  potentialHealthImpactPct: number;
  createdAt: string;
}

export interface BatteryHealthResponse {
  profile: BatteryHealthProfile | null;
  chargingPatterns: ChargingPatterns | null;
  healthHistory: HealthSnapshot[];
  recommendations: HealthRecommendation[];
  message?: string;
}

// ── Predictive Scheduling ────────────────────────────────────

export interface ScheduleCandidate {
  stationId: string;
  stationName: string;
  stationAddress: string;
  stationCity: string;
  distanceKm: number;
  totalSlots: number;
  slotId: string | null;
  slotNumber: number | null;
  chargingType: string | null;
  powerOutputKw: number | null;
  recommendedStart: string;
  recommendedEnd: string;
  hour: number;
  predictedWaitMin: number;
  predictedOccupancyPct: number;
  congestionLevel: string;
  confidence: number;
  score: number;
  reason: string;
}

export interface ScheduleSearchParams {
  date: string;
  durationMin: number;
  flexibilityHours: number;
  preferredStartHour: number;
  stationsSearched: number;
  candidatesEvaluated: number;
}

export interface ScheduleResponse {
  recommendation: ScheduleCandidate | null;
  alternatives: ScheduleCandidate[];
  searchParams?: ScheduleSearchParams;
  message: string;
}

// ── Range Safety Assistant ────────────────────────────────────

export interface VehicleRangeProfile {
  id: string;
  userId: string;
  vehicleName: string;
  batteryCapacityKwh: number;
  currentBatteryPct: number;
  efficiencyKwhPerKm: number;
  drivingStyle: 'eco' | 'normal' | 'sport';
  climateControlOn: boolean;
  avgSpeedKmh: number;
  lastLatitude: number | null;
  lastLongitude: number | null;
  lastLocationUpdatedAt: string | null;
  estimatedRangeKm: number | null;
}

export interface RangeEstimate {
  baseRangeKm: number;
  adjustedRangeKm: number;
  safeRangeKm: number;
  batteryPct: number;
  capacityKwh: number;
  efficiencyKwhPerKm: number;
  modifiers: {
    style: { factor: string; multiplier: number };
    climate: { active: boolean; multiplier: number };
    speed: { avgKmh: number; multiplier: number };
  };
}

export interface RangeAlert {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  battery_pct_at_alert?: number;
  estimated_range_km?: number;
  nearest_station_km?: number;
  station_name?: string;
  is_read: boolean;
  created_at: string;
}

export interface NearbyStationRange {
  id: string;
  name: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  distance_km: number;
  available_slots: number;
  total_slots: number;
  max_power_kw: number | null;
  pricing_per_kwh: number | null;
  rating: number;
}

export interface RangeAssessment {
  profile: VehicleRangeProfile;
  range: RangeEstimate;
  nearbyStations: NearbyStationRange[];
  alerts: Array<{ type: string; severity: string; title: string; message: string }>;
  status: 'safe' | 'warning' | 'critical' | 'no_location';
}

export interface TripSafetyResult {
  tripDistanceKm: number;
  estimatedRangeKm: number;
  rangeBufferKm: number;
  safetyMarginPct: number;
  isSafe: boolean;
  status: 'safe' | 'tight' | 'unsafe';
  suggestedStop: NearbyStationRange | null;
  destinationStations: NearbyStationRange[];
  alerts: Array<{ type: string; severity: string; title: string; message: string }>;
  range: RangeEstimate;
  profile: VehicleRangeProfile;
}

// ── Community Reviews & Reliability ──────────────────────────

export interface StationReview {
  id: string;
  userId: string;
  stationId: string;
  userName: string | null;
  avatarUrl: string | null;
  stationName: string | null;
  stationAddress: string | null;
  stationCity: string | null;
  rating: number;
  chargingSpeedRating: number | null;
  reliabilityRating: number | null;
  cleanlinessRating: number | null;
  waitTimeRating: number | null;
  comment: string | null;
  wouldRecommend: boolean;
  visitDate: string | null;
  chargingTypeUsed: string | null;
  helpfulCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface StationReviewsResponse {
  reviews: StationReview[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ReliabilityScore {
  stationId: string;
  stationName: string | null;
  address: string | null;
  city: string | null;
  stationRating: number | null;
  avgOverallRating: number;
  avgChargingSpeedRating: number;
  avgReliabilityRating: number;
  avgCleanlinessRating: number;
  avgWaitTimeRating: number;
  reliabilityScore: number;
  uptimeScore: number;
  reviewConsistencyScore: number;
  recommendationRate: number;
  totalReviews: number;
  reviewsLast30Days: number;
  fiveStarCount: number;
  oneStarCount: number;
  ratingDistribution: Record<string, number>;
  trend: 'improving' | 'stable' | 'declining';
  trendDelta: number;
  lastCalculatedAt: string;
}

export interface CreateReviewData {
  rating: number;
  chargingSpeedRating?: number;
  reliabilityRating?: number;
  cleanlinessRating?: number;
  waitTimeRating?: number;
  comment?: string;
  wouldRecommend?: boolean;
  visitDate?: string;
  chargingTypeUsed?: string;
}

// ── Gamification & Rewards ───────────────────────────────────

export interface PointsWallet {
  userId: string;
  totalPoints: number;
  lifetimePoints: number;
  level: number;
  levelName: string;
  currentStreak: number;
  longestStreak: number;
  totalSessionsRewarded: number;
  totalOffPeakSessions: number;
  totalGreenSessions: number;
  totalEnergySharedKwh: number;
  lastActivityAt: string | null;
}

export interface LevelInfo {
  current: { level: number; name: string; min: number };
  next: { level: number; name: string; min: number } | null;
  progressPct: number;
}

export interface Badge {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: 'eco' | 'streak' | 'social' | 'explorer' | 'power' | 'milestone';
  criteriaType: string;
  criteriaThreshold: number;
  pointsReward: number;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  earned: boolean;
  earnedAt: string | null;
  isFeatured: boolean;
}

export interface Reward {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: 'discount' | 'reservation' | 'partner' | 'cosmetic';
  pointsCost: number;
  discountPct: number | null;
  discountMaxAmount: number | null;
  validDays: number;
  totalRedeemed: number;
  isActive: boolean;
}

export interface RewardRedemption {
  id: string;
  rewardName: string | null;
  rewardDescription: string | null;
  rewardCategory: string | null;
  discountPct: number | null;
  pointsSpent: number;
  status: 'active' | 'used' | 'expired' | 'cancelled';
  code: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
}

export interface PointsTransaction {
  id: string;
  points: number;
  balanceAfter: number;
  type: string;
  description: string;
  referenceId: string | null;
  referenceType: string | null;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface WalletSummary {
  wallet: PointsWallet;
  level: LevelInfo;
  badges: Badge[];
  activeRedemptions: RewardRedemption[];
  recentTransactions: PointsTransaction[];
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  avatarUrl: string | null;
  lifetimePoints: number;
  level: number;
  levelName: string;
  badgeCount: number;
  currentStreak: number;
  longestStreak: number;
}

export interface SchedulingPreferences {
  id: string;
  user_id: string;
  preferred_start_hour: number;
  preferred_end_hour: number;
  preferred_days: number[];
  default_duration_min: number;
  max_wait_min: number;
  prefer_fast_charging: boolean;
  home_latitude: number | null;
  home_longitude: number | null;
  max_distance_km: number;
  favorite_station_ids: string[];
}

// ── Payments ────────────────────────────────────────────────

export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';

export interface Payment {
  id: string;
  userId: string;
  reservationId: string | null;
  sessionId: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentMethod: string;
  provider: string;
  providerPaymentId: string | null;
  providerRefundId: string | null;
  metadata: Record<string, any>;
  paidAt: string | null;
  refundedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CostEstimateResponse {
  estimatedEnergy: number;
  pricePerKwh: number;
  estimatedCost: number;
  currency: string;
}

// ── Plug & Charge ───────────────────────────────────────────

export interface PlugChargeVehicle {
  id: string;
  userId: string;
  vehicleId: string;
  vehicleName: string | null;
  connectorType: ConnectorType | null;
  batteryCapacityKwh: number;
  defaultTargetPercentage: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlugEventResult {
  success: boolean;
  autoStarted?: boolean;
  session?: ChargingSession;
  vehicle?: PlugChargeVehicle;
  reservationId?: string;
  reason?: string;
  message: string;
}

// ── ETA-Based Prediction ────────────────────────────────────

export interface ArrivalPrediction {
  available: boolean;
  availableSlots: number;
  etaMinutes: number;
  arrivalTime: string;
  arrivalDemandFactor: number;
  slotsAvailableAtArrival: number;
  bestSlotForArrival: {
    slotNumber: number;
    slotId: string;
    availableInMinutes: number;
    bufferMinutes: number;
    confidence: number;
    source: string;
  } | null;
  allPredictions: SlotPrediction[];
  queueDepth: number;
  recommendation: string;
}

// ── Favorites ──────────────────────────────────────────────
export interface Favorite {
  id: string;
  user_id: string;
  station_id: string;
  created_at: string;
  station_name?: string;
  station_address?: string;
  station_city?: string;
  station_status?: string;
  total_slots?: number;
  available_slots?: number;
}

export interface FavoriteStatus {
  isFavorited: boolean;
  totalFavorites: number;
}

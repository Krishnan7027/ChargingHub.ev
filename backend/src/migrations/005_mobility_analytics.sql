-- ============================================================
-- Migration 005: Mobility Intelligence Platform
-- Adds: city-level analytics, infrastructure planning,
--       charging behavior aggregation, heatmap support
-- ============================================================

-- ── City Charging Heatmap Data ────────────────────────────────
-- Aggregated grid cells for heatmap visualization
CREATE TABLE IF NOT EXISTS charging_heatmap_cells (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Grid cell (0.01° ≈ 1.1 km resolution)
  grid_lat DECIMAL(9,4) NOT NULL,
  grid_lng DECIMAL(9,4) NOT NULL,
  -- Demand metrics
  total_sessions INT NOT NULL DEFAULT 0,
  total_energy_kwh DECIMAL(12,2) NOT NULL DEFAULT 0,
  unique_users INT NOT NULL DEFAULT 0,
  avg_session_duration_min DECIMAL(8,2) NOT NULL DEFAULT 0,
  -- Infrastructure metrics
  station_count INT NOT NULL DEFAULT 0,
  total_slots INT NOT NULL DEFAULT 0,
  avg_occupancy_pct DECIMAL(5,2) NOT NULL DEFAULT 0,
  -- Demand level
  demand_intensity DECIMAL(8,2) NOT NULL DEFAULT 0,   -- sessions per slot
  infrastructure_gap_score DECIMAL(5,2) NOT NULL DEFAULT 0, -- 0=well served, 100=underserved
  -- Time window
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(grid_lat, grid_lng, period_start)
);

CREATE INDEX idx_heatmap_grid ON charging_heatmap_cells(grid_lat, grid_lng);
CREATE INDEX idx_heatmap_period ON charging_heatmap_cells(period_start, period_end);
CREATE INDEX idx_heatmap_demand ON charging_heatmap_cells(demand_intensity DESC);

-- ── Infrastructure Planning Recommendations ───────────────────
CREATE TABLE IF NOT EXISTS infrastructure_recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Location
  latitude DECIMAL(10,6) NOT NULL,
  longitude DECIMAL(10,6) NOT NULL,
  city VARCHAR(100),
  area_description VARCHAR(300),
  -- Scoring
  overall_score DECIMAL(5,2) NOT NULL DEFAULT 0,  -- 0-100
  demand_score DECIMAL(5,2) NOT NULL DEFAULT 0,
  coverage_gap_score DECIMAL(5,2) NOT NULL DEFAULT 0,
  traffic_score DECIMAL(5,2) NOT NULL DEFAULT 0,
  -- Recommendation details
  recommended_slots INT NOT NULL DEFAULT 4,
  recommended_charger_types VARCHAR(100)[] DEFAULT ARRAY['dc_fast', 'level2'],
  estimated_daily_sessions INT DEFAULT 0,
  -- Context
  nearest_station_km DECIMAL(8,2) DEFAULT NULL,
  avg_demand_in_area DECIMAL(8,2) DEFAULT NULL,
  population_density_score DECIMAL(5,2) DEFAULT 0,
  reason TEXT,
  -- Status
  status VARCHAR(15) NOT NULL DEFAULT 'proposed',  -- proposed, approved, rejected, built
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_infra_rec_location ON infrastructure_recommendations USING gist (ll_to_earth(latitude, longitude));
CREATE INDEX idx_infra_rec_score ON infrastructure_recommendations(overall_score DESC);
CREATE INDEX idx_infra_rec_status ON infrastructure_recommendations(status);

CREATE TRIGGER update_infrastructure_recommendations_updated_at
  BEFORE UPDATE ON infrastructure_recommendations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Charging Behavior Aggregates ──────────────────────────────
-- Pre-computed behavior analytics per city per period
CREATE TABLE IF NOT EXISTS charging_behavior_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  city VARCHAR(100) NOT NULL,
  stat_date DATE NOT NULL,
  -- Duration metrics
  avg_session_duration_min DECIMAL(8,2) DEFAULT 0,
  median_session_duration_min DECIMAL(8,2) DEFAULT 0,
  p90_session_duration_min DECIMAL(8,2) DEFAULT 0,
  -- Charging type distribution
  level1_sessions INT DEFAULT 0,
  level2_sessions INT DEFAULT 0,
  dc_fast_sessions INT DEFAULT 0,
  -- Time distribution
  peak_hour INT DEFAULT NULL,
  off_peak_hour INT DEFAULT NULL,
  morning_sessions INT DEFAULT 0,     -- 6-12
  afternoon_sessions INT DEFAULT 0,   -- 12-18
  evening_sessions INT DEFAULT 0,     -- 18-24
  night_sessions INT DEFAULT 0,       -- 0-6
  -- Energy metrics
  avg_energy_kwh DECIMAL(10,2) DEFAULT 0,
  avg_start_soc DECIMAL(5,2) DEFAULT 0,
  avg_end_soc DECIMAL(5,2) DEFAULT 0,
  -- Session counts
  total_sessions INT DEFAULT 0,
  unique_users INT DEFAULT 0,
  repeat_users INT DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(city, stat_date)
);

CREATE INDEX idx_behavior_city ON charging_behavior_stats(city);
CREATE INDEX idx_behavior_date ON charging_behavior_stats(stat_date);

-- ── City EV Adoption Trends ──────────────────────────────────
CREATE TABLE IF NOT EXISTS city_ev_trends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  city VARCHAR(100) NOT NULL,
  stat_month DATE NOT NULL,            -- first day of month
  -- Adoption metrics
  total_users INT DEFAULT 0,
  new_users INT DEFAULT 0,
  active_users INT DEFAULT 0,          -- users with >=1 session
  -- Charging metrics
  total_sessions INT DEFAULT 0,
  total_energy_kwh DECIMAL(12,2) DEFAULT 0,
  total_revenue DECIMAL(12,2) DEFAULT 0,
  -- Infrastructure metrics
  total_stations INT DEFAULT 0,
  total_slots INT DEFAULT 0,
  new_stations INT DEFAULT 0,
  -- Carbon metrics
  total_carbon_saved_kg DECIMAL(12,3) DEFAULT 0,
  -- Growth metrics (vs previous month)
  user_growth_pct DECIMAL(5,2) DEFAULT 0,
  session_growth_pct DECIMAL(5,2) DEFAULT 0,
  energy_growth_pct DECIMAL(5,2) DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(city, stat_month)
);

CREATE INDEX idx_city_trends_city ON city_ev_trends(city);
CREATE INDEX idx_city_trends_month ON city_ev_trends(stat_month);

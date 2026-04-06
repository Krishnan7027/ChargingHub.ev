-- ============================================================
-- Migration 003: Energy Intelligence Extension
-- Adds: battery digital twin, congestion prediction, grid load
--       balancing, carbon footprint tracking, energy optimization
-- ============================================================

-- ── Battery Digital Twin State ────────────────────────────────
-- Tracks real-time simulated battery state for each active session
CREATE TABLE IF NOT EXISTS battery_digital_twins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES charging_sessions(id) ON DELETE CASCADE,
  slot_id UUID NOT NULL REFERENCES charging_slots(id) ON DELETE CASCADE,
  -- Battery state
  current_soc DECIMAL(5,2) NOT NULL DEFAULT 0,              -- state of charge %
  target_soc DECIMAL(5,2) NOT NULL DEFAULT 80,
  battery_capacity_kwh DECIMAL(8,2) NOT NULL DEFAULT 60,
  -- Thermal model
  battery_temp_celsius DECIMAL(5,1) NOT NULL DEFAULT 25.0,
  ambient_temp_celsius DECIMAL(5,1) NOT NULL DEFAULT 20.0,
  -- Charging dynamics
  current_power_kw DECIMAL(8,2) NOT NULL DEFAULT 0,
  max_power_kw DECIMAL(8,2) NOT NULL DEFAULT 50,
  charging_efficiency DECIMAL(5,3) NOT NULL DEFAULT 0.92,
  -- Degradation
  battery_health_pct DECIMAL(5,2) NOT NULL DEFAULT 100,
  cycle_count INT NOT NULL DEFAULT 0,
  estimated_degradation_pct DECIMAL(5,3) NOT NULL DEFAULT 0,
  -- Predictions
  estimated_minutes_remaining DECIMAL(8,1) DEFAULT NULL,
  estimated_completion_time TIMESTAMPTZ DEFAULT NULL,
  estimated_energy_total_kwh DECIMAL(8,2) DEFAULT NULL,
  -- Metadata
  simulation_step INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bdt_session ON battery_digital_twins(session_id);
CREATE INDEX idx_bdt_slot ON battery_digital_twins(slot_id);
CREATE INDEX idx_bdt_active ON battery_digital_twins(is_active) WHERE is_active = true;

CREATE TRIGGER update_battery_digital_twins_updated_at
  BEFORE UPDATE ON battery_digital_twins
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Congestion Predictions ────────────────────────────────────
-- Stores predicted congestion levels per station per hour
CREATE TABLE IF NOT EXISTS congestion_predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  predicted_for TIMESTAMPTZ NOT NULL,                         -- the hour being predicted
  congestion_level VARCHAR(10) NOT NULL DEFAULT 'low',        -- low, medium, high, critical
  predicted_occupancy_pct DECIMAL(5,2) DEFAULT 0,
  predicted_wait_minutes DECIMAL(8,1) DEFAULT 0,
  predicted_queue_length INT DEFAULT 0,
  confidence DECIMAL(3,2) DEFAULT 0.5,
  -- Factors that drove the prediction
  factors JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(station_id, predicted_for)
);

CREATE INDEX idx_congestion_station ON congestion_predictions(station_id);
CREATE INDEX idx_congestion_lookup ON congestion_predictions(station_id, predicted_for);

-- ── Grid Load Profiles ────────────────────────────────────────
-- Tracks power draw per station and enforces grid limits
CREATE TABLE IF NOT EXISTS grid_load_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  -- Grid constraints
  grid_capacity_kw DECIMAL(10,2) NOT NULL DEFAULT 500,       -- max grid capacity
  current_load_kw DECIMAL(10,2) NOT NULL DEFAULT 0,
  load_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
  -- Thresholds
  warning_threshold_pct DECIMAL(5,2) NOT NULL DEFAULT 70,
  critical_threshold_pct DECIMAL(5,2) NOT NULL DEFAULT 90,
  -- Status
  grid_status VARCHAR(15) NOT NULL DEFAULT 'normal',          -- normal, warning, critical, emergency
  load_balancing_active BOOLEAN NOT NULL DEFAULT false,
  -- Power allocation per slot (JSONB array)
  slot_allocations JSONB DEFAULT '[]',
  -- History snapshot
  peak_load_kw DECIMAL(10,2) DEFAULT 0,
  avg_load_kw DECIMAL(10,2) DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(station_id)
);

CREATE INDEX idx_grid_load_station ON grid_load_profiles(station_id);

CREATE TRIGGER update_grid_load_profiles_updated_at
  BEFORE UPDATE ON grid_load_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Carbon Footprint Records ──────────────────────────────────
-- Tracks CO2 avoided per charging session
CREATE TABLE IF NOT EXISTS carbon_footprint_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES charging_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  -- Energy metrics
  energy_kwh DECIMAL(10,3) NOT NULL DEFAULT 0,
  -- Carbon calculations
  grid_carbon_intensity_gco2_kwh DECIMAL(8,2) NOT NULL DEFAULT 400, -- gCO2/kWh for grid
  gasoline_co2_avoided_kg DECIMAL(10,3) NOT NULL DEFAULT 0,         -- vs ICE vehicle
  net_carbon_saved_kg DECIMAL(10,3) NOT NULL DEFAULT 0,
  -- Equivalencies
  trees_equivalent DECIMAL(8,2) NOT NULL DEFAULT 0,                  -- trees-year equiv
  miles_offset DECIMAL(10,2) NOT NULL DEFAULT 0,                     -- gasoline miles offset
  -- Source
  renewable_percentage DECIMAL(5,2) DEFAULT 0,                       -- % renewable in grid mix
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_carbon_session ON carbon_footprint_records(session_id);
CREATE INDEX idx_carbon_user ON carbon_footprint_records(user_id);
CREATE INDEX idx_carbon_station ON carbon_footprint_records(station_id);
CREATE INDEX idx_carbon_created ON carbon_footprint_records(created_at);

-- ── Energy Optimization Recommendations ───────────────────────
-- Stores optimization suggestions per station
CREATE TABLE IF NOT EXISTS energy_optimization_recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  recommendation_type VARCHAR(30) NOT NULL,                   -- load_shift, demand_redirect, schedule_optimize, power_reduce
  priority VARCHAR(10) NOT NULL DEFAULT 'medium',             -- low, medium, high, critical
  title VARCHAR(200) NOT NULL,
  description TEXT,
  -- Metrics
  estimated_savings_kwh DECIMAL(10,2) DEFAULT 0,
  estimated_cost_savings DECIMAL(10,2) DEFAULT 0,
  estimated_carbon_savings_kg DECIMAL(10,2) DEFAULT 0,
  -- State
  status VARCHAR(15) NOT NULL DEFAULT 'pending',              -- pending, accepted, rejected, expired
  expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_energy_opt_station ON energy_optimization_recommendations(station_id);
CREATE INDEX idx_energy_opt_status ON energy_optimization_recommendations(status);
CREATE INDEX idx_energy_opt_type ON energy_optimization_recommendations(recommendation_type);

CREATE TRIGGER update_energy_opt_updated_at
  BEFORE UPDATE ON energy_optimization_recommendations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Station Energy Summary (daily aggregation) ────────────────
-- Extends analytics with energy-intelligence metrics
CREATE TABLE IF NOT EXISTS station_energy_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  stat_date DATE NOT NULL,
  -- Energy metrics
  total_energy_kwh DECIMAL(10,2) DEFAULT 0,
  peak_power_kw DECIMAL(10,2) DEFAULT 0,
  avg_power_kw DECIMAL(10,2) DEFAULT 0,
  -- Carbon metrics
  total_carbon_saved_kg DECIMAL(10,3) DEFAULT 0,
  total_gasoline_avoided_kg DECIMAL(10,3) DEFAULT 0,
  -- Grid metrics
  max_grid_load_pct DECIMAL(5,2) DEFAULT 0,
  avg_grid_load_pct DECIMAL(5,2) DEFAULT 0,
  grid_warning_count INT DEFAULT 0,
  grid_critical_count INT DEFAULT 0,
  -- Efficiency metrics
  avg_charging_efficiency DECIMAL(5,3) DEFAULT 0,
  total_energy_lost_kwh DECIMAL(10,2) DEFAULT 0,
  -- Congestion
  avg_wait_minutes DECIMAL(8,2) DEFAULT 0,
  max_queue_length INT DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(station_id, stat_date)
);

CREATE INDEX idx_energy_stats_station ON station_energy_stats(station_id);
CREATE INDEX idx_energy_stats_date ON station_energy_stats(stat_date);
CREATE INDEX idx_energy_stats_lookup ON station_energy_stats(station_id, stat_date);

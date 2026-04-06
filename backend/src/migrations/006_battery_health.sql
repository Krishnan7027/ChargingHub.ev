-- ============================================================
-- Migration 006: AI Battery Health Prediction System
-- Adds: per-user battery profiles, health snapshots,
--       charging pattern analysis, health recommendations
-- ============================================================

-- ── User Battery Profiles ───────────────────────────────────────
-- One per user — stores vehicle/battery metadata and current health
CREATE TABLE IF NOT EXISTS battery_health_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Vehicle info
  vehicle_name VARCHAR(100) DEFAULT 'My EV',
  battery_capacity_kwh DECIMAL(8,2) NOT NULL DEFAULT 60,
  original_capacity_kwh DECIMAL(8,2) NOT NULL DEFAULT 60,
  manufacture_year INT DEFAULT NULL,
  -- Current health state
  health_pct DECIMAL(5,2) NOT NULL DEFAULT 100,
  estimated_range_km DECIMAL(8,1) DEFAULT NULL,
  total_cycles DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_energy_throughput_kwh DECIMAL(12,2) NOT NULL DEFAULT 0,
  -- Degradation model
  degradation_rate_pct_per_year DECIMAL(6,3) NOT NULL DEFAULT 0,
  estimated_years_to_80_pct DECIMAL(6,1) DEFAULT NULL,
  calendar_age_months INT DEFAULT 0,
  -- Charging pattern summary
  total_sessions INT NOT NULL DEFAULT 0,
  fast_charge_sessions INT NOT NULL DEFAULT 0,
  normal_charge_sessions INT NOT NULL DEFAULT 0,
  avg_depth_of_discharge DECIMAL(5,2) NOT NULL DEFAULT 0,
  avg_start_soc DECIMAL(5,2) NOT NULL DEFAULT 0,
  avg_end_soc DECIMAL(5,2) NOT NULL DEFAULT 0,
  avg_session_temp_celsius DECIMAL(5,1) DEFAULT NULL,
  deep_discharge_count INT NOT NULL DEFAULT 0,       -- sessions starting below 10%
  overcharge_count INT NOT NULL DEFAULT 0,            -- sessions ending above 95%
  -- Timestamps
  last_session_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX idx_bhp_user ON battery_health_profiles(user_id);
CREATE INDEX idx_bhp_health ON battery_health_profiles(health_pct);

CREATE TRIGGER update_battery_health_profiles_updated_at
  BEFORE UPDATE ON battery_health_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Battery Health Snapshots ────────────────────────────────────
-- Periodic snapshots for tracking health over time (trend charts)
CREATE TABLE IF NOT EXISTS battery_health_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES battery_health_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Snapshot data
  snapshot_date DATE NOT NULL,
  health_pct DECIMAL(5,2) NOT NULL,
  total_cycles DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_energy_kwh DECIMAL(12,2) NOT NULL DEFAULT 0,
  degradation_rate DECIMAL(6,3) NOT NULL DEFAULT 0,
  -- Session stats for this period
  sessions_in_period INT NOT NULL DEFAULT 0,
  fast_charge_pct DECIMAL(5,2) NOT NULL DEFAULT 0,
  avg_depth_of_discharge DECIMAL(5,2) NOT NULL DEFAULT 0,
  avg_temp_celsius DECIMAL(5,1) DEFAULT NULL,
  -- Risk factors active at snapshot time
  risk_score DECIMAL(5,2) NOT NULL DEFAULT 0,  -- 0=healthy, 100=critical
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(profile_id, snapshot_date)
);

CREATE INDEX idx_bhs_profile ON battery_health_snapshots(profile_id);
CREATE INDEX idx_bhs_date ON battery_health_snapshots(snapshot_date);
CREATE INDEX idx_bhs_user ON battery_health_snapshots(user_id);

-- ── Battery Health Recommendations ──────────────────────────────
-- AI-generated personalized recommendations
CREATE TABLE IF NOT EXISTS battery_health_recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES battery_health_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Recommendation details
  category VARCHAR(30) NOT NULL,   -- charging_speed, depth_of_discharge, temperature, schedule, general
  severity VARCHAR(15) NOT NULL DEFAULT 'info',  -- info, warning, critical
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  -- Impact estimate
  potential_health_impact_pct DECIMAL(5,2) DEFAULT 0,  -- how much health could improve
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  dismissed_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bhr_profile ON battery_health_recommendations(profile_id);
CREATE INDEX idx_bhr_user ON battery_health_recommendations(user_id);
CREATE INDEX idx_bhr_active ON battery_health_recommendations(is_active);

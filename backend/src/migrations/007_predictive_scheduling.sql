-- ============================================================
-- Migration 007: Predictive Charging Scheduling
-- Adds: schedule recommendations, user scheduling preferences,
--       optimized reservation suggestions
-- ============================================================

-- ── Schedule Recommendations ────────────────────────────────────
-- AI-generated optimal time-slot suggestions per user request
CREATE TABLE IF NOT EXISTS schedule_recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Request parameters
  requested_station_id UUID REFERENCES stations(id) ON DELETE SET NULL,
  requested_date DATE NOT NULL,
  charging_duration_min INT NOT NULL DEFAULT 60,
  flexibility_hours INT NOT NULL DEFAULT 4,
  preferred_start_hour INT DEFAULT NULL,
  -- Best recommendation
  recommended_station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  recommended_slot_id UUID REFERENCES charging_slots(id) ON DELETE SET NULL,
  recommended_start TIMESTAMPTZ NOT NULL,
  recommended_end TIMESTAMPTZ NOT NULL,
  -- Prediction metrics
  predicted_wait_min DECIMAL(6,1) NOT NULL DEFAULT 0,
  predicted_occupancy_pct DECIMAL(5,1) NOT NULL DEFAULT 0,
  congestion_level VARCHAR(10) NOT NULL DEFAULT 'low',
  confidence DECIMAL(4,2) NOT NULL DEFAULT 0.5,
  score DECIMAL(6,2) NOT NULL DEFAULT 0,
  -- Context
  reason TEXT,
  alternatives_count INT NOT NULL DEFAULT 0,
  -- Status
  status VARCHAR(15) NOT NULL DEFAULT 'suggested',  -- suggested, accepted, expired
  accepted_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sr_user ON schedule_recommendations(user_id);
CREATE INDEX idx_sr_station ON schedule_recommendations(recommended_station_id);
CREATE INDEX idx_sr_date ON schedule_recommendations(requested_date);
CREATE INDEX idx_sr_status ON schedule_recommendations(status);

-- ── User Scheduling Preferences ─────────────────────────────────
CREATE TABLE IF NOT EXISTS scheduling_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Preferred times
  preferred_start_hour INT DEFAULT 8,    -- earliest acceptable hour
  preferred_end_hour INT DEFAULT 22,     -- latest acceptable hour
  preferred_days INT[] DEFAULT ARRAY[1,2,3,4,5,6,0],  -- DOW (0=Sun)
  -- Charging preferences
  default_duration_min INT NOT NULL DEFAULT 60,
  max_wait_min INT NOT NULL DEFAULT 15,
  prefer_fast_charging BOOLEAN DEFAULT false,
  -- Location
  home_latitude DECIMAL(10,6) DEFAULT NULL,
  home_longitude DECIMAL(10,6) DEFAULT NULL,
  max_distance_km DECIMAL(6,1) DEFAULT 25,
  -- Favorite stations
  favorite_station_ids UUID[] DEFAULT ARRAY[]::UUID[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX idx_sp_user ON scheduling_preferences(user_id);

CREATE TRIGGER update_scheduling_preferences_updated_at
  BEFORE UPDATE ON scheduling_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Migration 008: EV Range Safety Assistant
-- Tables for vehicle profiles, range alerts, and trip safety checks

-- Vehicle range profiles — per-user vehicle efficiency and battery info
CREATE TABLE IF NOT EXISTS vehicle_range_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vehicle_name VARCHAR(120) DEFAULT 'My EV',
  battery_capacity_kwh NUMERIC(6,2) DEFAULT 60,
  current_battery_pct NUMERIC(5,2) DEFAULT 80,
  efficiency_kwh_per_km NUMERIC(6,4) DEFAULT 0.18,
  -- derived from efficiency: range = (battery_pct/100) * capacity / efficiency
  estimated_range_km NUMERIC(8,2) GENERATED ALWAYS AS (
    (current_battery_pct / 100.0) * battery_capacity_kwh / NULLIF(efficiency_kwh_per_km, 0)
  ) STORED,
  -- driver behaviour modifiers
  driving_style VARCHAR(20) DEFAULT 'normal' CHECK (driving_style IN ('eco', 'normal', 'sport')),
  climate_control_on BOOLEAN DEFAULT false,
  avg_speed_kmh NUMERIC(5,1) DEFAULT 60,
  -- location for proximity searches
  last_latitude NUMERIC(9,6),
  last_longitude NUMERIC(9,6),
  last_location_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Range alert log — tracks alerts sent to users
CREATE TABLE IF NOT EXISTS range_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES vehicle_range_profiles(id) ON DELETE SET NULL,
  alert_type VARCHAR(30) NOT NULL CHECK (alert_type IN ('low_range', 'critical_range', 'no_station_in_range', 'station_suggested', 'trip_unsafe')),
  severity VARCHAR(12) NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  battery_pct_at_alert NUMERIC(5,2),
  estimated_range_km NUMERIC(8,2),
  nearest_station_km NUMERIC(8,2),
  nearest_station_id UUID REFERENCES stations(id) ON DELETE SET NULL,
  suggested_stations JSONB DEFAULT '[]',
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trip safety checks — records of trip range feasibility analyses
CREATE TABLE IF NOT EXISTS trip_safety_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  origin_lat NUMERIC(9,6) NOT NULL,
  origin_lng NUMERIC(9,6) NOT NULL,
  destination_lat NUMERIC(9,6) NOT NULL,
  destination_lng NUMERIC(9,6) NOT NULL,
  trip_distance_km NUMERIC(8,2) NOT NULL,
  battery_pct_at_start NUMERIC(5,2) NOT NULL,
  estimated_range_km NUMERIC(8,2) NOT NULL,
  range_buffer_km NUMERIC(8,2),
  is_safe BOOLEAN NOT NULL,
  safety_margin_pct NUMERIC(5,1),
  recommended_charge_stop BOOLEAN DEFAULT false,
  suggested_station_id UUID REFERENCES stations(id) ON DELETE SET NULL,
  suggested_station_name VARCHAR(200),
  suggested_station_distance_km NUMERIC(8,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_range_alerts_user ON range_alerts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_range_alerts_unread ON range_alerts(user_id, is_read) WHERE NOT is_read;
CREATE INDEX IF NOT EXISTS idx_trip_safety_user ON trip_safety_checks(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_range_profiles_user ON vehicle_range_profiles(user_id);

-- ============================================================
-- Migration 002: Intelligent Features Extension
-- Adds: dynamic pricing, demand forecasting, analytics support
-- ============================================================

-- ── Dynamic Pricing Rules ───────────────────────────────────
CREATE TABLE IF NOT EXISTS pricing_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  price_per_kwh DECIMAL(10,2) NOT NULL CHECK (price_per_kwh >= 0),
  day_of_week INT[] DEFAULT NULL,                  -- 0=Sun..6=Sat, NULL=all days
  start_time TIME NOT NULL DEFAULT '00:00',
  end_time TIME NOT NULL DEFAULT '23:59',
  priority INT NOT NULL DEFAULT 0,                 -- higher wins when rules overlap
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pricing_rules_station ON pricing_rules(station_id);
CREATE INDEX idx_pricing_rules_active ON pricing_rules(station_id, is_active);

CREATE TRIGGER update_pricing_rules_updated_at
  BEFORE UPDATE ON pricing_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Station Demand Forecast Cache ───────────────────────────
CREATE TABLE IF NOT EXISTS demand_forecasts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  hour_of_day INT NOT NULL CHECK (hour_of_day BETWEEN 0 AND 23),
  avg_occupancy_rate DECIMAL(5,2) DEFAULT 0,       -- 0-100 percentage
  avg_reservations DECIMAL(8,2) DEFAULT 0,
  avg_sessions DECIMAL(8,2) DEFAULT 0,
  avg_wait_minutes DECIMAL(8,2) DEFAULT 0,
  sample_count INT DEFAULT 0,
  demand_level VARCHAR(10) DEFAULT 'low',          -- low, medium, high
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(station_id, day_of_week, hour_of_day)
);

CREATE INDEX idx_demand_forecasts_station ON demand_forecasts(station_id);
CREATE INDEX idx_demand_forecasts_lookup ON demand_forecasts(station_id, day_of_week);

-- ── Route Plans (saved trip plans) ──────────────────────────
CREATE TABLE IF NOT EXISTS route_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(200),
  start_location JSONB NOT NULL,                   -- { lat, lng, address }
  end_location JSONB NOT NULL,                     -- { lat, lng, address }
  vehicle_range_km DECIMAL(8,2) NOT NULL,
  battery_percentage DECIMAL(5,2) NOT NULL,
  total_distance_km DECIMAL(10,2),
  charging_stops JSONB NOT NULL DEFAULT '[]',      -- array of stop objects
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_route_plans_user ON route_plans(user_id);

-- ── Analytics: daily station summaries ──────────────────────
CREATE TABLE IF NOT EXISTS station_daily_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  stat_date DATE NOT NULL,
  total_sessions INT DEFAULT 0,
  total_reservations INT DEFAULT 0,
  total_energy_kwh DECIMAL(10,2) DEFAULT 0,
  total_revenue DECIMAL(10,2) DEFAULT 0,
  avg_session_duration_min DECIMAL(8,2) DEFAULT 0,
  peak_hour INT DEFAULT NULL,                       -- hour with most sessions
  unique_users INT DEFAULT 0,
  avg_occupancy_rate DECIMAL(5,2) DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(station_id, stat_date)
);

CREATE INDEX idx_station_daily_stats_station ON station_daily_stats(station_id);
CREATE INDEX idx_station_daily_stats_date ON station_daily_stats(stat_date);
CREATE INDEX idx_station_daily_stats_lookup ON station_daily_stats(station_id, stat_date);

-- ── Add vehicle info columns to support route planning ──────
ALTER TABLE charging_sessions
  ADD COLUMN IF NOT EXISTS vehicle_battery_capacity_kwh DECIMAL(8,2) DEFAULT NULL;

-- ── Seed default pricing rules for existing stations ────────
INSERT INTO pricing_rules (station_id, name, price_per_kwh, start_time, end_time, priority)
SELECT id, 'Standard Rate', COALESCE(pricing_per_kwh, 0.30), '00:00', '23:59', 0
FROM stations
WHERE NOT EXISTS (SELECT 1 FROM pricing_rules WHERE pricing_rules.station_id = stations.id)
ON CONFLICT DO NOTHING;

-- Migration 017: OTP support and EV vehicles table

-- Add mobile column to users for OTP-based mobile login
ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile VARCHAR(15);

-- EV Vehicles table
CREATE TABLE IF NOT EXISTS ev_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  brand VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  battery_capacity_kwh DECIMAL(6,2),
  range_km INTEGER,
  fast_charging BOOLEAN DEFAULT false,
  charging_port_type VARCHAR(50),
  image_url TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ev_vehicles_user_id ON ev_vehicles(user_id);

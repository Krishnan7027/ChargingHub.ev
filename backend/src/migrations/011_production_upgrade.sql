-- ═══════════════════════════════════════════════════════════════
-- Migration 011: Production Upgrade
-- Adds: payments, plug_charge_vehicles, event_logs
-- ═══════════════════════════════════════════════════════════════

-- ── Payments ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  reservation_id UUID REFERENCES reservations(id),
  session_id UUID REFERENCES charging_sessions(id),
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending','processing','completed','failed','refunded')),
  payment_method VARCHAR(30) DEFAULT 'card',
  provider VARCHAR(20) DEFAULT 'mock'
    CHECK (provider IN ('mock','stripe','razorpay')),
  provider_payment_id VARCHAR(255),
  provider_refund_id VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  paid_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_reservation_id ON payments(reservation_id);
CREATE INDEX IF NOT EXISTS idx_payments_session_id ON payments(session_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);

CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Plug & Charge Vehicles ──────────────────────────────────
CREATE TABLE IF NOT EXISTS plug_charge_vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  vehicle_id VARCHAR(100) NOT NULL UNIQUE,
  vehicle_name VARCHAR(100),
  connector_type VARCHAR(20),
  battery_capacity_kwh DECIMAL(6,1) DEFAULT 60,
  default_target_percentage INTEGER DEFAULT 80,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plug_charge_user_id ON plug_charge_vehicles(user_id);
CREATE INDEX IF NOT EXISTS idx_plug_charge_vehicle_id ON plug_charge_vehicles(vehicle_id);

CREATE TRIGGER update_plug_charge_vehicles_updated_at
  BEFORE UPDATE ON plug_charge_vehicles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Event Logs ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  actor_id UUID REFERENCES users(id),
  payload JSONB DEFAULT '{}',
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_logs_event_type ON event_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_event_logs_entity_id ON event_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_event_logs_processed ON event_logs(processed);
CREATE INDEX IF NOT EXISTS idx_event_logs_created_at ON event_logs(created_at DESC);

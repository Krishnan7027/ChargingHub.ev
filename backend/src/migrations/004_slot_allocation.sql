-- ============================================================
-- Migration 004: Autonomous Slot Allocation
-- Adds: queue management for smart slot assignment
-- ============================================================

CREATE TABLE IF NOT EXISTS slot_allocation_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  -- User EV params
  battery_percentage DECIMAL(5,2) NOT NULL DEFAULT 20,
  target_percentage DECIMAL(5,2) NOT NULL DEFAULT 80,
  battery_capacity_kwh DECIMAL(8,2) NOT NULL DEFAULT 60,
  connector_preference VARCHAR(20) DEFAULT NULL,
  charging_type_preference VARCHAR(20) DEFAULT NULL,
  -- Queue state
  queue_position INT NOT NULL DEFAULT 0,
  estimated_wait_minutes INT NOT NULL DEFAULT 30,
  status VARCHAR(15) NOT NULL DEFAULT 'waiting',   -- waiting, assigned, cancelled, expired
  assigned_slot_id UUID REFERENCES charging_slots(id) DEFAULT NULL,
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_saq_station ON slot_allocation_queue(station_id);
CREATE INDEX idx_saq_user ON slot_allocation_queue(user_id);
CREATE INDEX idx_saq_status ON slot_allocation_queue(station_id, status);
CREATE INDEX idx_saq_position ON slot_allocation_queue(station_id, queue_position) WHERE status = 'waiting';

CREATE TRIGGER update_slot_allocation_queue_updated_at
  BEFORE UPDATE ON slot_allocation_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

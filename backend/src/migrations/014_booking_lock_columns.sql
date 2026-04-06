-- =============================================
-- 014: Add slot-level booking lock columns
-- =============================================
-- Adds reserved_by (who holds the lock) and reserved_at (when it was locked)
-- to charging_slots. Enables TTL-based expiry of stale slot reservations
-- and prevents double-booking at the DB constraint level.

ALTER TABLE charging_slots
  ADD COLUMN reserved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN reserved_at TIMESTAMPTZ;

-- Partial unique index: only one active reservation per slot at a time.
-- Prevents double-booking even if application logic has a bug.
CREATE UNIQUE INDEX idx_slots_one_active_reservation
  ON charging_slots (id)
  WHERE status = 'reserved';

-- Index for TTL expiry scheduler to efficiently find expired slot reservations
CREATE INDEX idx_slots_reserved_at
  ON charging_slots (reserved_at)
  WHERE status = 'reserved' AND reserved_at IS NOT NULL;

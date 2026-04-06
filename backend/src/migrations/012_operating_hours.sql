-- ═══════════════════════════════════════════════════════════════
-- Migration 012: Operating Hours standardization
-- Sets default JSONB structure and backfills existing rows
-- ═══════════════════════════════════════════════════════════════

-- Set column default for new rows
ALTER TABLE stations
  ALTER COLUMN operating_hours SET DEFAULT '{"type": "ALWAYS_OPEN", "schedule": null}'::jsonb;

-- Backfill: convert NULL or legacy format to new structure
UPDATE stations
SET operating_hours = '{"type": "ALWAYS_OPEN", "schedule": null}'::jsonb
WHERE operating_hours IS NULL
   OR operating_hours::text = 'null'
   OR operating_hours::text = '{}'
   OR NOT (operating_hours ? 'type');

-- Set NOT NULL after backfill
ALTER TABLE stations
  ALTER COLUMN operating_hours SET NOT NULL;

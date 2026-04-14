-- 016: Station Ingestion — external source tracking
ALTER TABLE stations ADD COLUMN IF NOT EXISTS external_id VARCHAR(255) UNIQUE;
ALTER TABLE stations ADD COLUMN IF NOT EXISTS external_source VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_stations_external ON stations (external_id) WHERE external_id IS NOT NULL;

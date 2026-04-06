-- Performance optimization indexes
-- Addresses slow queries identified via benchmarking

-- Composite index for stations nearby query (status + geospatial filter)
CREATE INDEX IF NOT EXISTS idx_stations_status_location
  ON stations USING gist (ll_to_earth(latitude, longitude))
  WHERE status = 'approved';

-- Composite index for reservations/my (user_id + sort order)
CREATE INDEX IF NOT EXISTS idx_reservations_user_start
  ON reservations(user_id, scheduled_start DESC);

-- Composite index for charging_slots by station (eliminates correlated subqueries)
CREATE INDEX IF NOT EXISTS idx_charging_slots_station_status
  ON charging_slots(station_id, status);

-- Composite index for charging_sessions status + aggregates (admin stats)
CREATE INDEX IF NOT EXISTS idx_sessions_status_cost
  ON charging_sessions(status)
  INCLUDE (energy_delivered_kwh, cost);

-- Composite index for reliability leaderboard
CREATE INDEX IF NOT EXISTS idx_reliability_reviews_score
  ON station_reliability_scores(total_reviews, reliability_score DESC);

-- Index for station city lookups (mobility/cities endpoint)
CREATE INDEX IF NOT EXISTS idx_stations_status_city
  ON stations(status, city)
  WHERE city IS NOT NULL;

-- Audit logs query optimization
CREATE INDEX IF NOT EXISTS idx_audit_logs_created
  ON audit_logs(created_at DESC);

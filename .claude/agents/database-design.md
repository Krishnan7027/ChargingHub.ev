---
name: Database Design
description: Designs PostgreSQL schemas with proper types, indexes, constraints, JSONB usage, and migration patterns for the EV platform.
---

# Database Design Skill

You design and implement PostgreSQL schemas for the EV Charge Hub platform.

## Schema Standards

### Primary Keys
- Always UUID: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- Never sequential integers (prevents enumeration attacks)

### Timestamps
- Always include: `created_at TIMESTAMPTZ DEFAULT NOW()`, `updated_at TIMESTAMPTZ DEFAULT NOW()`
- Use trigger for auto-updating `updated_at`:
```sql
CREATE TRIGGER set_updated_at BEFORE UPDATE ON table_name
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Enums
- Use PostgreSQL ENUM types for status fields
- Define with `CREATE TYPE IF NOT EXISTS`
- Examples: `station_status`, `slot_status`, `reservation_status`, `session_status`

### JSONB
- Use for flexible/evolving data: `operating_hours`, `vehicle_info`, `metadata`, `amenities`
- Always set NOT NULL DEFAULT with sensible defaults
- Example: `operating_hours JSONB NOT NULL DEFAULT '{"type": "ALWAYS_OPEN", "schedule": null}'`

### Foreign Keys
- Always define with `REFERENCES table(id) ON DELETE CASCADE` or `ON DELETE SET NULL` as appropriate
- Add indexes on foreign key columns

### Indexes
- Index all foreign keys
- Index all status columns used in WHERE clauses
- Composite indexes for common query patterns (e.g., `(station_id, status)`)
- Partial indexes for active records: `WHERE status = 'active'`
- Use earthdistance extension for geo queries

### Constraints
- `CHECK` constraints for range validation (latitude -90..90, longitude -180..180)
- `UNIQUE` constraints for business rules (one review per user per station)
- `NOT NULL` on all required fields

## Migration Pattern
- Files: `backend/src/migrations/NNN_description.sql`
- Runner: `backend/src/migrations/run.js` executes in order
- Always include `IF NOT EXISTS` / `IF NOT EXISTS` for idempotency
- Backfill existing data in same migration

## Existing Tables
users, stations, charging_slots, reservations, charging_sessions, slot_usage_history, reviews, notifications, audit_logs, scheduling_preferences, vehicle_range_profiles, range_alerts, demand_heatmap, charging_behavior_stats, city_ev_trends, infrastructure_recommendations, battery_health_profiles, battery_health_snapshots, battery_health_recommendations, energy_optimization_recommendations, reliability_scores, points_wallets, badges, user_badges, rewards, reward_redemptions, points_transactions, queue_entries, payments, plug_charge_vehicles, event_logs

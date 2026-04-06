-- =============================================
-- EV Charging Platform - Database Schema
-- =============================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "cube";
CREATE EXTENSION IF NOT EXISTS "earthdistance";

-- =============================================
-- ENUM TYPES
-- =============================================

CREATE TYPE user_role AS ENUM ('customer', 'manager', 'admin');
CREATE TYPE station_status AS ENUM ('pending', 'approved', 'rejected', 'disabled');
CREATE TYPE slot_status AS ENUM ('available', 'occupied', 'reserved', 'maintenance');
CREATE TYPE charging_type AS ENUM ('level1', 'level2', 'dc_fast');
CREATE TYPE connector_type AS ENUM ('type1', 'type2', 'ccs', 'chademo', 'tesla');
CREATE TYPE reservation_status AS ENUM ('pending', 'confirmed', 'active', 'completed', 'cancelled', 'expired');
CREATE TYPE charging_session_status AS ENUM ('pending', 'charging', 'completed', 'failed');

-- =============================================
-- USERS TABLE
-- =============================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role user_role NOT NULL DEFAULT 'customer',
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    email_verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- =============================================
-- STATIONS TABLE
-- =============================================

CREATE TABLE stations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    manager_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100),
    zip_code VARCHAR(20),
    country VARCHAR(100) NOT NULL DEFAULT 'US',
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    status station_status NOT NULL DEFAULT 'pending',
    operating_hours JSONB NOT NULL DEFAULT '{"open": "00:00", "close": "23:59", "timezone": "UTC"}',
    amenities TEXT[] DEFAULT '{}',
    images TEXT[] DEFAULT '{}',
    pricing_per_kwh DECIMAL(10, 4),
    rating DECIMAL(3, 2) DEFAULT 0.00,
    total_reviews INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stations_manager ON stations(manager_id);
CREATE INDEX idx_stations_status ON stations(status);
CREATE INDEX idx_stations_city ON stations(city);
CREATE INDEX idx_stations_location ON stations USING gist (ll_to_earth(latitude, longitude));

-- =============================================
-- CHARGING SLOTS TABLE
-- =============================================

CREATE TABLE charging_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    slot_number INTEGER NOT NULL,
    charging_type charging_type NOT NULL,
    connector_type connector_type NOT NULL,
    power_output_kw DECIMAL(8, 2) NOT NULL,
    status slot_status NOT NULL DEFAULT 'available',
    current_session_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(station_id, slot_number)
);

CREATE INDEX idx_slots_station ON charging_slots(station_id);
CREATE INDEX idx_slots_status ON charging_slots(status);

-- =============================================
-- RESERVATIONS TABLE
-- =============================================

CREATE TABLE reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    slot_id UUID NOT NULL REFERENCES charging_slots(id) ON DELETE CASCADE,
    station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    status reservation_status NOT NULL DEFAULT 'pending',
    scheduled_start TIMESTAMPTZ NOT NULL,
    scheduled_end TIMESTAMPTZ NOT NULL,
    actual_start TIMESTAMPTZ,
    actual_end TIMESTAMPTZ,
    vehicle_info JSONB DEFAULT '{}',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reservations_user ON reservations(user_id);
CREATE INDEX idx_reservations_slot ON reservations(slot_id);
CREATE INDEX idx_reservations_station ON reservations(station_id);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_reservations_schedule ON reservations(scheduled_start, scheduled_end);

-- =============================================
-- CHARGING SESSIONS TABLE
-- =============================================

CREATE TABLE charging_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL,
    slot_id UUID NOT NULL REFERENCES charging_slots(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status charging_session_status NOT NULL DEFAULT 'pending',
    start_percentage DECIMAL(5, 2),
    current_percentage DECIMAL(5, 2),
    target_percentage DECIMAL(5, 2) DEFAULT 100.00,
    energy_delivered_kwh DECIMAL(10, 4) DEFAULT 0,
    average_power_kw DECIMAL(8, 2),
    cost DECIMAL(10, 2) DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_slot ON charging_sessions(slot_id);
CREATE INDEX idx_sessions_user ON charging_sessions(user_id);
CREATE INDEX idx_sessions_status ON charging_sessions(status);
CREATE INDEX idx_sessions_reservation ON charging_sessions(reservation_id);

-- =============================================
-- SLOT AVAILABILITY HISTORY (for prediction)
-- =============================================

CREATE TABLE slot_usage_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slot_id UUID NOT NULL REFERENCES charging_slots(id) ON DELETE CASCADE,
    station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    hour_of_day INTEGER NOT NULL CHECK (hour_of_day BETWEEN 0 AND 23),
    avg_session_duration_min DECIMAL(8, 2),
    avg_energy_kwh DECIMAL(10, 4),
    usage_count INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_usage_history_slot ON slot_usage_history(slot_id);
CREATE INDEX idx_usage_history_station ON slot_usage_history(station_id);
CREATE UNIQUE INDEX idx_usage_history_unique ON slot_usage_history(slot_id, day_of_week, hour_of_day);

-- =============================================
-- REVIEWS TABLE
-- =============================================

CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, station_id)
);

CREATE INDEX idx_reviews_station ON reviews(station_id);

-- =============================================
-- NOTIFICATIONS TABLE
-- =============================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(user_id, is_read);

-- =============================================
-- AUDIT LOG TABLE
-- =============================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    details JSONB DEFAULT '{}',
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);

-- =============================================
-- UPDATED_AT TRIGGER FUNCTION
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_stations_updated_at BEFORE UPDATE ON stations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_slots_updated_at BEFORE UPDATE ON charging_slots FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reservations_updated_at BEFORE UPDATE ON reservations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON charging_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

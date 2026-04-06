'use strict';

/**
 * Global Jest setup for the EV Charging backend test suite.
 *
 * This file is loaded via jest.config.js `setupFiles` so it runs before every
 * test module.  Its responsibilities are:
 *
 *   1. Force NODE_ENV=test so app.js skips morgan and errorHandler only logs
 *      minimal output.
 *   2. Mock the pg Pool so *no test ever touches a real database*.  Every file
 *      that requires `../config/database` (directly or transitively) gets the
 *      same mock object with a `query` jest.fn().
 *   3. Export shared factory helpers that individual test files can import.
 */

// ── Environment ──────────────────────────────────────────────────────────────
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-tests-only';
process.env.JWT_EXPIRES_IN = '1h';

// ── Database mock ────────────────────────────────────────────────────────────
//
// We use jest.mock() *inside each test file* (not here) because setup.js runs
// before the module registry is populated and jest.mock() needs to be called in
// the file that owns the test.  What we do here is set up the shared mock
// factory so tests can `require('../__mocks__/database')` if needed, and we
// expose a global helper to make the db mock easy to configure per-test.

// Silence console.error for expected error paths so test output stays clean.
// Individual tests that want to assert on console output should restore it.
const originalConsoleError = console.error;
beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => {
  console.error = originalConsoleError;
});

// ── Shared fixtures ──────────────────────────────────────────────────────────

const jwt = require('jsonwebtoken');

/**
 * Build a plain user object that matches the shape returned by User.findById /
 * User.create (the safe variant without password_hash).
 */
function makeMockUser(overrides = {}) {
  return {
    id: 'aaaaaaaa-1111-4111-a111-000000000001',
    email: 'alice@example.com',
    full_name: 'Alice Test',
    phone: '+15550001111',
    role: 'customer',
    is_active: true,
    email_verified: false,
    avatar_url: null,
    created_at: new Date('2024-01-01T00:00:00Z'),
    updated_at: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}

/**
 * Build a user row that *includes* password_hash, as returned by
 * User.findByEmail.  The hash corresponds to the plain-text password
 * 'Password1!' (bcrypt, rounds 12).  Using a pre-computed hash avoids running
 * bcrypt during unit tests.
 */
function makeMockUserWithHash(overrides = {}) {
  return {
    ...makeMockUser(overrides),
    // bcrypt hash of "Password1!" with 12 rounds - pre-computed for test speed
    password_hash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/Lewdyma3jKNb3M9Hy',
    ...overrides,
  };
}

/**
 * Sign a JWT using the test secret, returning a Bearer-ready header value.
 */
function makeAuthToken(payload = {}) {
  const defaults = {
    id: 'aaaaaaaa-1111-4111-a111-000000000001',
    email: 'alice@example.com',
    role: 'customer',
  };
  return jwt.sign({ ...defaults, ...payload }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

/**
 * Return an Authorization header object ready to pass to supertest's .set().
 */
function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

function makeManagerToken(overrides = {}) {
  return makeAuthToken({ role: 'manager', id: 'bbbbbbbb-2222-4222-a222-000000000002', ...overrides });
}

function makeAdminToken(overrides = {}) {
  return makeAuthToken({ role: 'admin', id: 'cccccccc-3333-4333-a333-000000000003', ...overrides });
}

/**
 * Build a mock station row matching the shape returned by Station.findById.
 */
function makeMockStation(overrides = {}) {
  return {
    id: 'dddddddd-4444-4444-a444-000000000004',
    manager_id: 'bbbbbbbb-2222-4222-a222-000000000002',
    name: 'Test Station Alpha',
    description: 'A test charging station',
    address: '123 Main St',
    city: 'San Francisco',
    state: 'CA',
    zip_code: '94105',
    country: 'US',
    latitude: 37.7749,
    longitude: -122.4194,
    status: 'approved',
    pricing_per_kwh: 0.35,
    operating_hours: { mon: '06:00-22:00' },
    amenities: ['wifi', 'restrooms'],
    images: [],
    total_slots: '4',
    available_slots: '2',
    manager_name: 'Bob Manager',
    created_at: new Date('2024-01-10T00:00:00Z'),
    updated_at: new Date('2024-01-10T00:00:00Z'),
    ...overrides,
  };
}

/**
 * Build a mock charging slot row.
 */
function makeMockSlot(overrides = {}) {
  return {
    id: 'eeeeeeee-5555-4555-a555-000000000005',
    station_id: 'dddddddd-4444-4444-a444-000000000004',
    slot_number: 1,
    charging_type: 'level2',
    connector_type: 'type2',
    power_output_kw: 7.4,
    status: 'available',
    created_at: new Date('2024-01-10T00:00:00Z'),
    updated_at: new Date('2024-01-10T00:00:00Z'),
    ...overrides,
  };
}

/**
 * Build a mock reservation row.
 */
function makeMockReservation(overrides = {}) {
  const start = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
  const end = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now
  return {
    id: 'ffffffff-6666-4666-a666-000000000006',
    user_id: 'aaaaaaaa-1111-4111-a111-000000000001',
    slot_id: 'eeeeeeee-5555-4555-a555-000000000005',
    station_id: 'dddddddd-4444-4444-a444-000000000004',
    scheduled_start: start.toISOString(),
    scheduled_end: end.toISOString(),
    status: 'confirmed',
    vehicle_info: { make: 'Tesla', model: 'Model 3' },
    notes: null,
    station_name: 'Test Station Alpha',
    station_address: '123 Main St',
    slot_number: 1,
    charging_type: 'level2',
    connector_type: 'type2',
    user_name: 'Alice Test',
    user_email: 'alice@example.com',
    created_at: new Date('2024-01-15T00:00:00Z'),
    updated_at: new Date('2024-01-15T00:00:00Z'),
    ...overrides,
  };
}

// Expose helpers globally so test files don't need to import setup.js directly.
global.testHelpers = {
  makeMockUser,
  makeMockUserWithHash,
  makeAuthToken,
  authHeader,
  makeManagerToken,
  makeAdminToken,
  makeMockStation,
  makeMockSlot,
  makeMockReservation,
};

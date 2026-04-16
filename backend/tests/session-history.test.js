'use strict';

/**
 * Charging session history endpoint tests.
 * TDD — tests written BEFORE implementation.
 */

jest.mock('../src/config/database', () => ({
  query: jest.fn(),
  pool: { on: jest.fn() },
  checkConnection: jest.fn().mockResolvedValue({ connected: true }),
}));

jest.mock('../src/models/ChargingSession', () => ({
  create: jest.fn(),
  findById: jest.fn(),
  findActiveBySlot: jest.fn(),
  findActiveByUser: jest.fn(),
  updateProgress: jest.fn(),
  complete: jest.fn(),
  findByStation: jest.fn(),
  failStaleSessions: jest.fn(),
  findHistoryByUser: jest.fn(),
  getHistoryDetail: jest.fn(),
  getUserStats: jest.fn(),
  _attachEstimatedCompletion: jest.fn((r) => r),
}));

// Mock services that chargingController transitively loads
jest.mock('../src/services/chargingService', () => ({
  startSession: jest.fn(),
  updateProgress: jest.fn(),
  completeSession: jest.fn(),
  getSessionDetails: jest.fn(),
  getActiveSessions: jest.fn(),
  getStationSessions: jest.fn(),
  getUserHistory: jest.fn(),
  getHistoryDetail: jest.fn(),
  getUserStats: jest.fn(),
}));

const request = require('supertest');
const app = require('../src/app');
const chargingService = require('../src/services/chargingService');

const { makeAuthToken, authHeader } = global.testHelpers;

const USER_ID = 'aaaaaaaa-1111-4111-a111-000000000001';
const SESSION_ID = 'ssssssss-1111-4111-a111-000000000001';
const STATION_ID = 'dddddddd-4444-4444-a444-000000000004';

const makeMockSession = (overrides = {}) => ({
  id: SESSION_ID,
  user_id: USER_ID,
  slot_id: 'eeeeeeee-5555-4555-a555-000000000005',
  reservation_id: null,
  status: 'completed',
  start_percentage: 20,
  current_percentage: 90,
  target_percentage: 90,
  energy_delivered_kwh: 35.5,
  average_power_kw: 22,
  cost: 450,
  started_at: '2024-06-01T10:00:00Z',
  completed_at: '2024-06-01T11:30:00Z',
  station_name: 'Test Station Alpha',
  station_id: STATION_ID,
  slot_number: 1,
  charging_type: 'level2',
  connector_type: 'type2',
  power_output_kw: 22,
  ...overrides,
});

// ── GET /api/charging/history ───────────────────────────────────────────────

describe('GET /api/charging/history', () => {
  const token = makeAuthToken();

  it('returns 200 with paginated session history', async () => {
    chargingService.getUserHistory.mockResolvedValue({
      sessions: [makeMockSession(), makeMockSession({ id: 'session-002' })],
      total: 2,
      page: 1,
      limit: 20,
    });

    const res = await request(app)
      .get('/api/charging/history')
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('sessions');
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('page');
    expect(Array.isArray(res.body.sessions)).toBe(true);
    expect(res.body.sessions.length).toBe(2);
  });

  it('supports date range filters', async () => {
    chargingService.getUserHistory.mockResolvedValue({
      sessions: [makeMockSession()],
      total: 1,
      page: 1,
      limit: 20,
    });

    const res = await request(app)
      .get('/api/charging/history')
      .query({ start_date: '2024-06-01', end_date: '2024-06-30' })
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(chargingService.getUserHistory).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ start_date: '2024-06-01', end_date: '2024-06-30' }),
    );
  });

  it('supports status filter', async () => {
    chargingService.getUserHistory.mockResolvedValue({
      sessions: [],
      total: 0,
      page: 1,
      limit: 20,
    });

    const res = await request(app)
      .get('/api/charging/history')
      .query({ status: 'completed' })
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(chargingService.getUserHistory).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ status: 'completed' }),
    );
  });

  it('supports pagination', async () => {
    chargingService.getUserHistory.mockResolvedValue({
      sessions: [],
      total: 50,
      page: 3,
      limit: 10,
    });

    const res = await request(app)
      .get('/api/charging/history')
      .query({ page: '3', limit: '10' })
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(3);
    expect(res.body.limit).toBe(10);
  });

  it('supports sort_by and sort_order', async () => {
    chargingService.getUserHistory.mockResolvedValue({
      sessions: [],
      total: 0,
      page: 1,
      limit: 20,
    });

    await request(app)
      .get('/api/charging/history')
      .query({ sort_by: 'cost', sort_order: 'asc' })
      .set(authHeader(token));

    expect(chargingService.getUserHistory).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ sort_by: 'cost', sort_order: 'asc' }),
    );
  });

  it('returns empty list when no history', async () => {
    chargingService.getUserHistory.mockResolvedValue({
      sessions: [],
      total: 0,
      page: 1,
      limit: 20,
    });

    const res = await request(app)
      .get('/api/charging/history')
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.sessions).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/charging/history');
    expect(res.status).toBe(401);
  });
});

// ── GET /api/charging/history/stats ─────────────────────────────────────────

describe('GET /api/charging/history/stats', () => {
  const token = makeAuthToken();

  it('returns 200 with user stats', async () => {
    chargingService.getUserStats.mockResolvedValue({
      totalSessions: 42,
      totalEnergyKwh: 1250.5,
      totalCost: 15800,
      avgDurationMin: 85,
      avgEnergyPerSession: 29.8,
    });

    const res = await request(app)
      .get('/api/charging/history/stats')
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalSessions', 42);
    expect(res.body).toHaveProperty('totalEnergyKwh', 1250.5);
    expect(res.body).toHaveProperty('totalCost', 15800);
    expect(res.body).toHaveProperty('avgDurationMin', 85);
  });

  it('returns zeros for new user with no history', async () => {
    chargingService.getUserStats.mockResolvedValue({
      totalSessions: 0,
      totalEnergyKwh: 0,
      totalCost: 0,
      avgDurationMin: 0,
      avgEnergyPerSession: 0,
    });

    const res = await request(app)
      .get('/api/charging/history/stats')
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.totalSessions).toBe(0);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/charging/history/stats');
    expect(res.status).toBe(401);
  });
});

// ── GET /api/charging/history/:sessionId ────────────────────────────────────

describe('GET /api/charging/history/:sessionId', () => {
  const token = makeAuthToken();

  it('returns 200 with detailed session info', async () => {
    chargingService.getHistoryDetail.mockResolvedValue(makeMockSession());

    const res = await request(app)
      .get(`/api/charging/history/${SESSION_ID}`)
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', SESSION_ID);
    expect(res.body).toHaveProperty('station_name');
    expect(res.body).toHaveProperty('energy_delivered_kwh');
  });

  it('returns 404 for non-existent session', async () => {
    chargingService.getHistoryDetail.mockRejectedValue(
      Object.assign(new Error('Session not found'), { statusCode: 404 }),
    );

    const res = await request(app)
      .get(`/api/charging/history/${SESSION_ID}`)
      .set(authHeader(token));

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/charging/history/${SESSION_ID}`);
    expect(res.status).toBe(401);
  });
});

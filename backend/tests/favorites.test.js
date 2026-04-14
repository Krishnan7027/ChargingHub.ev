'use strict';

/**
 * Favorites/Bookmarks endpoint tests.
 *
 * TDD — these tests are written BEFORE the implementation code.
 */

jest.mock('../src/config/database', () => ({
  query: jest.fn(),
  pool: { on: jest.fn() },
  checkConnection: jest.fn().mockResolvedValue({ connected: true }),
}));

jest.mock('../src/models/Favorite', () => ({
  create: jest.fn(),
  delete: jest.fn(),
  findByUser: jest.fn(),
  findOne: jest.fn(),
  countByStation: jest.fn(),
}));

jest.mock('../src/events/eventBus', () => ({
  publish: jest.fn().mockResolvedValue({}),
  on: jest.fn(),
  subscribeRedis: jest.fn(),
  EVENTS: {
    FAVORITE_ADDED: 'favorite.added',
    FAVORITE_REMOVED: 'favorite.removed',
    RESERVATION_CREATED: 'reservation.created',
    RESERVATION_CANCELLED: 'reservation.cancelled',
    RESERVATION_EXPIRED: 'reservation.expired',
    CHARGING_STARTED: 'charging.started',
    CHARGING_PROGRESS: 'charging.progress',
    CHARGING_COMPLETED: 'charging.completed',
    SLOT_UPDATED: 'slot.updated',
    SLOT_FREED: 'slot.freed',
    PAYMENT_CREATED: 'payment.created',
    PAYMENT_COMPLETED: 'payment.completed',
    PAYMENT_FAILED: 'payment.failed',
    PAYMENT_REFUNDED: 'payment.refunded',
    QUEUE_JOINED: 'queue.joined',
    QUEUE_ASSIGNED: 'queue.assigned',
    QUEUE_LEFT: 'queue.left',
    VEHICLE_PLUGGED: 'vehicle.plugged',
    VEHICLE_UNPLUGGED: 'vehicle.unplugged',
    USER_REGISTERED: 'user.registered',
  },
}));

const request = require('supertest');
const app = require('../src/app');
const Favorite = require('../src/models/Favorite');
const eventBus = require('../src/events/eventBus');

const {
  makeAuthToken,
  makeManagerToken,
  authHeader,
  makeMockStation,
} = global.testHelpers;

const USER_ID = 'aaaaaaaa-1111-4111-a111-000000000001';
const STATION_ID = 'dddddddd-4444-4444-a444-000000000004';

const makeMockFavorite = (overrides = {}) => ({
  id: 'fav-0001-0001-0001-000000000001',
  user_id: USER_ID,
  station_id: STATION_ID,
  created_at: new Date('2024-06-01T00:00:00Z'),
  ...overrides,
});

const makeFavoriteWithStation = (overrides = {}) => ({
  ...makeMockFavorite(),
  station_name: 'Test Station Alpha',
  station_address: '123 Main St',
  station_city: 'San Francisco',
  station_status: 'approved',
  total_slots: 4,
  available_slots: 2,
  ...overrides,
});

// ── POST /api/favorites/:stationId ──────────────────────────────────────────

describe('POST /api/favorites/:stationId', () => {
  const token = makeAuthToken();

  it('returns 201 when favoriting a station', async () => {
    Favorite.findOne.mockResolvedValue(null);
    Favorite.create.mockResolvedValue(makeMockFavorite());

    const res = await request(app)
      .post(`/api/favorites/${STATION_ID}`)
      .set(authHeader(token));

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.station_id).toBe(STATION_ID);
  });

  it('publishes favorite.added event', async () => {
    Favorite.findOne.mockResolvedValue(null);
    Favorite.create.mockResolvedValue(makeMockFavorite());

    await request(app)
      .post(`/api/favorites/${STATION_ID}`)
      .set(authHeader(token));

    expect(eventBus.publish).toHaveBeenCalledWith(
      'favorite.added',
      expect.objectContaining({ stationId: STATION_ID, userId: USER_ID }),
      expect.any(Object),
    );
  });

  it('returns 409 if already favorited', async () => {
    Favorite.findOne.mockResolvedValue(makeMockFavorite());

    const res = await request(app)
      .post(`/api/favorites/${STATION_ID}`)
      .set(authHeader(token));

    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).post(`/api/favorites/${STATION_ID}`);
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid stationId', async () => {
    const res = await request(app)
      .post('/api/favorites/not-a-uuid')
      .set(authHeader(token));

    expect(res.status).toBe(400);
  });
});

// ── DELETE /api/favorites/:stationId ────────────────────────────────────────

describe('DELETE /api/favorites/:stationId', () => {
  const token = makeAuthToken();

  it('returns 200 when removing a favorite', async () => {
    Favorite.delete.mockResolvedValue(makeMockFavorite());

    const res = await request(app)
      .delete(`/api/favorites/${STATION_ID}`)
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
  });

  it('publishes favorite.removed event', async () => {
    Favorite.delete.mockResolvedValue(makeMockFavorite());

    await request(app)
      .delete(`/api/favorites/${STATION_ID}`)
      .set(authHeader(token));

    expect(eventBus.publish).toHaveBeenCalledWith(
      'favorite.removed',
      expect.objectContaining({ stationId: STATION_ID, userId: USER_ID }),
      expect.any(Object),
    );
  });

  it('returns 404 if not favorited', async () => {
    Favorite.delete.mockResolvedValue(null);

    const res = await request(app)
      .delete(`/api/favorites/${STATION_ID}`)
      .set(authHeader(token));

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).delete(`/api/favorites/${STATION_ID}`);
    expect(res.status).toBe(401);
  });
});

// ── GET /api/favorites ──────────────────────────────────────────────────────

describe('GET /api/favorites', () => {
  const token = makeAuthToken();

  it('returns 200 with user favorites list', async () => {
    Favorite.findByUser.mockResolvedValue([
      makeFavoriteWithStation(),
      makeFavoriteWithStation({ station_id: 'station-002', station_name: 'Station Beta' }),
    ]);

    const res = await request(app)
      .get('/api/favorites')
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
    expect(res.body[0]).toHaveProperty('station_name');
  });

  it('returns empty array when no favorites', async () => {
    Favorite.findByUser.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/favorites')
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/favorites');
    expect(res.status).toBe(401);
  });
});

// ── GET /api/favorites/:stationId/status ────────────────────────────────────

describe('GET /api/favorites/:stationId/status', () => {
  const token = makeAuthToken();

  it('returns isFavorited: true when favorited', async () => {
    Favorite.findOne.mockResolvedValue(makeMockFavorite());
    Favorite.countByStation.mockResolvedValue(42);

    const res = await request(app)
      .get(`/api/favorites/${STATION_ID}/status`)
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.isFavorited).toBe(true);
    expect(res.body.totalFavorites).toBe(42);
  });

  it('returns isFavorited: false when not favorited', async () => {
    Favorite.findOne.mockResolvedValue(null);
    Favorite.countByStation.mockResolvedValue(10);

    const res = await request(app)
      .get(`/api/favorites/${STATION_ID}/status`)
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.isFavorited).toBe(false);
    expect(res.body.totalFavorites).toBe(10);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/favorites/${STATION_ID}/status`);
    expect(res.status).toBe(401);
  });
});

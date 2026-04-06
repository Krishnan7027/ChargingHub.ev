'use strict';

/**
 * Station endpoint integration tests.
 *
 * Mock strategy:
 *   - Mock `../config/database` to prevent real PG connections.
 *   - Mock the Station and ChargingSlot models so we control DB outcomes.
 *   - The auditLogger also queries the DB; mocking the db module silences it.
 */

jest.mock('../src/config/database', () => ({
  query: jest.fn(),
  pool: { on: jest.fn() },
  checkConnection: jest.fn().mockResolvedValue({ connected: true }),
}));

jest.mock('../src/models/Station', () => ({
  create: jest.fn(),
  findById: jest.fn(),
  findNearby: jest.fn(),
  search: jest.fn(),
  findByManager: jest.fn(),
  update: jest.fn(),
  updateStatus: jest.fn(),
  findAll: jest.fn(),
}));

jest.mock('../src/models/ChargingSlot', () => ({
  create: jest.fn(),
  findById: jest.fn(),
  findByStation: jest.fn(),
  update: jest.fn(),
  updateStatus: jest.fn(),
  delete: jest.fn(),
}));

// predictionService uses its own DB calls – stub it out entirely
jest.mock('../src/services/predictionService', () => ({
  predictNextAvailable: jest.fn(),
}));

const request = require('supertest');
const app = require('../src/app');
const Station = require('../src/models/Station');
const ChargingSlot = require('../src/models/ChargingSlot');

const {
  makeMockStation,
  makeMockSlot,
  makeAuthToken,
  makeManagerToken,
  makeAdminToken,
  authHeader,
} = global.testHelpers;

const STATION_ID = 'dddddddd-4444-4444-a444-000000000004';
const MANAGER_ID = 'bbbbbbbb-2222-4222-a222-000000000002';

// ── GET /api/stations/nearby ─────────────────────────────────────────────────

describe('GET /api/stations/nearby', () => {
  beforeEach(() => {
    Station.findNearby.mockResolvedValue([makeMockStation(), makeMockStation({ id: 'station-002' })]);
  });

  it('returns 200 with array of stations for valid coordinates', async () => {
    const res = await request(app)
      .get('/api/stations/nearby')
      .query({ latitude: '37.7749', longitude: '-122.4194' });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
    expect(res.body[0]).toHaveProperty('id');
    expect(res.body[0]).toHaveProperty('name');
  });

  it('passes radiusKm to the service when provided', async () => {
    await request(app)
      .get('/api/stations/nearby')
      .query({ latitude: '37.7749', longitude: '-122.4194', radiusKm: '10' });

    expect(Station.findNearby).toHaveBeenCalledWith(
      expect.objectContaining({ radiusKm: 10 })
    );
  });

  it('uses default pagination values when page/limit are absent', async () => {
    await request(app)
      .get('/api/stations/nearby')
      .query({ latitude: '37.7749', longitude: '-122.4194' });

    expect(Station.findNearby).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 20 })
    );
  });

  it('returns 400 when latitude is missing', async () => {
    const res = await request(app)
      .get('/api/stations/nearby')
      .query({ longitude: '-122.4194' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Validation failed');
    expect(res.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'latitude' })])
    );
  });

  it('returns 400 when longitude is missing', async () => {
    const res = await request(app)
      .get('/api/stations/nearby')
      .query({ latitude: '37.7749' });

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'longitude' })])
    );
  });

  it('returns 400 when latitude is out of range', async () => {
    const res = await request(app)
      .get('/api/stations/nearby')
      .query({ latitude: '200', longitude: '-122.4194' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when radiusKm is below minimum (1)', async () => {
    const res = await request(app)
      .get('/api/stations/nearby')
      .query({ latitude: '37.7749', longitude: '-122.4194', radiusKm: '0.5' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when radiusKm exceeds maximum (100)', async () => {
    const res = await request(app)
      .get('/api/stations/nearby')
      .query({ latitude: '37.7749', longitude: '-122.4194', radiusKm: '150' });

    expect(res.status).toBe(400);
  });

  it('returns an empty array when no stations are nearby', async () => {
    Station.findNearby.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/stations/nearby')
      .query({ latitude: '0', longitude: '0' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ── GET /api/stations/:id ────────────────────────────────────────────────────

describe('GET /api/stations/:id', () => {
  const mockStation = makeMockStation();
  const mockSlots = [makeMockSlot(), makeMockSlot({ id: 'slot-002', slot_number: 2 })];

  beforeEach(() => {
    Station.findById.mockResolvedValue(mockStation);
    ChargingSlot.findByStation.mockResolvedValue(mockSlots);
  });

  it('returns 200 with station and slots when station exists', async () => {
    const res = await request(app).get(`/api/stations/${STATION_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(STATION_ID);
    expect(res.body.name).toBe('Test Station Alpha');
    expect(Array.isArray(res.body.slots)).toBe(true);
    expect(res.body.slots).toHaveLength(2);
  });

  it('returns 404 when station does not exist', async () => {
    Station.findById.mockResolvedValue(null);

    const res = await request(app).get('/api/stations/00000000-0000-0000-0000-000000000000');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('includes charging slot details in the response', async () => {
    const res = await request(app).get(`/api/stations/${STATION_ID}`);

    expect(res.body.slots[0]).toHaveProperty('charging_type', 'level2');
    expect(res.body.slots[0]).toHaveProperty('connector_type', 'type2');
  });
});

// ── POST /api/stations ───────────────────────────────────────────────────────

describe('POST /api/stations', () => {
  const validBody = {
    name: 'New Station',
    address: '456 Oak Ave',
    city: 'Oakland',
    latitude: 37.8044,
    longitude: -122.2712,
  };

  beforeEach(() => {
    Station.create.mockResolvedValue(makeMockStation({ name: 'New Station' }));
  });

  it('returns 201 with created station when manager provides valid data', async () => {
    const token = makeManagerToken();

    const res = await request(app)
      .post('/api/stations')
      .set(authHeader(token))
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(Station.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'New Station', city: 'Oakland' })
    );
  });

  it('returns 401 when no auth token is provided', async () => {
    const res = await request(app).post('/api/stations').send(validBody);

    expect(res.status).toBe(401);
  });

  it('returns 403 when a customer (non-manager) tries to create a station', async () => {
    const customerToken = makeAuthToken({ role: 'customer' });

    const res = await request(app)
      .post('/api/stations')
      .set(authHeader(customerToken))
      .send(validBody);

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Insufficient permissions');
  });

  it('returns 400 when station name is missing', async () => {
    const token = makeManagerToken();
    const { name: _omitted, ...bodyWithoutName } = validBody;

    const res = await request(app)
      .post('/api/stations')
      .set(authHeader(token))
      .send(bodyWithoutName);

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'name' })])
    );
  });

  it('returns 400 when latitude is missing', async () => {
    const token = makeManagerToken();
    const { latitude: _omitted, ...body } = validBody;

    const res = await request(app)
      .post('/api/stations')
      .set(authHeader(token))
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'latitude' })])
    );
  });

  it('returns 400 when latitude is out of valid range', async () => {
    const token = makeManagerToken();

    const res = await request(app)
      .post('/api/stations')
      .set(authHeader(token))
      .send({ ...validBody, latitude: 200 });

    expect(res.status).toBe(400);
  });

  it('returns 400 when pricingPerKwh is negative', async () => {
    const token = makeManagerToken();

    const res = await request(app)
      .post('/api/stations')
      .set(authHeader(token))
      .send({ ...validBody, pricingPerKwh: -1 });

    expect(res.status).toBe(400);
  });

  it('passes managerId from token to the service', async () => {
    const token = makeManagerToken({ id: MANAGER_ID });

    await request(app)
      .post('/api/stations')
      .set(authHeader(token))
      .send(validBody);

    expect(Station.create).toHaveBeenCalledWith(
      expect.objectContaining({ managerId: MANAGER_ID })
    );
  });
});

// ── PATCH /api/stations/:id/approve ─────────────────────────────────────────

describe('PATCH /api/stations/:id/approve', () => {
  const pendingStation = makeMockStation({ status: 'pending' });
  const approvedStation = makeMockStation({ status: 'approved' });

  beforeEach(() => {
    Station.findById.mockResolvedValue(pendingStation);
    Station.updateStatus.mockResolvedValue(approvedStation);
  });

  it('returns 200 with approved station when admin approves a pending station', async () => {
    const token = makeAdminToken();

    const res = await request(app)
      .patch(`/api/stations/${STATION_ID}/approve`)
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approved');
    expect(Station.updateStatus).toHaveBeenCalledWith(STATION_ID, 'approved');
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(app).patch(`/api/stations/${STATION_ID}/approve`);

    expect(res.status).toBe(401);
  });

  it('returns 403 when a manager (non-admin) tries to approve', async () => {
    const token = makeManagerToken();

    const res = await request(app)
      .patch(`/api/stations/${STATION_ID}/approve`)
      .set(authHeader(token));

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Insufficient permissions');
  });

  it('returns 403 when a customer tries to approve', async () => {
    const token = makeAuthToken({ role: 'customer' });

    const res = await request(app)
      .patch(`/api/stations/${STATION_ID}/approve`)
      .set(authHeader(token));

    expect(res.status).toBe(403);
  });

  it('returns 400 when station is already approved', async () => {
    Station.findById.mockResolvedValue(approvedStation);
    const token = makeAdminToken();

    const res = await request(app)
      .patch(`/api/stations/${STATION_ID}/approve`)
      .set(authHeader(token));

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already approved/i);
  });

  it('returns 404 when station does not exist', async () => {
    Station.findById.mockResolvedValue(null);
    const token = makeAdminToken();

    const res = await request(app)
      .patch('/api/stations/00000000-0000-0000-0000-000000000000/approve')
      .set(authHeader(token));

    expect(res.status).toBe(404);
  });
});

// ── PATCH /api/stations/:id/reject ───────────────────────────────────────────

describe('PATCH /api/stations/:id/reject', () => {
  beforeEach(() => {
    Station.findById.mockResolvedValue(makeMockStation({ status: 'pending' }));
    Station.updateStatus.mockResolvedValue(makeMockStation({ status: 'rejected' }));
  });

  it('returns 200 with rejected station when admin rejects it', async () => {
    const token = makeAdminToken();

    const res = await request(app)
      .patch(`/api/stations/${STATION_ID}/reject`)
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('rejected');
    expect(Station.updateStatus).toHaveBeenCalledWith(STATION_ID, 'rejected');
  });

  it('returns 403 when a non-admin attempts to reject', async () => {
    const token = makeManagerToken();

    const res = await request(app)
      .patch(`/api/stations/${STATION_ID}/reject`)
      .set(authHeader(token));

    expect(res.status).toBe(403);
  });
});

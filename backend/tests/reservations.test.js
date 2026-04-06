'use strict';

/**
 * Reservation endpoint integration tests.
 *
 * Mock strategy:
 *   - db module mocked to prevent PG connections.
 *   - Reservation, ChargingSlot, and Station models mocked individually.
 *   - auditLogger is silenced via the db mock.
 */

jest.mock('../src/config/database', () => ({
  query: jest.fn(),
  pool: { on: jest.fn() },
  checkConnection: jest.fn().mockResolvedValue({ connected: true }),
}));

jest.mock('../src/models/Reservation', () => ({
  create: jest.fn(),
  findById: jest.fn(),
  findByUser: jest.fn(),
  findByStation: jest.fn(),
  updateStatus: jest.fn(),
  checkConflict: jest.fn(),
  expireOldReservations: jest.fn(),
}));

jest.mock('../src/models/ChargingSlot', () => ({
  findById: jest.fn(),
  updateStatus: jest.fn(),
  findByStation: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
}));

jest.mock('../src/models/Station', () => ({
  findById: jest.fn(),
  create: jest.fn(),
  findNearby: jest.fn(),
  search: jest.fn(),
  findByManager: jest.fn(),
  update: jest.fn(),
  updateStatus: jest.fn(),
  findAll: jest.fn(),
}));

const request = require('supertest');
const app = require('../src/app');
const Reservation = require('../src/models/Reservation');
const ChargingSlot = require('../src/models/ChargingSlot');
const Station = require('../src/models/Station');

const {
  makeMockUser,
  makeMockStation,
  makeMockSlot,
  makeMockReservation,
  makeAuthToken,
  makeManagerToken,
  makeAdminToken,
  authHeader,
} = global.testHelpers;

const USER_ID = 'aaaaaaaa-1111-4111-a111-000000000001';
const STATION_ID = 'dddddddd-4444-4444-a444-000000000004';
const SLOT_ID = 'eeeeeeee-5555-4555-a555-000000000005';
const RESERVATION_ID = 'ffffffff-6666-4666-a666-000000000006';

// Build future timestamps to satisfy the "not in the past" check
const future = (hoursFromNow) => {
  const d = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  return d.toISOString();
};

// ── POST /api/reservations ───────────────────────────────────────────────────

describe('POST /api/reservations', () => {
  const validBody = {
    slotId: SLOT_ID,
    stationId: STATION_ID,
    scheduledStart: future(2),
    scheduledEnd: future(3),
  };

  beforeEach(() => {
    ChargingSlot.findById.mockResolvedValue(makeMockSlot({ status: 'available' }));
    Station.findById.mockResolvedValue(makeMockStation({ status: 'approved' }));
    Reservation.checkConflict.mockResolvedValue(false);
    Reservation.create.mockResolvedValue(makeMockReservation());
    Reservation.findById.mockResolvedValue(makeMockReservation());
    ChargingSlot.updateStatus.mockResolvedValue(undefined);
  });

  it('returns 201 with the new reservation on success', async () => {
    const token = makeAuthToken({ id: USER_ID });

    const res = await request(app)
      .post('/api/reservations')
      .set(authHeader(token))
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id', RESERVATION_ID);
    expect(res.body).toHaveProperty('status', 'confirmed');
    expect(Reservation.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID, slotId: SLOT_ID })
    );
  });

  it('returns 401 when no auth token is provided', async () => {
    const res = await request(app).post('/api/reservations').send(validBody);

    expect(res.status).toBe(401);
  });

  it('returns 400 when slotId is not a UUID', async () => {
    const token = makeAuthToken({ id: USER_ID });

    const res = await request(app)
      .post('/api/reservations')
      .set(authHeader(token))
      .send({ ...validBody, slotId: 'not-a-uuid' });

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'slotId' })])
    );
  });

  it('returns 400 when stationId is not a UUID', async () => {
    const token = makeAuthToken({ id: USER_ID });

    const res = await request(app)
      .post('/api/reservations')
      .set(authHeader(token))
      .send({ ...validBody, stationId: 'bad-id' });

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'stationId' })])
    );
  });

  it('returns 400 when scheduledStart is not ISO 8601', async () => {
    const token = makeAuthToken({ id: USER_ID });

    const res = await request(app)
      .post('/api/reservations')
      .set(authHeader(token))
      .send({ ...validBody, scheduledStart: 'not-a-date' });

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'scheduledStart' })])
    );
  });

  it('returns 404 when the charging slot does not exist', async () => {
    ChargingSlot.findById.mockResolvedValue(null);
    const token = makeAuthToken({ id: USER_ID });

    const res = await request(app)
      .post('/api/reservations')
      .set(authHeader(token))
      .send(validBody);

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/slot not found/i);
  });

  it('returns 409 when the slot is already reserved', async () => {
    ChargingSlot.findById.mockResolvedValue(makeMockSlot({ status: 'reserved' }));
    const token = makeAuthToken({ id: USER_ID });

    const res = await request(app)
      .post('/api/reservations')
      .set(authHeader(token))
      .send(validBody);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/reserved/i);
  });

  it('returns 400 when station is not approved', async () => {
    Station.findById.mockResolvedValue(makeMockStation({ status: 'pending' }));
    const token = makeAuthToken({ id: USER_ID });

    const res = await request(app)
      .post('/api/reservations')
      .set(authHeader(token))
      .send(validBody);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not available/i);
  });

  it('returns 400 when scheduledEnd is before scheduledStart', async () => {
    const token = makeAuthToken({ id: USER_ID });

    const res = await request(app)
      .post('/api/reservations')
      .set(authHeader(token))
      .send({
        ...validBody,
        scheduledStart: future(3),
        scheduledEnd: future(2), // end before start
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when scheduledStart is in the past', async () => {
    const token = makeAuthToken({ id: USER_ID });
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const res = await request(app)
      .post('/api/reservations')
      .set(authHeader(token))
      .send({
        ...validBody,
        scheduledStart: past,
        scheduledEnd: future(1),
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 409 when there is a time conflict with an existing reservation', async () => {
    Reservation.checkConflict.mockResolvedValue(true);
    const token = makeAuthToken({ id: USER_ID });

    const res = await request(app)
      .post('/api/reservations')
      .set(authHeader(token))
      .send(validBody);

    // May be 409 (service) or 400 depending on validation order
    expect([400, 409]).toContain(res.status);
    expect(res.body).toHaveProperty('error');
  });

  it('creates reservation via the service on valid input', async () => {
    const token = makeAuthToken({ id: USER_ID });

    const res = await request(app)
      .post('/api/reservations')
      .set(authHeader(token))
      .send(validBody);

    expect(res.status).toBe(201);
    expect(Reservation.create).toHaveBeenCalled();
  });
});

// ── GET /api/reservations/my ─────────────────────────────────────────────────

describe('GET /api/reservations/my', () => {
  const reservationList = [
    makeMockReservation(),
    makeMockReservation({ id: 'ffffffff-9999-4999-a999-000000000099', status: 'completed' }),
  ];

  beforeEach(() => {
    Reservation.findByUser.mockResolvedValue(reservationList);
  });

  it('returns 200 with user reservations when authenticated', async () => {
    const token = makeAuthToken({ id: USER_ID });

    const res = await request(app)
      .get('/api/reservations/my')
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
    expect(Reservation.findByUser).toHaveBeenCalledWith(
      USER_ID,
      expect.any(Object)
    );
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get('/api/reservations/my');

    expect(res.status).toBe(401);
    expect(Reservation.findByUser).not.toHaveBeenCalled();
  });

  it('returns an empty array when the user has no reservations', async () => {
    Reservation.findByUser.mockResolvedValue([]);
    const token = makeAuthToken({ id: USER_ID });

    const res = await request(app)
      .get('/api/reservations/my')
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('passes status filter query param to the service', async () => {
    const token = makeAuthToken({ id: USER_ID });

    await request(app)
      .get('/api/reservations/my')
      .query({ status: 'confirmed' })
      .set(authHeader(token));

    expect(Reservation.findByUser).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ status: 'confirmed' })
    );
  });

  it('only returns reservations belonging to the authenticated user', async () => {
    // Different user ID
    const otherToken = makeAuthToken({ id: 'different-user-id' });
    Reservation.findByUser.mockResolvedValue([]);

    await request(app)
      .get('/api/reservations/my')
      .set(authHeader(otherToken));

    expect(Reservation.findByUser).toHaveBeenCalledWith(
      'different-user-id',
      expect.any(Object)
    );
  });
});

// ── PATCH /api/reservations/:id/cancel ───────────────────────────────────────

describe('PATCH /api/reservations/:id/cancel', () => {
  const confirmedReservation = makeMockReservation({ user_id: USER_ID, status: 'confirmed' });
  const cancelledReservation = makeMockReservation({ user_id: USER_ID, status: 'cancelled' });

  beforeEach(() => {
    Reservation.findById.mockResolvedValue(confirmedReservation);
    Reservation.updateStatus.mockResolvedValue(cancelledReservation);
    ChargingSlot.updateStatus.mockResolvedValue(undefined);
  });

  it('returns 200 with cancelled reservation when the owner cancels', async () => {
    const token = makeAuthToken({ id: USER_ID });

    const res = await request(app)
      .patch(`/api/reservations/${RESERVATION_ID}/cancel`)
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelled');
    expect(Reservation.updateStatus).toHaveBeenCalledWith(RESERVATION_ID, 'cancelled');
  });

  it('marks the slot as available after cancellation', async () => {
    const token = makeAuthToken({ id: USER_ID });

    await request(app)
      .patch(`/api/reservations/${RESERVATION_ID}/cancel`)
      .set(authHeader(token));

    expect(ChargingSlot.updateStatus).toHaveBeenCalledWith(
      confirmedReservation.slot_id,
      'available'
    );
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(app).patch(`/api/reservations/${RESERVATION_ID}/cancel`);

    expect(res.status).toBe(401);
    expect(Reservation.updateStatus).not.toHaveBeenCalled();
  });

  it('returns 403 when a different user attempts to cancel', async () => {
    const differentUserToken = makeAuthToken({ id: 'other-user-id' });

    const res = await request(app)
      .patch(`/api/reservations/${RESERVATION_ID}/cancel`)
      .set(authHeader(differentUserToken));

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/not authorized/i);
  });

  it('returns 404 when the reservation does not exist', async () => {
    Reservation.findById.mockResolvedValue(null);
    const token = makeAuthToken({ id: USER_ID });

    const res = await request(app)
      .patch('/api/reservations/00000000-0000-0000-0000-000000000000/cancel')
      .set(authHeader(token));

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('returns 400 when reservation is already cancelled', async () => {
    Reservation.findById.mockResolvedValue(
      makeMockReservation({ user_id: USER_ID, status: 'cancelled' })
    );
    const token = makeAuthToken({ id: USER_ID });

    const res = await request(app)
      .patch(`/api/reservations/${RESERVATION_ID}/cancel`)
      .set(authHeader(token));

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cannot cancel/i);
  });

  it('returns 400 when reservation status is "completed"', async () => {
    Reservation.findById.mockResolvedValue(
      makeMockReservation({ user_id: USER_ID, status: 'completed' })
    );
    const token = makeAuthToken({ id: USER_ID });

    const res = await request(app)
      .patch(`/api/reservations/${RESERVATION_ID}/cancel`)
      .set(authHeader(token));

    expect(res.status).toBe(400);
  });
});

// ── GET /api/reservations/:id ─────────────────────────────────────────────────

describe('GET /api/reservations/:id', () => {
  const reservation = makeMockReservation({ user_id: USER_ID });

  beforeEach(() => {
    Reservation.findById.mockResolvedValue(reservation);
    Station.findById.mockResolvedValue(makeMockStation());
  });

  it('returns 200 for the reservation owner', async () => {
    const token = makeAuthToken({ id: USER_ID });

    const res = await request(app)
      .get(`/api/reservations/${RESERVATION_ID}`)
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(RESERVATION_ID);
  });

  it('returns 200 for an admin viewing any reservation', async () => {
    const token = makeAdminToken();

    const res = await request(app)
      .get(`/api/reservations/${RESERVATION_ID}`)
      .set(authHeader(token));

    expect(res.status).toBe(200);
  });

  it('returns 403 for an unrelated user', async () => {
    const otherToken = makeAuthToken({ id: 'stranger-id', role: 'customer' });
    // Station manager_id won't match the stranger either
    Station.findById.mockResolvedValue(makeMockStation());

    const res = await request(app)
      .get(`/api/reservations/${RESERVATION_ID}`)
      .set(authHeader(otherToken));

    expect(res.status).toBe(403);
  });

  it('returns 404 when reservation does not exist', async () => {
    Reservation.findById.mockResolvedValue(null);
    const token = makeAuthToken({ id: USER_ID });

    const res = await request(app)
      .get('/api/reservations/00000000-0000-0000-0000-000000000000')
      .set(authHeader(token));

    expect(res.status).toBe(404);
  });
});

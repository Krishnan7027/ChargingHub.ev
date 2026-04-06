import { test, expect } from '@playwright/test';
import { USERS } from '../fixtures/test-users';
import { loginAs, findAvailableSlot } from '../utils/api-helper';

const API = process.env.API_URL || 'http://localhost:3001';

test.describe.serial('Booking System — Critical Path', () => {
  test('B01: Customer creates reservation → confirmed', async ({ request }) => {
    const { headers, token } = await loginAs(request, USERS.customer);
    const slot = await findAvailableSlot(request, token);
    test.skip(!slot, 'No available slots in seed data');

    const start = new Date(Date.now() + 3600_000).toISOString();
    const end = new Date(Date.now() + 7200_000).toISOString();

    const res = await request.post(`${API}/api/reservations`, {
      headers,
      data: {
        slotId: slot!.slotId,
        stationId: slot!.stationId,
        scheduledStart: start,
        scheduledEnd: end,
      },
    });

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.status).toBe('confirmed');
    expect(body.slot_id).toBe(slot!.slotId);

    // Cleanup: cancel the reservation
    await request.patch(`${API}/api/reservations/${body.id}/cancel`, { headers });
  });

  test('B02: Cannot reserve already-reserved slot → 409', async ({ request }) => {
    const { headers, token } = await loginAs(request, USERS.customer);
    const slot = await findAvailableSlot(request, token);
    test.skip(!slot, 'No available slots');

    const start = new Date(Date.now() + 3600_000).toISOString();
    const end = new Date(Date.now() + 7200_000).toISOString();

    // First reservation — should succeed
    const res1 = await request.post(`${API}/api/reservations`, {
      headers,
      data: { slotId: slot!.slotId, stationId: slot!.stationId, scheduledStart: start, scheduledEnd: end },
    });
    expect(res1.status()).toBe(201);
    const reservation = await res1.json();

    // Second reservation on same slot — should fail
    const res2 = await request.post(`${API}/api/reservations`, {
      headers,
      data: { slotId: slot!.slotId, stationId: slot!.stationId, scheduledStart: start, scheduledEnd: end },
    });
    expect(res2.status()).toBe(409);

    // Cleanup
    await request.patch(`${API}/api/reservations/${reservation.id}/cancel`, { headers });
  });

  test('B03: Cancel own reservation → slot freed', async ({ request }) => {
    const { headers, token } = await loginAs(request, USERS.customer);
    const slot = await findAvailableSlot(request, token);
    test.skip(!slot, 'No available slots');

    const start = new Date(Date.now() + 3600_000).toISOString();
    const end = new Date(Date.now() + 7200_000).toISOString();

    const res1 = await request.post(`${API}/api/reservations`, {
      headers,
      data: { slotId: slot!.slotId, stationId: slot!.stationId, scheduledStart: start, scheduledEnd: end },
    });
    const reservation = await res1.json();

    // Cancel
    const cancelRes = await request.patch(`${API}/api/reservations/${reservation.id}/cancel`, { headers });
    expect(cancelRes.status()).toBe(200);
    const cancelled = await cancelRes.json();
    expect(cancelled.status).toBe('cancelled');

    // Verify slot is available again
    const stationRes = await request.get(`${API}/api/stations/${slot!.stationId}`);
    const station = await stationRes.json();
    const freedSlot = station.slots?.find((s: any) => s.id === slot!.slotId);
    expect(freedSlot?.status).toBe('available');
  });

  test('E01: Reserve slot in the past → 400', async ({ request }) => {
    const { headers, token } = await loginAs(request, USERS.customer);
    const slot = await findAvailableSlot(request, token);
    test.skip(!slot, 'No available slots');

    const res = await request.post(`${API}/api/reservations`, {
      headers,
      data: {
        slotId: slot!.slotId,
        stationId: slot!.stationId,
        scheduledStart: new Date(Date.now() - 3600_000).toISOString(),
        scheduledEnd: new Date(Date.now() - 1800_000).toISOString(),
      },
    });
    expect(res.status()).toBe(400);
  });

  test('E02: Reserve with end before start → 400', async ({ request }) => {
    const { headers, token } = await loginAs(request, USERS.customer);
    const slot = await findAvailableSlot(request, token);
    test.skip(!slot, 'No available slots');

    const res = await request.post(`${API}/api/reservations`, {
      headers,
      data: {
        slotId: slot!.slotId,
        stationId: slot!.stationId,
        scheduledStart: new Date(Date.now() + 7200_000).toISOString(),
        scheduledEnd: new Date(Date.now() + 3600_000).toISOString(),
      },
    });
    expect(res.status()).toBe(400);
  });
});

import { test, expect, request as pwRequest } from '@playwright/test';
import { USERS } from '../fixtures/test-users';
import { loginAs, findAvailableSlot } from '../utils/api-helper';

const API = process.env.API_URL || 'http://localhost:3001';

test.describe.serial('Race Condition Tests', () => {
  test('R01: 5 concurrent reservations on same slot → exactly 1 succeeds', async ({ request }) => {
    const { headers, token } = await loginAs(request, USERS.customer);
    const slot = await findAvailableSlot(request, token);
    test.skip(!slot, 'No available slots');

    const start = new Date(Date.now() + 3600_000).toISOString();
    const end = new Date(Date.now() + 7200_000).toISOString();
    const payload = {
      slotId: slot!.slotId,
      stationId: slot!.stationId,
      scheduledStart: start,
      scheduledEnd: end,
    };

    // Fire 5 concurrent requests
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        request.post(`${API}/api/reservations`, { headers, data: payload })
      )
    );

    const statuses = results.map(r => r.status());
    const successes = statuses.filter(s => s === 201);
    const conflicts = statuses.filter(s => s === 409);

    // Exactly 1 should succeed, rest get 409
    expect(successes.length).toBe(1);
    expect(conflicts.length).toBe(4);

    // Cleanup: find the successful reservation and cancel it
    for (const res of results) {
      if (res.status() === 201) {
        const body = await res.json();
        await request.patch(`${API}/api/reservations/${body.id}/cancel`, { headers });
      }
    }
  });

  test('R02: 5 concurrent session starts on same slot → exactly 1 succeeds', async ({ request }) => {
    const { headers, token } = await loginAs(request, USERS.customer);
    const slot = await findAvailableSlot(request, token);
    test.skip(!slot, 'No available slots');

    const payload = {
      slotId: slot!.slotId,
      startPercentage: 20,
      targetPercentage: 80,
    };

    // Fire 5 concurrent session start requests
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        request.post(`${API}/api/charging/start`, { headers, data: payload })
      )
    );

    const statuses = results.map(r => r.status());
    const successes = statuses.filter(s => s === 201);
    const conflicts = statuses.filter(s => s === 409);

    // Exactly 1 should succeed
    expect(successes.length).toBe(1);
    expect(conflicts.length).toBe(4);

    // Cleanup: complete the session
    for (const res of results) {
      if (res.status() === 201) {
        const body = await res.json();
        // Need manager to complete — get manager auth
        const manager = await loginAs(request, USERS.manager);
        await request.patch(`${API}/api/charging/${body.id}/complete`, { headers: manager.headers });
      }
    }
  });

  test('B07: Start session on another user\'s reserved slot → 403', async ({ request }) => {
    // Customer 1 reserves
    const customer = await loginAs(request, USERS.customer);
    const slot = await findAvailableSlot(request, customer.token);
    test.skip(!slot, 'No available slots');

    const start = new Date(Date.now() + 3600_000).toISOString();
    const end = new Date(Date.now() + 7200_000).toISOString();

    const reserveRes = await request.post(`${API}/api/reservations`, {
      headers: customer.headers,
      data: { slotId: slot!.slotId, stationId: slot!.stationId, scheduledStart: start, scheduledEnd: end },
    });
    expect(reserveRes.status()).toBe(201);
    const reservation = await reserveRes.json();

    // Register a second user and try to start session on the reserved slot
    const uniqueEmail = `hijack-test-${Date.now()}@test.com`;
    const regRes = await request.post(`${API}/api/auth/register`, {
      data: { email: uniqueEmail, password: 'testpassword123', fullName: 'Hijack Test' },
    });
    expect(regRes.status()).toBe(201);
    const { token: hijackerToken } = await regRes.json();

    const sessionRes = await request.post(`${API}/api/charging/start`, {
      headers: { Authorization: `Bearer ${hijackerToken}` },
      data: { slotId: slot!.slotId, startPercentage: 20, targetPercentage: 80 },
    });
    expect(sessionRes.status()).toBe(403);

    // Cleanup
    await request.patch(`${API}/api/reservations/${reservation.id}/cancel`, { headers: customer.headers });
  });
});

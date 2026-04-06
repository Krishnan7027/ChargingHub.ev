import { test, expect } from '@playwright/test';
import { USERS } from '../fixtures/test-users';
import { loginAs } from '../utils/api-helper';

const API = process.env.API_URL || 'http://localhost:3001';

test.describe('Admin Flow', () => {
  test('D01: Admin sees platform stats', async ({ request }) => {
    const { headers } = await loginAs(request, USERS.admin);
    const res = await request.get(`${API}/api/admin/stats`, { headers });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('total_users');
    expect(body).toHaveProperty('total_stations');
    expect(body).toHaveProperty('total_sessions');
  });

  test('D02: Admin views user list', async ({ request }) => {
    const { headers } = await loginAs(request, USERS.admin);
    const res = await request.get(`${API}/api/admin/users`, { headers });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.users).toBeInstanceOf(Array);
    expect(body.total).toBeGreaterThan(0);
  });

  test('D06: Customer cannot access admin users → 403', async ({ request }) => {
    const { headers } = await loginAs(request, USERS.customer);
    const res = await request.get(`${API}/api/admin/users`, { headers });
    expect(res.status()).toBe(403);
  });

  test('Manager can view own stations', async ({ request }) => {
    const { headers } = await loginAs(request, USERS.manager);
    const res = await request.get(`${API}/api/stations/manager/my-stations`, { headers });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.stations || body)).toBe(true);
  });
});

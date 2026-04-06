import { test, expect } from '@playwright/test';

const API = process.env.API_URL || 'http://localhost:3001';

test.describe('Smoke Tests', () => {
  test('S03: API health check returns 200', async ({ request }) => {
    const res = await request.get(`${API}/api/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.database.connected).toBe(true);
  });

  test('S04: Login endpoint works', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/login`, {
      data: { email: 'customer@evcharge.com', password: 'password123' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.token).toBeTruthy();
    expect(body.user.role).toBe('customer');
  });

  test('S05: Stations nearby endpoint works', async ({ request }) => {
    const res = await request.get(`${API}/api/stations/nearby`, {
      params: { latitude: '37.7749', longitude: '-122.4194' },
    });
    expect(res.status()).toBe(200);
    const stations = await res.json();
    expect(Array.isArray(stations)).toBe(true);
  });
});

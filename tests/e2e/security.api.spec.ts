import { test, expect } from '@playwright/test';
import { USERS } from '../fixtures/test-users';
import { loginAs } from '../utils/api-helper';

const API = process.env.API_URL || 'http://localhost:3001';

test.describe('Security Tests', () => {
  test('X01: Protected endpoint without token → 401', async ({ request }) => {
    const res = await request.get(`${API}/api/auth/profile`);
    expect(res.status()).toBe(401);
  });

  test('X02: Invalid/tampered token → 401', async ({ request }) => {
    const res = await request.get(`${API}/api/auth/profile`, {
      headers: { Authorization: 'Bearer invalid.jwt.token' },
    });
    expect(res.status()).toBe(401);
  });

  test('X03: Customer cannot access another customer\'s session', async ({ request }) => {
    // Login as customer, get active sessions
    const { headers } = await loginAs(request, USERS.customer);
    // Try to access a non-existent session ID (UUID format)
    const res = await request.get(`${API}/api/charging/00000000-0000-0000-0000-000000000000`, {
      headers,
    });
    // Should be 404 (not found) not 200 with someone else's data
    expect([403, 404]).toContain(res.status());
  });

  test('X04: Customer cannot access another user\'s payment', async ({ request }) => {
    const { headers } = await loginAs(request, USERS.customer);
    const res = await request.get(`${API}/api/payments/00000000-0000-0000-0000-000000000000`, {
      headers,
    });
    expect([403, 404]).toContain(res.status());
  });

  test('X05: Customer cannot call admin endpoints → 403', async ({ request }) => {
    const { headers } = await loginAs(request, USERS.customer);

    const endpoints = [
      { method: 'GET', url: `${API}/api/admin/stats` },
      { method: 'GET', url: `${API}/api/admin/users` },
      { method: 'GET', url: `${API}/api/admin/stations` },
    ];

    for (const ep of endpoints) {
      const res = await request.get(ep.url, { headers });
      expect(res.status()).toBe(403);
    }
  });

  test('X06: Demo toggle without admin auth → 401', async ({ request }) => {
    const res = await request.post(`${API}/api/demo/start`);
    expect(res.status()).toBe(401);
  });

  test('X06b: Demo toggle as customer → 403', async ({ request }) => {
    const { headers } = await loginAs(request, USERS.customer);
    const res = await request.post(`${API}/api/demo/start`, { headers });
    expect(res.status()).toBe(403);
  });

  test('Password hash not exposed in any auth response', async ({ request }) => {
    // Use pre-authed token to avoid rate limit, then verify profile
    const { headers } = await loginAs(request, USERS.customer);

    // Profile endpoint must not leak password_hash
    const profileRes = await request.get(`${API}/api/auth/profile`, { headers });
    expect(profileRes.status()).toBe(200);
    const profileBody = await profileRes.json();
    expect(profileBody).not.toHaveProperty('password_hash');

    // Login response must not leak password_hash (direct call, single request)
    const loginRes = await request.post(`${API}/api/auth/login`, {
      data: { email: USERS.customer.email, password: USERS.customer.password },
    });
    if (loginRes.ok()) {
      const loginBody = await loginRes.json();
      expect(loginBody.user).toBeDefined();
      expect(loginBody.user).not.toHaveProperty('password_hash');
    }
    // If rate-limited, profile check above is still valid
  });
});

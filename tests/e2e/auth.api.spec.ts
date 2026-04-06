import { test, expect } from '@playwright/test';
import { USERS } from '../fixtures/test-users';
import { loginAs } from '../utils/api-helper';

const API = process.env.API_URL || 'http://localhost:3001';

test.describe('Auth Flow — API', () => {
  test('A01: Login with valid customer credentials', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/login`, {
      data: { email: USERS.customer.email, password: USERS.customer.password },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.user.role).toBe('customer');
    expect(body.token).toBeTruthy();
    expect(body.user.email).toBe(USERS.customer.email);
    // Ensure no password_hash leaked
    expect(body.user).not.toHaveProperty('password_hash');
  });

  test('A02: Login with valid manager credentials', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/login`, {
      data: { email: USERS.manager.email, password: USERS.manager.password },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.user.role).toBe('manager');
  });

  test('A03: Login with valid admin credentials', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/login`, {
      data: { email: USERS.admin.email, password: USERS.admin.password },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.user.role).toBe('admin');
  });

  test('A04: Login with invalid password → 401', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/login`, {
      data: { email: USERS.customer.email, password: 'wrongpassword' },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  test('A05: Login with non-existent email → 401', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/login`, {
      data: { email: 'nobody@nowhere.com', password: 'anything' },
    });
    expect(res.status()).toBe(401);
  });

  test('A07: Access admin endpoint without token → 401', async ({ request }) => {
    const res = await request.get(`${API}/api/admin/stats`);
    expect(res.status()).toBe(401);
  });

  test('A08: Customer cannot access admin endpoint → 403', async ({ request }) => {
    const { headers } = await loginAs(request, USERS.customer);
    const res = await request.get(`${API}/api/admin/stats`, { headers });
    expect(res.status()).toBe(403);
  });

  test('A09: Valid token accesses protected endpoint', async ({ request }) => {
    const { headers } = await loginAs(request, USERS.customer);
    const res = await request.get(`${API}/api/auth/profile`, { headers });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.email).toBe(USERS.customer.email);
  });

  test('E05: Register with duplicate email → 409', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/register`, {
      data: {
        email: USERS.customer.email,
        password: 'testpassword123',
        fullName: 'Duplicate User',
      },
    });
    expect(res.status()).toBe(409);
  });
});

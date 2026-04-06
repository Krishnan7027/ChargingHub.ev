'use strict';

/**
 * Auth endpoint integration tests.
 *
 * Strategy:
 *   - Mock `../config/database` so no real PG connection is needed.
 *   - Mock `../models/User` at the service boundary so we control all
 *     database outcomes without needing real bcrypt hashing during most paths.
 *   - Use supertest against the real Express app to exercise the full
 *     middleware chain: validation → controller → service → error handler.
 */

jest.mock('../src/config/database', () => ({
  query: jest.fn(),
  pool: { on: jest.fn() },
  checkConnection: jest.fn().mockResolvedValue({ connected: true }),
}));

// Mock User model methods individually so we can configure per-test behaviour.
jest.mock('../src/models/User', () => ({
  create: jest.fn(),
  findByEmail: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  updatePassword: jest.fn(),
  comparePassword: jest.fn(),
  delete: jest.fn(),
  findAll: jest.fn(),
}));

const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const jwt = require('jsonwebtoken');

const {
  makeMockUser,
  makeMockUserWithHash,
  makeAuthToken,
  authHeader,
} = global.testHelpers;

// ── POST /api/auth/register ──────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  const validBody = {
    email: 'newuser@example.com',
    password: 'Password1!',
    fullName: 'New User',
  };

  beforeEach(() => {
    User.findByEmail.mockResolvedValue(null); // no existing user by default
    User.create.mockResolvedValue(
      makeMockUser({ email: 'newuser@example.com', full_name: 'New User' })
    );
  });

  it('returns 201 with user and token on successful registration', async () => {
    const res = await request(app).post('/api/auth/register').send(validBody);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user).not.toHaveProperty('password_hash');
    expect(res.body.user.email).toBe('newuser@example.com');
  });

  it('returns a JWT that decodes to the correct payload', async () => {
    const res = await request(app).post('/api/auth/register').send(validBody);

    const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(decoded).toHaveProperty('id');
    expect(decoded).toHaveProperty('email');
    expect(decoded).toHaveProperty('role');
  });

  it('accepts an optional role of "manager"', async () => {
    const managerUser = makeMockUser({ role: 'manager', email: 'mgr@example.com' });
    User.create.mockResolvedValue(managerUser);

    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validBody, role: 'manager' });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('manager');
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ password: 'Password1!', fullName: 'No Email' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Validation failed');
    expect(res.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'email' }),
      ])
    );
  });

  it('returns 400 when email format is invalid', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validBody, email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'email' })])
    );
  });

  it('returns 400 when password is shorter than 8 characters', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validBody, password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'password' })])
    );
  });

  it('returns 400 when fullName is empty', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validBody, fullName: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'fullName' })])
    );
  });

  it('returns 409 when email is already registered', async () => {
    User.findByEmail.mockResolvedValue(makeMockUserWithHash({ email: 'newuser@example.com' }));

    const res = await request(app).post('/api/auth/register').send(validBody);

    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toMatch(/already registered/i);
  });

  it('returns 400 when role is not an allowed value', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validBody, role: 'superuser' });

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'role' })])
    );
  });
});

// ── POST /api/auth/login ─────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  const validCredentials = {
    email: 'alice@example.com',
    password: 'Password1!',
  };

  beforeEach(() => {
    // comparePassword must actually call bcrypt to test the real path, but for
    // speed we mock the User model method itself.
    User.findByEmail.mockResolvedValue(makeMockUserWithHash());
    User.comparePassword.mockResolvedValue(true);
  });

  it('returns 200 with user (no password_hash) and token on valid credentials', async () => {
    const res = await request(app).post('/api/auth/login').send(validCredentials);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).not.toHaveProperty('password_hash');
    expect(res.body.user.email).toBe('alice@example.com');
  });

  it('returns 401 when user does not exist', async () => {
    User.findByEmail.mockResolvedValue(null);

    const res = await request(app).post('/api/auth/login').send(validCredentials);

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid email or password/i);
  });

  it('returns 401 when password is wrong', async () => {
    User.comparePassword.mockResolvedValue(false);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ ...validCredentials, password: 'WrongPassword!' });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid email or password/i);
  });

  it('returns 403 when account is disabled', async () => {
    User.findByEmail.mockResolvedValue(makeMockUserWithHash({ is_active: false }));

    const res = await request(app).post('/api/auth/login').send(validCredentials);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/account is disabled/i);
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: 'Password1!' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Validation failed');
  });

  it('returns 400 when password is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@example.com' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Validation failed');
  });

  it('returns 400 when body is empty', async () => {
    const res = await request(app).post('/api/auth/login').send({});

    expect(res.status).toBe(400);
  });
});

// ── GET /api/auth/profile ────────────────────────────────────────────────────

describe('GET /api/auth/profile', () => {
  const mockUser = makeMockUser();

  beforeEach(() => {
    User.findById.mockResolvedValue(mockUser);
  });

  it('returns 200 with the user profile when a valid token is provided', async () => {
    const token = makeAuthToken({ id: mockUser.id });

    const res = await request(app)
      .get('/api/auth/profile')
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(mockUser.id);
    expect(res.body.email).toBe(mockUser.email);
    expect(res.body).not.toHaveProperty('password_hash');
  });

  it('returns 401 when no Authorization header is present', async () => {
    const res = await request(app).get('/api/auth/profile');

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Authentication required');
  });

  it('returns 401 when token is malformed', async () => {
    const res = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', 'Bearer this-is-not-a-jwt');

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid or expired token');
  });

  it('returns 401 when token is signed with a different secret', async () => {
    const badToken = jwt.sign({ id: mockUser.id, role: 'customer' }, 'wrong-secret');

    const res = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${badToken}`);

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid or expired token');
  });

  it('returns 401 when token is expired', async () => {
    const expiredToken = jwt.sign(
      { id: mockUser.id, role: 'customer' },
      process.env.JWT_SECRET,
      { expiresIn: '-1s' }
    );

    const res = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid or expired token');
  });

  it('returns 404 when the user no longer exists in the database', async () => {
    User.findById.mockResolvedValue(null);
    const token = makeAuthToken({ id: 'nonexistent-id' });

    const res = await request(app)
      .get('/api/auth/profile')
      .set(authHeader(token));

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });
});

// ── PUT /api/auth/profile ────────────────────────────────────────────────────

describe('PUT /api/auth/profile', () => {
  const mockUser = makeMockUser();

  beforeEach(() => {
    User.update.mockResolvedValue({ ...mockUser, full_name: 'Alice Updated' });
  });

  it('returns 200 with updated user when valid fields are provided', async () => {
    const token = makeAuthToken({ id: mockUser.id });

    const res = await request(app)
      .put('/api/auth/profile')
      .set(authHeader(token))
      .send({ fullName: 'Alice Updated' });

    expect(res.status).toBe(200);
    expect(res.body.full_name).toBe('Alice Updated');
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(app)
      .put('/api/auth/profile')
      .send({ fullName: 'No Auth' });

    expect(res.status).toBe(401);
  });

  it('returns 400 when no updatable fields are sent', async () => {
    // The service throws a 400 when no fields change
    User.update.mockResolvedValue(null);
    const token = makeAuthToken({ id: mockUser.id });

    // Sending an empty body triggers the "No fields to update" service error
    const res = await request(app)
      .put('/api/auth/profile')
      .set(authHeader(token))
      .send({});

    expect(res.status).toBe(400);
  });
});

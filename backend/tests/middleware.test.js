'use strict';

/**
 * Middleware unit tests.
 *
 * These tests exercise middleware functions directly by constructing minimal
 * mock request/response objects, without spinning up the full Express app.
 * This keeps each test fast and focused on a single concern.
 */

jest.mock('../src/config/database', () => ({
  query: jest.fn(),
  pool: { on: jest.fn() },
  checkConnection: jest.fn().mockResolvedValue({ connected: true }),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Create a minimal mock Express request.
 */
function mockReq(overrides = {}) {
  return {
    headers: {},
    user: null,
    method: 'GET',
    originalUrl: '/api/test',
    ip: '127.0.0.1',
    ...overrides,
  };
}

/**
 * Create a mock Express response with jest.fn() for chained methods.
 */
function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
  };
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockImplementation((data) => {
    res.body = data;
    return res;
  });
  res.end = jest.fn().mockReturnValue(res);
  return res;
}

const jwt = require('jsonwebtoken');

// ── Auth middleware ───────────────────────────────────────────────────────────

describe('authenticate middleware', () => {
  let authenticate;

  beforeAll(() => {
    ({ authenticate } = require('../src/middleware/auth'));
  });

  it('calls next() and attaches decoded user to req when token is valid', () => {
    const payload = { id: 'user-1', email: 'a@b.com', role: 'customer' };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(); // called without error
    expect(req.user).toMatchObject({ id: 'user-1', email: 'a@b.com', role: 'customer' });
  });

  it('responds 401 when the Authorization header is absent', () => {
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('responds 401 when the Authorization header does not start with "Bearer "', () => {
    const req = mockReq({ headers: { authorization: 'Token abc123' } });
    const res = mockRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('responds 401 when the token is malformed', () => {
    const req = mockReq({ headers: { authorization: 'Bearer not.a.jwt' } });
    const res = mockRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('responds 401 when the token is signed with a wrong secret', () => {
    const token = jwt.sign({ id: 'user-1', role: 'customer' }, 'wrong-secret');
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('responds 401 when the token is expired', () => {
    const token = jwt.sign(
      { id: 'user-1', role: 'customer' },
      process.env.JWT_SECRET,
      { expiresIn: '-1s' }
    );
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
  });
});

// ── Authorize middleware ──────────────────────────────────────────────────────

describe('authorize middleware', () => {
  let authorize;

  beforeAll(() => {
    ({ authorize } = require('../src/middleware/auth'));
  });

  it('calls next() when user role is in the allowed list', () => {
    const req = mockReq({ user: { id: 'u1', role: 'admin' } });
    const res = mockRes();
    const next = jest.fn();

    authorize('admin', 'manager')(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it('calls next() when user is a manager and manager is allowed', () => {
    const req = mockReq({ user: { id: 'u1', role: 'manager' } });
    const res = mockRes();
    const next = jest.fn();

    authorize('manager')(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('responds 403 when user role is not in the allowed list', () => {
    const req = mockReq({ user: { id: 'u1', role: 'customer' } });
    const res = mockRes();
    const next = jest.fn();

    authorize('admin', 'manager')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Insufficient permissions' });
    expect(next).not.toHaveBeenCalled();
  });

  it('responds 401 when req.user is null (no prior authentication)', () => {
    const req = mockReq({ user: null });
    const res = mockRes();
    const next = jest.fn();

    authorize('admin')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('is case-sensitive – "Admin" does not match "admin"', () => {
    const req = mockReq({ user: { id: 'u1', role: 'Admin' } });
    const res = mockRes();
    const next = jest.fn();

    authorize('admin')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

// ── optionalAuth middleware ───────────────────────────────────────────────────

describe('optionalAuth middleware', () => {
  let optionalAuth;

  beforeAll(() => {
    ({ optionalAuth } = require('../src/middleware/auth'));
  });

  it('attaches user to req when a valid token is present', async () => {
    const token = jwt.sign({ id: 'u1', role: 'customer' }, process.env.JWT_SECRET);
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();
    const next = jest.fn();

    await optionalAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toMatchObject({ id: 'u1' });
  });

  it('calls next() without setting req.user when no header is present', async () => {
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    await optionalAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeNull();
  });

  it('calls next() without setting req.user when token is invalid', async () => {
    const req = mockReq({ headers: { authorization: 'Bearer invalid-token' } });
    const res = mockRes();
    const next = jest.fn();

    await optionalAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeNull();
  });
});

// ── Validate middleware ───────────────────────────────────────────────────────

describe('validate middleware', () => {
  const { validate } = require('../src/middleware/validate');
  const { body } = require('express-validator');

  /**
   * Helper: run a chain of express-validator validators followed by the
   * `validate` middleware against a mock req/res, returning the response state.
   */
  async function runValidation(validators, reqBody) {
    // Build a minimal Express-like req
    const req = {
      body: reqBody,
      query: {},
      params: {},
      headers: { 'content-type': 'application/json' },
      // express-validator attaches results to this object
    };
    const res = mockRes();
    const next = jest.fn();

    // Run each validator (they are async express middleware)
    for (const validator of validators) {
      await new Promise((resolve) => validator(req, res, resolve));
    }

    validate(req, res, next);
    return { req, res, next };
  }

  it('calls next() when all fields are valid', async () => {
    const validators = [body('email').isEmail(), body('name').notEmpty()];
    const { next } = await runValidation(validators, {
      email: 'valid@email.com',
      name: 'Alice',
    });

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it('responds 400 when a required field is missing', async () => {
    const validators = [body('email').isEmail()];
    const { res, next } = await runValidation(validators, { email: 'not-an-email' });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns error body with "error" and "details" keys', async () => {
    const validators = [
      body('email').isEmail().withMessage('Must be email'),
      body('name').notEmpty().withMessage('Name required'),
    ];
    const { res } = await runValidation(validators, { email: 'bad', name: '' });

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Validation failed',
        details: expect.arrayContaining([
          expect.objectContaining({ field: expect.any(String), message: expect.any(String) }),
        ]),
      })
    );
  });

  it('surfaces the correct field name in the error detail', async () => {
    const validators = [body('phone').isMobilePhone().withMessage('Bad phone')];
    const { res } = await runValidation(validators, { phone: 'notaphone' });

    const responseBody = res.json.mock.calls[0][0];
    expect(responseBody.details[0].field).toBe('phone');
    expect(responseBody.details[0].message).toBe('Bad phone');
  });

  it('calls next() when all optional fields are absent', async () => {
    const validators = [body('phone').optional().isMobilePhone()];
    const { next } = await runValidation(validators, {});

    expect(next).toHaveBeenCalledWith();
  });
});

// ── Error handler middleware ──────────────────────────────────────────────────

describe('errorHandler middleware', () => {
  const { errorHandler } = require('../src/middleware/errorHandler');

  it('responds with the error statusCode when present', () => {
    const err = new Error('Not found');
    err.statusCode = 404;

    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not found' });
  });

  it('defaults to 500 when no statusCode is set on the error', () => {
    const err = new Error('Something blew up');

    const req = mockReq();
    const res = mockRes();

    errorHandler(err, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Something blew up' });
  });

  it('handles PostgreSQL unique-violation error (code 23505) as 409', () => {
    const err = new Error('duplicate key value');
    err.code = '23505';
    err.detail = 'Key (email)=(foo@bar.com) already exists.';

    const req = mockReq();
    const res = mockRes();

    errorHandler(err, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Resource already exists',
      detail: 'Key (email)=(foo@bar.com) already exists.',
    });
  });

  it('handles PostgreSQL foreign-key violation error (code 23503) as 400', () => {
    const err = new Error('foreign key violation');
    err.code = '23503';
    err.detail = 'Key (station_id) references table "stations"';

    const req = mockReq();
    const res = mockRes();

    errorHandler(err, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Referenced resource not found',
      detail: 'Key (station_id) references table "stations"',
    });
  });

  it('handles PostgreSQL check-constraint error (code 23514) as 400', () => {
    const err = new Error('check constraint violated');
    err.code = '23514';
    err.detail = 'Failing row contains invalid status';

    const req = mockReq();
    const res = mockRes();

    errorHandler(err, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Validation constraint failed',
      detail: 'Failing row contains invalid status',
    });
  });

  it('uses the AppError statusCode for application-level errors', () => {
    const { AppError } = require('../src/utils/errors');
    const err = new AppError('Forbidden action', 403);

    const req = mockReq();
    const res = mockRes();

    errorHandler(err, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden action' });
  });

  it('uses the NotFoundError 404 status', () => {
    const { NotFoundError } = require('../src/utils/errors');
    const err = new NotFoundError('Station');

    const req = mockReq();
    const res = mockRes();

    errorHandler(err, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Station not found' });
  });

  it('uses the ConflictError 409 status', () => {
    const { ConflictError } = require('../src/utils/errors');
    const err = new ConflictError('Email already taken');

    const req = mockReq();
    const res = mockRes();

    errorHandler(err, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: 'Email already taken' });
  });

  it('uses the ForbiddenError 403 status', () => {
    const { ForbiddenError } = require('../src/utils/errors');
    const err = new ForbiddenError('Cannot modify this resource');

    const req = mockReq();
    const res = mockRes();

    errorHandler(err, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('uses the BadRequestError 400 status', () => {
    const { BadRequestError } = require('../src/utils/errors');
    const err = new BadRequestError('Invalid input');

    const req = mockReq();
    const res = mockRes();

    errorHandler(err, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

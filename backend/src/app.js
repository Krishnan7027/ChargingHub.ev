const express = require('express');
const compression = require('compression');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const env = require('./config/env');
const { errorHandler } = require('./middleware/errorHandler');
const { auditMiddleware } = require('./utils/auditLogger');

const app = express();

// ── Security ───────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: env.cors.origin, credentials: true }));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Logging ────────────────────────────────────────────────
if (env.nodeEnv !== 'test') {
  app.use(morgan('combined'));
}

// ── Health checks (BEFORE rate limiter — Render probes must never be throttled) ──
const { checkConnection, pool } = require('./config/database');
const { getClient: getRedisClient } = require('./config/redis');
const { notificationQueue, reservationExpiryQueue, predictionUpdateQueue, queueAssignmentQueue, paymentQueue } = require('./jobs/queues');
const { caches } = require('./utils/cache');
const { isDemoMode, startDemoSimulator, stopDemoSimulator } = require('./utils/demoSimulator');
const { authenticate, authorize } = require('./middleware/auth');

app.get('/api/health', async (_req, res) => {
  const dbResult = await checkConnection();
  const mem = process.memoryUsage();

  const status = dbResult.connected ? 'ok' : 'degraded';
  const httpCode = dbResult.connected ? 200 : 503;

  const cacheSizes = {};
  for (const [name, cache] of Object.entries(caches)) {
    cacheSizes[name] = cache.size;
  }

  res.status(httpCode).json({
    status,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    demoMode: isDemoMode(),
    database: {
      connected: dbResult.connected,
      ...(dbResult.timestamp && { latency: dbResult.timestamp }),
      ...(dbResult.error && { error: dbResult.error }),
    },
    memory: {
      rss_mb: Math.round(mem.rss / 1024 / 1024),
      heap_mb: Math.round(mem.heapUsed / 1024 / 1024),
    },
    caches: cacheSizes,
  });
});

// Deep health check — checks all dependencies with latency
app.get('/api/health/deep', async (_req, res) => {
  const checks = {};
  let allHealthy = true;

  // PostgreSQL check with latency
  const dbStart = Date.now();
  try {
    const dbResult = await checkConnection();
    checks.database = {
      status: dbResult.connected ? 'healthy' : 'unhealthy',
      latencyMs: Date.now() - dbStart,
      poolSize: pool.totalCount,
      poolIdle: pool.idleCount,
      poolWaiting: pool.waitingCount,
    };
    if (!dbResult.connected) allHealthy = false;
  } catch (err) {
    checks.database = { status: 'unhealthy', error: err.message, latencyMs: Date.now() - dbStart };
    allHealthy = false;
  }

  // Redis check with latency
  const redisStart = Date.now();
  try {
    const redis = getRedisClient();
    const pong = await redis.ping();
    checks.redis = {
      status: pong === 'PONG' ? 'healthy' : 'unhealthy',
      latencyMs: Date.now() - redisStart,
    };
    if (pong !== 'PONG') allHealthy = false;
  } catch (err) {
    checks.redis = { status: 'unhealthy', error: err.message, latencyMs: Date.now() - redisStart };
    allHealthy = false;
  }

  // BullMQ queue depths
  try {
    const queues = { notifications: notificationQueue, reservationExpiry: reservationExpiryQueue, predictions: predictionUpdateQueue, queueAssignment: queueAssignmentQueue, payments: paymentQueue };
    const depths = {};
    for (const [name, q] of Object.entries(queues)) {
      const [waiting, active, delayed, failed] = await Promise.all([
        q.getWaitingCount(), q.getActiveCount(), q.getDelayedCount(), q.getFailedCount(),
      ]);
      depths[name] = { waiting, active, delayed, failed };
    }
    checks.queues = { status: 'healthy', depths };
  } catch (err) {
    checks.queues = { status: 'degraded', error: err.message };
  }

  // Socket.io connections
  const io = app.get('io');
  if (io) {
    checks.websocket = {
      status: 'healthy',
      connectedClients: io.engine?.clientsCount ?? 0,
    };
  } else {
    checks.websocket = { status: 'unknown', note: 'io not attached to app' };
  }

  // Memory
  const mem = process.memoryUsage();
  checks.memory = {
    rss_mb: Math.round(mem.rss / 1024 / 1024),
    heap_mb: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotal_mb: Math.round(mem.heapTotal / 1024 / 1024),
  };

  // In-memory caches
  const cacheSizes = {};
  for (const [name, cache] of Object.entries(caches)) {
    cacheSizes[name] = cache.size;
  }
  checks.caches = cacheSizes;

  const status = allHealthy ? 'ok' : 'degraded';
  res.status(allHealthy ? 200 : 503).json({
    status,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    demoMode: isDemoMode(),
    checks,
  });
});

// ── Public platform stats (no auth, safe subset for homepage) ────
app.get('/api/public/stats', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM stations WHERE status = 'approved') AS stations,
        (SELECT COUNT(*) FROM users WHERE role = 'customer') AS users,
        (SELECT COALESCE(SUM(energy_delivered_kwh), 0) FROM charging_sessions WHERE status = 'completed') AS kwh
    `);
    const r = rows[0];
    res.json({
      stations: Number(r.stations),
      users: Number(r.users),
      kwhDelivered: Math.round(Number(r.kwh)),
      uptime: 99.9,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ── Temporary Redis test (remove after verification) ─────
app.get('/api/redis-test', async (_req, res) => {
  try {
    const redis = getRedisClient();
    await redis.set('test', 'hello');
    const value = await redis.get('test');
    res.json({ redis: value });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Rate limiting (after health checks so Render probes are not throttled) ──
const limiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
app.use('/api/', limiter);

// Stricter limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many authentication attempts' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// ── Audit helper on every request ──────────────────────────
app.use(auditMiddleware);

// ── Versioned API routes (v1) ────────────────────────────────
const v1 = express.Router();
v1.use('/auth', require('./routes/auth'));
v1.use('/stations', require('./routes/stations'));
v1.use('/reservations', require('./routes/reservations'));
v1.use('/charging', require('./routes/charging'));
v1.use('/admin', require('./routes/admin'));
v1.use('/predictions', require('./routes/predictions'));
v1.use('/route-planner', require('./routes/routePlanner'));
v1.use('/intelligent', require('./routes/intelligent'));
v1.use('/payments', require('./routes/payments'));
v1.use('/plug-charge', require('./routes/plugCharge'));

// Mount v1 and keep /api/ as alias for backward compatibility
app.use('/api/v1', v1);
app.use('/api', v1);

// ── Demo mode toggle (admin only in production, open in dev) ──
app.post('/api/demo/start', authenticate, authorize('admin'), (req, res) => {
  if (!isDemoMode()) {
    process.env.DEMO_MODE = 'true';
    startDemoSimulator(req.app.get('ws'));
  }
  res.json({ demoMode: true, message: 'Demo simulator started' });
});

app.post('/api/demo/stop', authenticate, authorize('admin'), (_req, res) => {
  process.env.DEMO_MODE = 'false';
  stopDemoSimulator();
  res.json({ demoMode: false, message: 'Demo simulator stopped' });
});

app.get('/api/demo/status', (_req, res) => {
  res.json({ demoMode: isDemoMode() });
});

// ── Global error handler (must be last) ────────────────────
app.use(errorHandler);

module.exports = app;

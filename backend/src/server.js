require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const env = require('./config/env');
const { setupWebSocket } = require('./websocket/socketHandler');
const {
  startReservationExpiryScheduler, stopReservationExpiryScheduler,
  startAnalyticsScheduler, stopAnalyticsScheduler,
  startEnergyCleanupScheduler, stopEnergyCleanupScheduler,
  startStaleSessionScheduler, stopStaleSessionScheduler,
  startSlotReservationTtlScheduler, stopSlotReservationTtlScheduler,
} = require('./utils/scheduler');
const { startDemoSimulator, stopDemoSimulator, isDemoMode } = require('./utils/demoSimulator');

// ── HTTP + WebSocket server ────────────────────────────────
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: env.cors.origin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Initialise WebSocket handlers and expose to Express routes
const wsHandlers = setupWebSocket(io);
app.set('ws', wsHandlers);
app.set('io', io);

// ── Redis + Event System + BullMQ ─────────────────────────
async function initializeInfrastructure() {
  try {
    // Test Redis connection
    const { getClient } = require('./config/redis');
    const redis = getClient();
    await redis.ping();
    console.log('[redis] Connected successfully');

    // Register event subscribers (wires events → WebSocket + jobs)
    const { registerSubscribers } = require('./events/subscribers');
    registerSubscribers(wsHandlers);

    // Start BullMQ workers
    const { startWorkers } = require('./jobs/workers');
    startWorkers(wsHandlers);

    // Schedule repeatable jobs
    const { setupRepeatable } = require('./jobs/queues');
    await setupRepeatable();

    console.log('[infra] Redis + Events + BullMQ initialized');
  } catch (err) {
    console.warn('[infra] Redis not available — running without event bus and job queues:', err.message);
    console.warn('[infra] The app will work but without background jobs, events, or Redis caching.');
  }
}

// ── Start background jobs ──────────────────────────────────
startReservationExpiryScheduler();
startAnalyticsScheduler();
startEnergyCleanupScheduler();
startStaleSessionScheduler();
startSlotReservationTtlScheduler();

// ── Demo mode ──────────────────────────────────────────────
if (isDemoMode()) {
  startDemoSimulator(wsHandlers);
}

// ── Listen ─────────────────────────────────────────────────
server.listen(env.port, async () => {
  console.log(`\n  EV Charge Hub API`);
  console.log(`  ─────────────────────────────`);
  console.log(`  REST  : http://localhost:${env.port}/api`);
  console.log(`  WS    : http://localhost:${env.port}`);
  console.log(`  Env   : ${env.nodeEnv}`);
  console.log(`  Demo  : ${isDemoMode() ? 'ON' : 'OFF'}`);
  console.log(`  Health: http://localhost:${env.port}/api/health\n`);

  // Initialize Redis/Events/BullMQ after server is listening
  await initializeInfrastructure();
});

// ── Graceful shutdown ──────────────────────────────────────
async function shutdown(signal) {
  console.log(`\n${signal} received — shutting down gracefully…`);
  stopReservationExpiryScheduler();
  stopAnalyticsScheduler();
  stopEnergyCleanupScheduler();
  stopStaleSessionScheduler();
  stopSlotReservationTtlScheduler();
  stopDemoSimulator();

  // Stop BullMQ workers and close queues
  try {
    const { stopWorkers } = require('./jobs/workers');
    await stopWorkers();
    const { closeQueues } = require('./jobs/queues');
    await closeQueues();
  } catch (err) {
    console.error('  Error stopping workers:', err.message);
  }

  // Close Redis connections
  try {
    const { closeRedis } = require('./config/redis');
    await closeRedis();
  } catch (err) {
    console.error('  Error closing Redis:', err.message);
  }

  io.close(() => {
    console.log('  WebSocket server closed');
  });

  server.close(() => {
    console.log('  HTTP server closed');
    process.exit(0);
  });

  // Force exit after 10 s if something hangs
  setTimeout(() => {
    console.error('  Forced exit after timeout');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

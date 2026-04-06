const Reservation = require('../models/Reservation');
const ChargingSession = require('../models/ChargingSession');
const ChargingSlot = require('../models/ChargingSlot');
const analyticsService = require('../services/analyticsService');
const { cleanupExpired } = require('../services/energyOptimizationService');
const { caches } = require('./cache');

let intervalHandle = null;
let analyticsHandle = null;
let energyCleanupHandle = null;
let staleSessionHandle = null;
let slotReservationTtlHandle = null;

/**
 * Periodically expire stale reservations that were never started.
 * Runs every 60 seconds. Safe to call multiple times — idempotent.
 */
function startReservationExpiryScheduler() {
  if (intervalHandle) return; // already running

  async function tick() {
    try {
      const expired = await Reservation.expireOldReservations();
      if (expired > 0) {
        console.log(`[scheduler] Expired ${expired} stale reservation(s)`);
      }
    } catch (err) {
      console.error('[scheduler] Reservation expiry failed:', err.message);
    }
  }

  // Run once on startup, then every 60s
  tick();
  intervalHandle = setInterval(tick, 60_000);
  console.log('[scheduler] Reservation expiry scheduler started (60s interval)');
}

function stopReservationExpiryScheduler() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

/**
 * Aggregate yesterday's station analytics once every hour.
 */
function startAnalyticsScheduler() {
  if (analyticsHandle) return;

  async function aggregate() {
    try {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      await analyticsService.aggregateDailyStats(yesterday);
      console.log(`[scheduler] Analytics aggregated for ${yesterday}`);
    } catch (err) {
      console.error('[scheduler] Analytics aggregation failed:', err.message);
    }
  }

  // Delay first run by 10s to let migrations complete if running in parallel
  setTimeout(aggregate, 10_000);
  analyticsHandle = setInterval(aggregate, 3600_000);
  console.log('[scheduler] Analytics aggregation scheduler started (1h interval)');
}

function stopAnalyticsScheduler() {
  if (analyticsHandle) {
    clearInterval(analyticsHandle);
    analyticsHandle = null;
  }
}

/**
 * Cleanup expired energy optimization recommendations every 30 minutes.
 */
function startEnergyCleanupScheduler() {
  if (energyCleanupHandle) return;

  async function tick() {
    try {
      await cleanupExpired();
      // Prune expired cache entries to keep memory usage stable
      Object.values(caches).forEach((cache) => cache.prune());
    } catch (err) {
      console.error('[scheduler] Energy optimization cleanup failed:', err.message);
    }
  }

  tick();
  energyCleanupHandle = setInterval(tick, 1800_000);
  console.log('[scheduler] Energy optimization cleanup scheduler started (30m interval)');
}

function stopEnergyCleanupScheduler() {
  if (energyCleanupHandle) {
    clearInterval(energyCleanupHandle);
    energyCleanupHandle = null;
  }
}

/**
 * Fail charging sessions stuck in 'charging' status for over 4 hours.
 * Resets the corresponding slot to 'available' so it can be used again.
 * Runs every 5 minutes.
 */
function startStaleSessionScheduler(maxHours = 4) {
  if (staleSessionHandle) return; // already running

  async function tick() {
    try {
      const failed = await ChargingSession.failStaleSessions(maxHours);
      if (failed > 0) {
        console.log(`[scheduler] Failed ${failed} stale charging session(s) (>${maxHours}h)`);
      }
    } catch (err) {
      console.error('[scheduler] Stale session cleanup failed:', err.message);
    }
  }

  // Run once on startup, then every 5 minutes
  tick();
  staleSessionHandle = setInterval(tick, 300_000);
  console.log(`[scheduler] Stale session cleanup scheduler started (5m interval, max ${maxHours}h)`);
}

function stopStaleSessionScheduler() {
  if (staleSessionHandle) {
    clearInterval(staleSessionHandle);
    staleSessionHandle = null;
  }
}

/**
 * Release slot-level reservation locks that exceeded their TTL.
 * Catches slots where reserved_at + ttlMinutes < NOW().
 * Runs every 60 seconds, default TTL = 15 minutes.
 */
function startSlotReservationTtlScheduler(ttlMinutes = 15) {
  if (slotReservationTtlHandle) return;

  async function tick() {
    try {
      const released = await ChargingSlot.releaseExpiredReservations(ttlMinutes);
      if (released > 0) {
        console.log(`[scheduler] Released ${released} expired slot reservation(s) (TTL: ${ttlMinutes}m)`);
      }
    } catch (err) {
      console.error('[scheduler] Slot reservation TTL cleanup failed:', err.message);
    }
  }

  tick();
  slotReservationTtlHandle = setInterval(tick, 60_000);
  console.log(`[scheduler] Slot reservation TTL scheduler started (60s interval, TTL: ${ttlMinutes}m)`);
}

function stopSlotReservationTtlScheduler() {
  if (slotReservationTtlHandle) {
    clearInterval(slotReservationTtlHandle);
    slotReservationTtlHandle = null;
  }
}

module.exports = {
  startReservationExpiryScheduler,
  stopReservationExpiryScheduler,
  startAnalyticsScheduler,
  stopAnalyticsScheduler,
  startEnergyCleanupScheduler,
  stopEnergyCleanupScheduler,
  startStaleSessionScheduler,
  stopStaleSessionScheduler,
  startSlotReservationTtlScheduler,
  stopSlotReservationTtlScheduler,
};

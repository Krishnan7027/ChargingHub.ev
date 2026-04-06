/**
 * Demo Mode Simulator
 *
 * When DEMO_MODE=true, this module simulates realistic EV charging activity:
 *   - Advances active charging sessions every tick (charging curve progress)
 *   - Completes sessions that reach their target percentage
 *   - Starts new sessions on available slots
 *   - Creates and fulfills reservations
 *   - Broadcasts all changes via WebSocket for real-time UI updates
 *   - Invalidates prediction caches so predictions stay fresh
 *
 * All writes go through real DB queries and real WS handlers, so every
 * part of the frontend sees genuine data — no mocking.
 *
 * Enable: set DEMO_MODE=true in .env
 * Tune:   adjust TICK_MS (default 5s) and probabilities below
 */

const db = require('../config/database');
const { caches } = require('./cache');

// ── Tuning knobs ─────────────────────────────────────────────

const TICK_MS = 5_000;               // Main loop interval
const PROGRESS_INCREMENT_BASE = 1.5; // Base % per tick for DC Fast at 150kW
const NEW_SESSION_PROBABILITY = 0.25; // Chance of starting a new session per tick
const NEW_RESERVATION_PROBABILITY = 0.10; // Chance of creating a reservation per tick
const CANCEL_RESERVATION_PROBABILITY = 0.03; // Chance of cancelling one per tick

// ── State ────────────────────────────────────────────────────

let tickHandle = null;
let ws = null; // WebSocket handlers ref, set at start

// ── Helpers ──────────────────────────────────────────────────

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function rand(min, max) { return Math.round((Math.random() * (max - min) + min) * 100) / 100; }

function log(msg) {
  console.log(`[demo] ${msg}`);
}

// ── Core simulation logic ────────────────────────────────────

/**
 * Advance all active charging sessions by a realistic increment.
 * Uses the slot's power rating to determine how fast % climbs.
 */
async function advanceActiveSessions() {
  const { rows: sessions } = await db.query(`
    SELECT cs.id, cs.slot_id, cs.user_id, cs.current_percentage, cs.target_percentage,
           cs.energy_delivered_kwh, cs.cost, cs.started_at,
           ck.power_output_kw, ck.station_id,
           s.pricing_per_kwh
    FROM charging_sessions cs
    JOIN charging_slots ck ON ck.id = cs.slot_id
    JOIN stations s ON ck.station_id = s.id
    WHERE cs.status = 'charging'
  `);

  for (const sess of sessions) {
    const current = Number(sess.current_percentage);
    const target = Number(sess.target_percentage);
    const powerKw = Number(sess.power_output_kw);
    const price = Number(sess.pricing_per_kwh) || 0.35;

    if (current >= target) {
      await completeSession(sess);
      continue;
    }

    // Charging curve: faster at low %, slower above 80%
    let efficiency;
    if (current < 60) efficiency = 0.95;
    else if (current < 80) efficiency = 0.80;
    else if (current < 90) efficiency = 0.50;
    else efficiency = 0.30;

    // Scale increment by power output (150kW gets full base, 7kW gets ~5% of base)
    const powerScale = powerKw / 150;
    const jitter = rand(0.7, 1.3);
    const increment = PROGRESS_INCREMENT_BASE * powerScale * efficiency * jitter;

    const newPct = Math.min(Math.round((current + increment) * 100) / 100, target);
    const batteryKwh = 60;
    const energyThisTick = ((newPct - current) / 100) * batteryKwh;
    const newEnergy = Math.round((Number(sess.energy_delivered_kwh) + energyThisTick) * 1000) / 1000;
    const newCost = Math.round(newEnergy * price * 100) / 100;
    const avgPower = Math.round(powerKw * efficiency * jitter * 100) / 100;

    await db.query(`
      UPDATE charging_sessions
      SET current_percentage = $1, energy_delivered_kwh = $2, cost = $3, average_power_kw = $4
      WHERE id = $5
    `, [newPct, newEnergy, newCost, avgPower, sess.id]);

    // Broadcast live progress to anyone watching this station
    if (ws) {
      ws.notifyStation(sess.station_id, 'slot:updated', {
        slotId: sess.slot_id,
        stationId: sess.station_id,
        sessionId: sess.id,
        currentPercentage: newPct,
        targetPercentage: target,
        energyDeliveredKwh: newEnergy,
        cost: newCost,
        updatedAt: new Date().toISOString(),
      });
    }

    // If reached target, complete on next tick (gives UI a moment to show 100%)
    if (newPct >= target) {
      await completeSession(sess);
    }
  }
}

/**
 * Complete a charging session: mark done, free the slot, broadcast.
 */
async function completeSession(sess) {
  await db.query(`
    UPDATE charging_sessions SET status = 'completed', completed_at = NOW(),
           current_percentage = target_percentage WHERE id = $1
  `, [sess.id]);

  await db.query(`
    UPDATE charging_slots SET status = 'available', current_session_id = NULL WHERE id = $1
  `, [sess.slot_id]);

  // Record usage history for the prediction engine
  if (sess.started_at) {
    const durationMin = (Date.now() - new Date(sess.started_at).getTime()) / 60_000;
    try {
      const predictionService = require('../services/predictionService');
      await predictionService.recordUsage(
        sess.slot_id, sess.station_id, durationMin, Number(sess.energy_delivered_kwh) || 0,
      );
    } catch { /* prediction service may not be loaded */ }
  }

  caches.prediction.delete(`prediction:${sess.station_id}`);

  if (ws) {
    ws.notifyStation(sess.station_id, 'slot:statusChanged', {
      slotId: sess.slot_id,
      status: 'available',
      sessionId: null,
      updatedAt: new Date().toISOString(),
    });
  }

  log(`Session completed: slot ${sess.slot_id} at station ${sess.station_id} (${Number(sess.energy_delivered_kwh).toFixed(1)} kWh, $${Number(sess.cost).toFixed(2)})`);
}

/**
 * Start a new charging session on a random available slot.
 */
async function maybeStartNewSession() {
  if (Math.random() > NEW_SESSION_PROBABILITY) return;

  // Find an available slot
  const { rows: availableSlots } = await db.query(`
    SELECT ck.id AS slot_id, ck.station_id, ck.power_output_kw
    FROM charging_slots ck
    JOIN stations s ON s.id = ck.station_id
    WHERE ck.status = 'available' AND s.status = 'approved'
    ORDER BY RANDOM() LIMIT 1
  `);

  if (availableSlots.length === 0) return;
  const slot = availableSlots[0];

  // Pick a random customer
  const { rows: customers } = await db.query(`
    SELECT id FROM users WHERE role = 'customer' ORDER BY RANDOM() LIMIT 1
  `);
  if (customers.length === 0) return;

  const startPct = rand(8, 40);
  const targetPct = rand(80, 100);

  const { rows: [session] } = await db.query(`
    INSERT INTO charging_sessions (slot_id, user_id, status,
                                   start_percentage, current_percentage, target_percentage,
                                   energy_delivered_kwh, cost, started_at, created_at)
    VALUES ($1, $2, 'charging', $3, $3, $4, 0, 0, NOW(), NOW())
    RETURNING id
  `, [slot.slot_id, customers[0].id, startPct, targetPct]);

  await db.query(`
    UPDATE charging_slots SET status = 'occupied', current_session_id = $1 WHERE id = $2
  `, [session.id, slot.slot_id]);

  caches.prediction.delete(`prediction:${slot.station_id}`);

  if (ws) {
    ws.notifyStation(slot.station_id, 'slot:statusChanged', {
      slotId: slot.slot_id,
      status: 'occupied',
      sessionId: session.id,
      updatedAt: new Date().toISOString(),
    });
  }

  log(`New session started: slot ${slot.slot_id} (${Number(slot.power_output_kw)} kW, ${startPct}% → ${targetPct}%)`);
}

/**
 * Create a new reservation on a random available slot for the near future.
 */
async function maybeCreateReservation() {
  if (Math.random() > NEW_RESERVATION_PROBABILITY) return;

  const { rows: slots } = await db.query(`
    SELECT ck.id AS slot_id, ck.station_id
    FROM charging_slots ck
    JOIN stations s ON s.id = ck.station_id
    WHERE ck.status = 'available' AND s.status = 'approved'
    ORDER BY RANDOM() LIMIT 1
  `);
  if (slots.length === 0) return;

  const { rows: customers } = await db.query(`
    SELECT id FROM users WHERE role = 'customer' ORDER BY RANDOM() LIMIT 1
  `);
  if (customers.length === 0) return;

  const slot = slots[0];
  const startMinFromNow = Math.floor(Math.random() * 120) + 30; // 30min - 2.5h from now
  const durationMin = Math.floor(Math.random() * 60) + 30; // 30-90 min
  const start = new Date(Date.now() + startMinFromNow * 60_000);
  const end = new Date(start.getTime() + durationMin * 60_000);

  const vehicles = [
    { make: 'Tesla', model: 'Model 3' }, { make: 'Tesla', model: 'Model Y' },
    { make: 'BMW', model: 'i4' }, { make: 'Hyundai', model: 'Ioniq 5' },
    { make: 'Ford', model: 'Mach-E' }, { make: 'Kia', model: 'EV6' },
  ];

  await db.query(`
    INSERT INTO reservations (user_id, slot_id, station_id, status,
                              scheduled_start, scheduled_end, vehicle_info)
    VALUES ($1, $2, $3, 'confirmed', $4, $5, $6)
  `, [customers[0].id, slot.slot_id, slot.station_id, start, end,
      JSON.stringify(pick(vehicles))]);

  await db.query(`UPDATE charging_slots SET status = 'reserved' WHERE id = $1`, [slot.slot_id]);

  caches.prediction.delete(`prediction:${slot.station_id}`);

  if (ws) {
    ws.notifyStation(slot.station_id, 'slot:statusChanged', {
      slotId: slot.slot_id,
      status: 'reserved',
      updatedAt: new Date().toISOString(),
    });
  }

  log(`Reservation created: slot ${slot.slot_id} for ${start.toLocaleTimeString()} - ${end.toLocaleTimeString()}`);
}

/**
 * Occasionally cancel a confirmed reservation and free the slot.
 */
async function maybeCancelReservation() {
  if (Math.random() > CANCEL_RESERVATION_PROBABILITY) return;

  const { rows: reservations } = await db.query(`
    SELECT r.id, r.slot_id, r.station_id
    FROM reservations r
    JOIN charging_slots ck ON ck.id = r.slot_id
    WHERE r.status = 'confirmed' AND ck.status = 'reserved'
    ORDER BY RANDOM() LIMIT 1
  `);
  if (reservations.length === 0) return;

  const res = reservations[0];

  await db.query(`UPDATE reservations SET status = 'cancelled' WHERE id = $1`, [res.id]);
  await db.query(`UPDATE charging_slots SET status = 'available' WHERE id = $1`, [res.slot_id]);

  caches.prediction.delete(`prediction:${res.station_id}`);

  if (ws) {
    ws.notifyStation(res.station_id, 'slot:statusChanged', {
      slotId: res.slot_id,
      status: 'available',
      updatedAt: new Date().toISOString(),
    });
  }

  log(`Reservation cancelled: ${res.id}`);
}

/**
 * Convert a confirmed reservation to an active charging session
 * if its scheduled_start has passed.
 */
async function fulfillDueReservations() {
  const { rows: due } = await db.query(`
    SELECT r.id AS reservation_id, r.slot_id, r.station_id, r.user_id
    FROM reservations r
    JOIN charging_slots ck ON ck.id = r.slot_id
    WHERE r.status = 'confirmed'
      AND r.scheduled_start <= NOW()
      AND ck.status = 'reserved'
    LIMIT 3
  `);

  for (const res of due) {
    const startPct = rand(10, 35);
    const targetPct = rand(80, 100);

    const { rows: [session] } = await db.query(`
      INSERT INTO charging_sessions (reservation_id, slot_id, user_id, status,
                                     start_percentage, current_percentage, target_percentage,
                                     energy_delivered_kwh, cost, started_at, created_at)
      VALUES ($1, $2, $3, 'charging', $4, $4, $5, 0, 0, NOW(), NOW())
      RETURNING id
    `, [res.reservation_id, res.slot_id, res.user_id, startPct, targetPct]);

    await db.query(`UPDATE reservations SET status = 'active', actual_start = NOW() WHERE id = $1`, [res.reservation_id]);
    await db.query(`UPDATE charging_slots SET status = 'occupied', current_session_id = $1 WHERE id = $2`, [session.id, res.slot_id]);

    caches.prediction.delete(`prediction:${res.station_id}`);

    if (ws) {
      ws.notifyStation(res.station_id, 'slot:statusChanged', {
        slotId: res.slot_id,
        status: 'occupied',
        sessionId: session.id,
        updatedAt: new Date().toISOString(),
      });
    }

    log(`Reservation ${res.reservation_id} fulfilled → session ${session.id}`);
  }
}

// ── Main tick ────────────────────────────────────────────────

async function tick() {
  try {
    await advanceActiveSessions();
    await maybeStartNewSession();
    await maybeCreateReservation();
    await maybeCancelReservation();
    await fulfillDueReservations();
  } catch (err) {
    console.error('[demo] Tick error:', err.message);
  }
}

// ── Public API ───────────────────────────────────────────────

function startDemoSimulator(wsHandlers) {
  if (tickHandle) return;
  ws = wsHandlers;

  log('Demo simulator starting...');
  log(`  Tick interval: ${TICK_MS / 1000}s`);
  log(`  New session probability: ${NEW_SESSION_PROBABILITY * 100}%/tick`);
  log(`  New reservation probability: ${NEW_RESERVATION_PROBABILITY * 100}%/tick`);

  // Run first tick after a short delay (let DB connections warm up)
  setTimeout(() => {
    tick();
    tickHandle = setInterval(tick, TICK_MS);
    log('Demo simulator running.');
  }, 3_000);
}

function stopDemoSimulator() {
  if (tickHandle) {
    clearInterval(tickHandle);
    tickHandle = null;
    log('Demo simulator stopped.');
  }
}

function isDemoMode() {
  return process.env.DEMO_MODE === 'true' || process.env.DEMO_MODE === '1';
}

module.exports = { startDemoSimulator, stopDemoSimulator, isDemoMode };

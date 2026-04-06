const db = require('../config/database');

/**
 * Autonomous Charging Slot Allocation Service
 *
 * Automatically assigns the optimal charging slot to each EV using a
 * multi-factor priority scoring system.
 *
 * ═══════════════════════════════════════════════════════════════
 * SCORING ALGORITHM — 6 weighted factors (total = 1.0)
 * ═══════════════════════════════════════════════════════════════
 *
 *  Factor               Weight   Logic
 *  ──────────────────   ──────   ──────────────────────────────
 *  Availability speed    0.30    Slots available now score 1.0;
 *                                slots available in N minutes
 *                                score decays: max(0, 1 - N/60)
 *
 *  Charging speed match  0.25    Higher-power slots score higher
 *                                for low-battery EVs (<30%).
 *                                Fast charger on low battery = 1.0.
 *                                Over-provisioning penalised
 *                                (Level 1 for 90% EV = 1.0).
 *
 *  Grid load impact      0.15    Slots on a lightly loaded grid
 *                                score higher. If grid is critical,
 *                                fast-charger score is reduced.
 *
 *  Congestion / wait     0.15    Station-level congestion factor;
 *                                lower predicted wait = higher score.
 *
 *  User reservation fit  0.10    If user has a time preference,
 *                                slots whose availability window
 *                                overlaps best score higher.
 *
 *  Charge time estimate  0.05    Estimated time to reach target %
 *                                on this slot; shorter = higher.
 *
 * ═══════════════════════════════════════════════════════════════
 * CHARGING CURVE  (minutes estimation)
 * ═══════════════════════════════════════════════════════════════
 *   0–60%   → 95% efficiency
 *   60–80%  → 85% efficiency
 *   80–90%  → 55% efficiency
 *   90–100% → 35% efficiency
 */

const WEIGHTS = {
  availability: 0.30,
  chargingSpeed: 0.25,
  gridLoad: 0.15,
  congestion: 0.15,
  reservationFit: 0.10,
  chargeTime: 0.05,
};

// ── Charging curve estimation ─────────────────────────────────
function estimateChargeMinutes(startPct, targetPct, powerKw, batteryKwh = 60) {
  let minutes = 0;
  let pct = startPct;
  const step = 2; // simulate in 2% increments for accuracy
  while (pct < targetPct) {
    const segEnd = Math.min(pct + step, targetPct);
    const segEnergy = ((segEnd - pct) / 100) * batteryKwh;
    let efficiency;
    if (pct < 60) efficiency = 0.95;
    else if (pct < 80) efficiency = 0.85;
    else if (pct < 90) efficiency = 0.55;
    else efficiency = 0.35;
    minutes += (segEnergy / (powerKw * efficiency)) * 60;
    pct = segEnd;
  }
  return Math.ceil(minutes);
}

// ── Score: availability (0–1) ─────────────────────────────────
function scoreAvailability(slot, prediction) {
  if (slot.status === 'available') return 1.0;
  if (slot.status === 'maintenance') return 0;
  // Use prediction for when this slot frees up
  if (prediction) {
    const minutes = prediction.predictedMinutes;
    return Math.max(0, 1 - minutes / 60); // decays to 0 at 60 min
  }
  return 0.1; // occupied with no prediction
}

// ── Score: charging speed match (0–1) ─────────────────────────
function scoreChargingSpeed(slot, batteryPct) {
  const powerKw = Number(slot.power_output_kw);
  const needsFast = batteryPct < 30;
  const needsModerate = batteryPct < 60;

  if (needsFast) {
    // Low battery → strongly prefer fast chargers
    if (powerKw >= 100) return 1.0;
    if (powerKw >= 50) return 0.85;
    if (powerKw >= 22) return 0.5;
    return 0.2;
  }

  if (needsModerate) {
    // Moderate battery → fast is good but standard is fine
    if (powerKw >= 50) return 0.9;
    if (powerKw >= 22) return 0.85;
    if (powerKw >= 7) return 0.6;
    return 0.3;
  }

  // High battery (>60%) → standard charger is efficient, fast is overkill
  if (powerKw >= 100) return 0.4; // over-provisioning penalty
  if (powerKw >= 50) return 0.6;
  if (powerKw >= 22) return 0.9;
  if (powerKw >= 7) return 1.0; // Level 2 for top-up
  return 0.7;
}

// ── Score: grid load impact (0–1) ─────────────────────────────
function scoreGridLoad(slot, gridData) {
  if (!gridData) return 0.7; // neutral if no grid data
  const loadPct = Number(gridData.load_percentage) || 0;
  const powerKw = Number(slot.power_output_kw);

  if (loadPct >= 90) {
    // Critical grid → heavily penalise fast chargers
    if (powerKw >= 100) return 0.1;
    if (powerKw >= 50) return 0.3;
    return 0.8;
  }
  if (loadPct >= 70) {
    // Warning → moderate penalty for fast chargers
    if (powerKw >= 100) return 0.4;
    if (powerKw >= 50) return 0.6;
    return 0.9;
  }
  // Normal grid → all slots fine, slight preference for efficient use
  return Math.max(0.6, 1 - (powerKw / 500)); // gentle penalty for max power
}

// ── Score: congestion (0–1) ───────────────────────────────────
function scoreCongestion(congestionData) {
  if (!congestionData) return 0.7;
  const waitMin = Number(congestionData.predicted_wait_minutes) || 0;
  return Math.max(0, 1 - waitMin / 30); // decays to 0 at 30 min wait
}

// ── Score: reservation time fit (0–1) ─────────────────────────
function scoreReservationFit(slot, prediction, preferredStart) {
  if (!preferredStart) return 0.7; // no preference → neutral
  if (slot.status === 'available') return 1.0; // available now, always fits

  if (prediction) {
    const availableAt = new Date(Date.now() + prediction.predictedMinutes * 60000);
    const preferredTime = new Date(preferredStart);
    const diffMin = (preferredTime - availableAt) / 60000;
    // Positive diff means slot available before preferred time → good
    if (diffMin >= 0) return Math.min(1.0, 0.7 + diffMin / 30 * 0.3);
    // Negative diff means slot not ready yet → penalise
    return Math.max(0, 1 + diffMin / 60);
  }
  return 0.3;
}

// ── Score: charge time estimate (0–1) ─────────────────────────
function scoreChargeTime(slot, batteryPct, targetPct) {
  const minutes = estimateChargeMinutes(batteryPct, targetPct, Number(slot.power_output_kw));
  // Normalise: 0 min = 1.0, 120+ min = 0
  return Math.max(0, 1 - minutes / 120);
}

/**
 * ═══════════════════════════════════════════════════════════════
 * MAIN: Recommend optimal slot allocation for a station
 * ═══════════════════════════════════════════════════════════════
 *
 * @param {string} stationId
 * @param {object} params
 * @param {number} params.batteryPercentage   - current EV SoC (0-100)
 * @param {number} [params.targetPercentage]  - desired SoC (default 80)
 * @param {number} [params.batteryCapacityKwh]- battery size (default 60)
 * @param {string} [params.preferredStart]    - ISO8601 preferred time
 * @param {string} [params.connectorType]     - filter by connector
 * @param {string} [params.chargingType]      - filter by level
 */
async function recommendSlot(stationId, params) {
  const {
    batteryPercentage,
    targetPercentage = 80,
    batteryCapacityKwh = 60,
    preferredStart = null,
    connectorType = null,
    chargingType = null,
  } = params;

  // 1. Fetch all slots for this station
  const { rows: allSlots } = await db.query(
    `SELECT cs.*,
            CASE WHEN cs.current_session_id IS NOT NULL
              THEN (
                SELECT row_to_json(sess) FROM (
                  SELECT id, status, current_percentage, target_percentage,
                         start_percentage, energy_delivered_kwh, average_power_kw,
                         started_at, vehicle_battery_capacity_kwh
                  FROM charging_sessions
                  WHERE id = cs.current_session_id
                ) sess
              )
              ELSE NULL
            END AS active_session
     FROM charging_slots cs
     WHERE cs.station_id = $1
     ORDER BY cs.slot_number`,
    [stationId],
  );

  if (allSlots.length === 0) {
    return { recommendation: null, rankings: [], queue: null, message: 'No charging slots at this station' };
  }

  // 2. Apply connector/type filters
  let candidates = allSlots.filter((s) => s.status !== 'maintenance');
  if (connectorType) candidates = candidates.filter((s) => s.connector_type === connectorType);
  if (chargingType) candidates = candidates.filter((s) => s.charging_type === chargingType);

  if (candidates.length === 0) {
    return { recommendation: null, rankings: [], queue: null, message: 'No compatible slots available' };
  }

  // 3. Fetch prediction data for occupied/reserved slots
  const predictionMap = {};
  const occupiedSlots = candidates.filter((s) => s.status !== 'available');
  for (const slot of occupiedSlots) {
    if (slot.active_session && slot.active_session.status === 'charging') {
      const sess = slot.active_session;
      const current = Number(sess.current_percentage);
      const target = Number(sess.target_percentage);
      const powerKw = Number(sess.average_power_kw || slot.power_output_kw || 22);
      const battKwh = Number(sess.vehicle_battery_capacity_kwh) || 60;
      if (target > current) {
        const minutes = estimateChargeMinutes(current, target, powerKw, battKwh);
        predictionMap[slot.id] = {
          predictedMinutes: minutes,
          confidence: 0.8,
          source: 'active_session',
        };
      } else {
        predictionMap[slot.id] = { predictedMinutes: 1, confidence: 0.95, source: 'near_complete' };
      }
    } else if (slot.status === 'reserved') {
      // Check reservation end time
      const { rows: resRows } = await db.query(
        `SELECT scheduled_end FROM reservations
         WHERE slot_id = $1 AND status IN ('confirmed', 'active')
         ORDER BY scheduled_end ASC LIMIT 1`,
        [slot.id],
      );
      if (resRows.length > 0) {
        const endTime = new Date(resRows[0].scheduled_end);
        const minutes = Math.max(1, Math.ceil((endTime - Date.now()) / 60000));
        predictionMap[slot.id] = { predictedMinutes: minutes, confidence: 0.5, source: 'reservation' };
      }
    }
  }

  // 4. Fetch grid load data
  const { rows: gridRows } = await db.query(
    `SELECT * FROM grid_load_profiles WHERE station_id = $1`, [stationId],
  );
  const gridData = gridRows[0] || null;

  // 5. Fetch current-hour congestion prediction
  const now = new Date();
  const { rows: congestionRows } = await db.query(
    `SELECT * FROM congestion_predictions
     WHERE station_id = $1 AND predicted_for > $2
     ORDER BY predicted_for ASC LIMIT 1`,
    [stationId, now.toISOString()],
  );
  const congestionData = congestionRows[0] || null;

  // 6. Score every candidate slot
  const rankings = candidates.map((slot) => {
    const pred = predictionMap[slot.id] || null;
    const availabilityMinutes = slot.status === 'available' ? 0 : (pred?.predictedMinutes ?? 30);

    const scores = {
      availability: scoreAvailability(slot, pred),
      chargingSpeed: scoreChargingSpeed(slot, batteryPercentage),
      gridLoad: scoreGridLoad(slot, gridData),
      congestion: scoreCongestion(congestionData),
      reservationFit: scoreReservationFit(slot, pred, preferredStart),
      chargeTime: scoreChargeTime(slot, batteryPercentage, targetPercentage),
    };

    const totalScore =
      scores.availability * WEIGHTS.availability +
      scores.chargingSpeed * WEIGHTS.chargingSpeed +
      scores.gridLoad * WEIGHTS.gridLoad +
      scores.congestion * WEIGHTS.congestion +
      scores.reservationFit * WEIGHTS.reservationFit +
      scores.chargeTime * WEIGHTS.chargeTime;

    const estimatedChargeMin = estimateChargeMinutes(
      batteryPercentage, targetPercentage, Number(slot.power_output_kw), batteryCapacityKwh,
    );

    return {
      slotId: slot.id,
      slotNumber: slot.slot_number,
      chargingType: slot.charging_type,
      connectorType: slot.connector_type,
      powerOutputKw: Number(slot.power_output_kw),
      status: slot.status,
      totalScore: Math.round(totalScore * 1000) / 1000,
      scores,
      availableIn: availabilityMinutes,
      estimatedChargeMinutes: estimatedChargeMin,
      estimatedCompletionTime: new Date(
        Date.now() + (availabilityMinutes + estimatedChargeMin) * 60000,
      ).toISOString(),
      chargingStartTime: slot.status === 'available'
        ? 'immediate'
        : new Date(Date.now() + availabilityMinutes * 60000).toISOString(),
      prediction: pred,
    };
  });

  // Sort by total score descending
  rankings.sort((a, b) => b.totalScore - a.totalScore);
  const best = rankings[0];

  // 7. Build queue info if all slots occupied
  const availableCount = candidates.filter((s) => s.status === 'available').length;
  let queue = null;
  if (availableCount === 0) {
    // Find how many are waiting (existing queue entries)
    const { rows: queueRows } = await db.query(
      `SELECT COUNT(*)::int AS count FROM slot_allocation_queue
       WHERE station_id = $1 AND status = 'waiting'`,
      [stationId],
    );
    const queuePosition = (queueRows[0]?.count || 0) + 1; // this user would be next

    queue = {
      position: queuePosition,
      estimatedWaitMinutes: best?.availableIn || 30,
      nextSlotAvailable: best ? {
        slotNumber: best.slotNumber,
        availableIn: best.availableIn,
        powerKw: best.powerOutputKw,
      } : null,
      message: `All slots occupied. You are #${queuePosition} in queue. Next slot estimated in ~${best?.availableIn || 30} min.`,
    };
  }

  // 8. Build recommendation
  const recommendation = best ? {
    slotId: best.slotId,
    slotNumber: best.slotNumber,
    chargingType: best.chargingType,
    connectorType: best.connectorType,
    powerOutputKw: best.powerOutputKw,
    status: best.status,
    score: best.totalScore,
    chargingStartTime: best.chargingStartTime,
    estimatedChargeMinutes: best.estimatedChargeMinutes,
    estimatedCompletionTime: best.estimatedCompletionTime,
    availableIn: best.availableIn,
    reason: buildReasonText(best, batteryPercentage, gridData),
  } : null;

  return {
    recommendation,
    rankings: rankings.slice(0, 10),
    queue,
    factors: {
      batteryPercentage,
      targetPercentage,
      gridStatus: gridData?.grid_status || 'unknown',
      gridLoadPct: gridData ? Number(gridData.load_percentage) : null,
      congestionLevel: congestionData?.congestion_level || 'unknown',
      totalSlots: allSlots.length,
      availableSlots: availableCount,
    },
    message: recommendation
      ? `Recommended Slot #${recommendation.slotNumber} — ${recommendation.chargingStartTime === 'immediate' ? 'Start immediately' : `Available in ~${best.availableIn} min`}. Estimated full charge: ${recommendation.estimatedChargeMinutes} min.`
      : 'No compatible slots found.',
  };
}

// ── Build human-readable reason text ──────────────────────────
function buildReasonText(ranking, batteryPct, gridData) {
  const reasons = [];

  if (ranking.status === 'available') {
    reasons.push('Available now — no waiting');
  } else {
    reasons.push(`Available in ~${ranking.availableIn} minutes`);
  }

  if (batteryPct < 30 && ranking.powerOutputKw >= 50) {
    reasons.push(`Fast ${ranking.powerOutputKw}kW charger optimal for low battery (${batteryPct}%)`);
  } else if (batteryPct >= 60 && ranking.powerOutputKw <= 22) {
    reasons.push('Standard charger efficient for your battery level');
  } else {
    reasons.push(`${ranking.powerOutputKw}kW charger — estimated ${ranking.estimatedChargeMinutes} min`);
  }

  if (gridData) {
    const gridStatus = gridData.grid_status;
    if (gridStatus === 'normal') {
      reasons.push('Grid load is normal');
    } else if (gridStatus === 'warning') {
      reasons.push('Grid under moderate load — slower charger preferred');
    } else if (gridStatus === 'critical' || gridStatus === 'emergency') {
      reasons.push('Grid at high load — power may be limited');
    }
  }

  return reasons.join('. ') + '.';
}

/**
 * ═══════════════════════════════════════════════════════════════
 * QUEUE MANAGEMENT
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * Add user to the waiting queue for a station.
 */
async function joinQueue(userId, stationId, params) {
  const {
    batteryPercentage,
    targetPercentage = 80,
    batteryCapacityKwh = 60,
    connectorType = null,
    chargingType = null,
  } = params;

  // Check if already in queue
  const { rows: existing } = await db.query(
    `SELECT id FROM slot_allocation_queue
     WHERE user_id = $1 AND station_id = $2 AND status = 'waiting'`,
    [userId, stationId],
  );
  if (existing.length > 0) {
    return getQueueEntry(existing[0].id);
  }

  // Get current position
  const { rows: posRows } = await db.query(
    `SELECT COUNT(*)::int AS count FROM slot_allocation_queue
     WHERE station_id = $1 AND status = 'waiting'`,
    [stationId],
  );
  const position = (posRows[0]?.count || 0) + 1;

  // Get recommendation for ETA
  const rec = await recommendSlot(stationId, params);
  const estimatedWait = rec.recommendation?.availableIn || 30;

  const { rows: created } = await db.query(
    `INSERT INTO slot_allocation_queue
       (user_id, station_id, battery_percentage, target_percentage,
        battery_capacity_kwh, connector_preference, charging_type_preference,
        queue_position, estimated_wait_minutes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [userId, stationId, batteryPercentage, targetPercentage,
     batteryCapacityKwh, connectorType, chargingType, position, estimatedWait],
  );

  return formatQueueEntry(created[0]);
}

/**
 * Leave the queue.
 */
async function leaveQueue(userId, stationId) {
  const { rows } = await db.query(
    `UPDATE slot_allocation_queue SET status = 'cancelled', updated_at = NOW()
     WHERE user_id = $1 AND station_id = $2 AND status = 'waiting'
     RETURNING *`,
    [userId, stationId],
  );
  // Re-order remaining positions
  await reorderQueue(stationId);
  return rows[0] ? formatQueueEntry(rows[0]) : null;
}

/**
 * Process the queue when a slot becomes available — called by charging completion hook.
 */
async function processQueue(stationId) {
  // Get the first waiting user
  const { rows: waiting } = await db.query(
    `SELECT * FROM slot_allocation_queue
     WHERE station_id = $1 AND status = 'waiting'
     ORDER BY queue_position ASC LIMIT 1`,
    [stationId],
  );

  if (waiting.length === 0) return null;

  const entry = waiting[0];

  // Get fresh recommendation for this user
  const rec = await recommendSlot(stationId, {
    batteryPercentage: Number(entry.battery_percentage),
    targetPercentage: Number(entry.target_percentage),
    batteryCapacityKwh: Number(entry.battery_capacity_kwh),
    connectorType: entry.connector_preference,
    chargingType: entry.charging_type_preference,
  });

  if (!rec.recommendation || rec.recommendation.status !== 'available') {
    return null; // no slot actually available
  }

  // Mark as assigned
  await db.query(
    `UPDATE slot_allocation_queue
     SET status = 'assigned', assigned_slot_id = $2, updated_at = NOW()
     WHERE id = $1`,
    [entry.id, rec.recommendation.slotId],
  );

  await reorderQueue(stationId);

  return {
    userId: entry.user_id,
    stationId,
    assignedSlot: rec.recommendation,
    queueEntry: formatQueueEntry({ ...entry, status: 'assigned', assigned_slot_id: rec.recommendation.slotId }),
  };
}

/**
 * Check for dynamic reassignment — if a better slot opens, notify the user.
 */
async function checkReassignment(stationId) {
  // Get all confirmed reservations at this station that haven't started charging
  const { rows: activeReservations } = await db.query(
    `SELECT r.id, r.user_id, r.slot_id, r.scheduled_start, r.scheduled_end,
            cs.power_output_kw, cs.slot_number, cs.charging_type, cs.connector_type
     FROM reservations r
     JOIN charging_slots cs ON cs.id = r.slot_id
     WHERE r.station_id = $1 AND r.status = 'confirmed'
     ORDER BY r.scheduled_start ASC`,
    [stationId],
  );

  const reassignments = [];

  for (const res of activeReservations) {
    // Check if a better slot is now available
    const { rows: betterSlots } = await db.query(
      `SELECT * FROM charging_slots
       WHERE station_id = $1 AND status = 'available' AND id != $2
         AND connector_type = $3
         AND power_output_kw >= $4
       ORDER BY power_output_kw DESC LIMIT 1`,
      [stationId, res.slot_id, res.connector_type, res.power_output_kw],
    );

    if (betterSlots.length > 0) {
      const better = betterSlots[0];
      // Only suggest if the better slot has significantly more power
      if (Number(better.power_output_kw) > Number(res.power_output_kw) * 1.3) {
        reassignments.push({
          reservationId: res.id,
          userId: res.user_id,
          currentSlot: {
            slotId: res.slot_id,
            slotNumber: res.slot_number,
            powerKw: Number(res.power_output_kw),
          },
          betterSlot: {
            slotId: better.id,
            slotNumber: better.slot_number,
            powerKw: Number(better.power_output_kw),
            chargingType: better.charging_type,
          },
          reason: `Faster charger available: ${better.power_output_kw}kW vs current ${res.power_output_kw}kW`,
        });
      }
    }
  }

  return reassignments;
}

/**
 * Get the current queue for a station.
 */
async function getStationQueue(stationId) {
  const { rows } = await db.query(
    `SELECT saq.*, u.full_name as user_name
     FROM slot_allocation_queue saq
     JOIN users u ON u.id = saq.user_id
     WHERE saq.station_id = $1 AND saq.status = 'waiting'
     ORDER BY saq.queue_position ASC`,
    [stationId],
  );
  return rows.map(formatQueueEntry);
}

/**
 * Get a user's queue status at a station.
 */
async function getUserQueueStatus(userId, stationId) {
  const { rows } = await db.query(
    `SELECT * FROM slot_allocation_queue
     WHERE user_id = $1 AND station_id = $2 AND status = 'waiting'`,
    [userId, stationId],
  );
  if (rows.length === 0) return null;
  return formatQueueEntry(rows[0]);
}

// ── Helpers ───────────────────────────────────────────────────
async function reorderQueue(stationId) {
  await db.query(
    `WITH ordered AS (
       SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS new_pos
       FROM slot_allocation_queue
       WHERE station_id = $1 AND status = 'waiting'
     )
     UPDATE slot_allocation_queue SET queue_position = ordered.new_pos
     FROM ordered WHERE slot_allocation_queue.id = ordered.id`,
    [stationId],
  );
}

async function getQueueEntry(id) {
  const { rows } = await db.query('SELECT * FROM slot_allocation_queue WHERE id = $1', [id]);
  return rows[0] ? formatQueueEntry(rows[0]) : null;
}

function formatQueueEntry(entry) {
  return {
    id: entry.id,
    userId: entry.user_id,
    stationId: entry.station_id,
    userName: entry.user_name || undefined,
    batteryPercentage: Number(entry.battery_percentage),
    targetPercentage: Number(entry.target_percentage),
    connectorPreference: entry.connector_preference,
    chargingTypePreference: entry.charging_type_preference,
    queuePosition: entry.queue_position,
    estimatedWaitMinutes: Number(entry.estimated_wait_minutes),
    status: entry.status,
    assignedSlotId: entry.assigned_slot_id,
    createdAt: entry.created_at,
  };
}

module.exports = {
  recommendSlot,
  joinQueue,
  leaveQueue,
  processQueue,
  checkReassignment,
  getStationQueue,
  getUserQueueStatus,
  estimateChargeMinutes,
};

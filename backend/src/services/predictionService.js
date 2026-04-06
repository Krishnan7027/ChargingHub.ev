const db = require('../config/database');

/**
 * ═══════════════════════════════════════════════════════════════
 * ADVANCED PREDICTION ENGINE (Production-Grade)
 * ═══════════════════════════════════════════════════════════════
 *
 * Multi-factor prediction system using:
 *   1. Active charging sessions (real-time % + multi-segment curve)
 *   2. Upcoming reservation end times
 *   3. Historical usage patterns (day-of-week × hour-of-day)
 *   4. Congestion/demand patterns
 *   5. Queue depth pressure
 *   6. Time-of-day demand multipliers
 *
 * NEW: ETA-based predictions — factor in user arrival time
 * to suggest the best slot at the moment they arrive.
 */

// ── Time-of-day demand multipliers ─────────────────────────────
// Derived from typical EV charging patterns across urban stations.
const HOURLY_DEMAND = [
  0.15, 0.10, 0.08, 0.08, 0.10, 0.15, // 00–05: overnight low
  0.30, 0.55, 0.75, 0.70, 0.60, 0.55, // 06–11: morning commute peak
  0.65, 0.70, 0.65, 0.60, 0.70, 0.85, // 12–17: afternoon + evening commute
  0.90, 0.80, 0.65, 0.50, 0.35, 0.20, // 18–23: evening peak then taper
];

// ── Charging curve simulation ──────────────────────────────────
function estimateChargeMinutes(startPct, targetPct, powerKw, batteryKwh = 60) {
  let minutes = 0;
  let pct = startPct;
  const step = 2;
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

const predictionService = {
  /**
   * Smart Slot Prediction — predicts when the next slot becomes available.
   * Each prediction carries a confidence score (0–1) based on input quality.
   */
  async predictNextAvailable(stationId) {
    const now = new Date();

    // ── 1. Check current availability ───────────────────────
    const { rows: freeSlots } = await db.query(
      `SELECT id, slot_number, power_output_kw, charging_type, connector_type
       FROM charging_slots
       WHERE station_id = $1 AND status = 'available'`,
      [stationId],
    );

    if (freeSlots.length > 0) {
      return {
        available: true,
        availableSlots: freeSlots.length,
        estimatedMinutes: 0,
        slots: freeSlots.map((s) => ({
          slotId: s.id,
          slotNumber: s.slot_number,
          powerKw: Number(s.power_output_kw),
          chargingType: s.charging_type,
          connectorType: s.connector_type,
        })),
        predictions: [],
        nextAvailable: null,
        demandFactor: HOURLY_DEMAND[now.getHours()],
        message: `${freeSlots.length} slot(s) available now`,
      };
    }

    // ── 2–6. Gather all independent data in parallel ────────
    const dayOfWeek = now.getDay();
    const hourOfDay = now.getHours();

    const [
      { rows: sessions },
      { rows: reservations },
      { rows: historyRows },
      { rows: queueRows },
      { rows: congestionRows },
    ] = await Promise.all([
      // 2. Active charging sessions
      db.query(
        `SELECT cs.id AS session_id, cs.slot_id, cs.current_percentage,
                cs.target_percentage, cs.start_percentage,
                cs.energy_delivered_kwh, cs.average_power_kw, cs.started_at,
                cs.vehicle_battery_capacity_kwh,
                ck.slot_number, ck.power_output_kw
         FROM charging_sessions cs
         JOIN charging_slots ck ON ck.id = cs.slot_id
         WHERE ck.station_id = $1 AND cs.status = 'charging'`,
        [stationId],
      ),
      // 3. Upcoming reservation end times
      db.query(
        `SELECT r.slot_id, r.scheduled_end, ck.slot_number
         FROM reservations r
         JOIN charging_slots ck ON ck.id = r.slot_id
         WHERE r.station_id = $1 AND r.status IN ('confirmed', 'active')`,
        [stationId],
      ),
      // 4. Historical averages for current day/hour
      db.query(
        `SELECT slot_id, avg_session_duration_min, usage_count
         FROM slot_usage_history
         WHERE station_id = $1 AND day_of_week = $2 AND hour_of_day = $3`,
        [stationId, dayOfWeek, hourOfDay],
      ),
      // 5. Queue depth
      db.query(
        `SELECT COUNT(*)::int AS depth FROM slot_allocation_queue
         WHERE station_id = $1 AND status = 'waiting'`,
        [stationId],
      ),
      // 6. Congestion prediction for this hour
      db.query(
        `SELECT predicted_occupancy_pct, predicted_wait_minutes
         FROM congestion_predictions
         WHERE station_id = $1 AND predicted_for > $2
         ORDER BY predicted_for ASC LIMIT 1`,
        [stationId, now.toISOString()],
      ),
    ]);

    const historyMap = new Map(historyRows.map((h) => [h.slot_id, h]));
    const queueDepth = queueRows[0]?.depth || 0;
    const congestion = congestionRows[0] || null;

    const predictions = [];

    // ── Session-based predictions (highest confidence) ──────
    for (const sess of sessions) {
      const current = Number(sess.current_percentage);
      const target = Number(sess.target_percentage);
      const remaining = target - current;

      if (remaining <= 0) {
        predictions.push({
          slotId: sess.slot_id,
          slotNumber: sess.slot_number,
          predictedMinutes: 1,
          confidence: 0.95,
          source: 'charging_near_complete',
          details: { currentPct: current, targetPct: target },
        });
        continue;
      }

      const batteryKwh = Number(sess.vehicle_battery_capacity_kwh) || 60;
      const powerKw = Number(sess.average_power_kw) || Number(sess.power_output_kw) || 22;
      const minutes = estimateChargeMinutes(current, target, powerKw, batteryKwh);

      // Confidence based on data quality
      let confidence = 0.70;
      if (sess.average_power_kw) confidence += 0.10;
      if (current > 50) confidence += 0.05;
      if (sess.started_at) {
        const elapsedMin = (now - new Date(sess.started_at)) / 60_000;
        const progressRate = (current - Number(sess.start_percentage)) / Math.max(elapsedMin, 1);
        if (progressRate > 0) confidence += 0.05;

        // Cross-validate: if curve-based estimate diverges from rate-based, lower confidence
        if (elapsedMin > 5 && progressRate > 0) {
          const rateBasedMinutes = remaining / progressRate;
          const divergence = Math.abs(rateBasedMinutes - minutes) / Math.max(minutes, 1);
          if (divergence > 0.5) confidence -= 0.10;
        }
      }
      // Queue pressure reduces confidence (slot may be held longer)
      if (queueDepth > 3) confidence -= 0.05;
      confidence = Math.min(Math.max(confidence, 0.15), 0.98);

      predictions.push({
        slotId: sess.slot_id,
        slotNumber: sess.slot_number,
        predictedMinutes: minutes,
        confidence: Math.round(confidence * 100) / 100,
        source: 'charging_progress',
        details: {
          currentPct: current,
          targetPct: target,
          powerKw,
          batteryKwh,
          energyNeededKwh: Math.round(((target - current) / 100) * batteryKwh * 10) / 10,
        },
      });
    }

    // ── Reservation-based predictions ───────────────────────
    const coveredBySession = new Set(predictions.map((p) => p.slotId));

    for (const res of reservations) {
      if (coveredBySession.has(res.slot_id)) continue;

      const endTime = new Date(res.scheduled_end);
      const minutes = Math.max(Math.ceil((endTime - now) / 60_000), 1);

      predictions.push({
        slotId: res.slot_id,
        slotNumber: res.slot_number,
        predictedMinutes: minutes,
        confidence: 0.50,
        source: 'reservation_schedule',
        details: { scheduledEnd: res.scheduled_end },
      });
    }

    // ── Historical fallback for uncovered slots ─────────────
    const coveredSlots = new Set(predictions.map((p) => p.slotId));
    const { rows: busySlots } = await db.query(
      `SELECT id, slot_number FROM charging_slots
       WHERE station_id = $1 AND status != 'available'`,
      [stationId],
    );

    for (const slot of busySlots) {
      if (coveredSlots.has(slot.id)) continue;
      const hist = historyMap.get(slot.id);
      if (hist && Number(hist.avg_session_duration_min) > 0) {
        const usageCount = Number(hist.usage_count);
        // Apply time-of-day multiplier to historical average
        const demandMultiplier = HOURLY_DEMAND[hourOfDay];
        const adjustedDuration = Math.ceil(
          Number(hist.avg_session_duration_min) * (0.7 + demandMultiplier * 0.6)
        );
        predictions.push({
          slotId: slot.id,
          slotNumber: slot.slot_number,
          predictedMinutes: adjustedDuration,
          confidence: Math.min(0.30 + usageCount * 0.02, 0.60),
          source: 'historical_adjusted',
          details: {
            avgDurationMin: Number(hist.avg_session_duration_min),
            sampleCount: usageCount,
            demandMultiplier,
          },
        });
      } else {
        predictions.push({
          slotId: slot.id,
          slotNumber: slot.slot_number,
          predictedMinutes: 30,
          confidence: 0.20,
          source: 'default_estimate',
          details: {},
        });
      }
    }

    // Sort by soonest first
    predictions.sort((a, b) => a.predictedMinutes - b.predictedMinutes);
    const best = predictions[0] || null;

    return {
      available: false,
      availableSlots: 0,
      estimatedMinutes: best ? best.predictedMinutes : null,
      slots: [],
      predictions,
      nextAvailable: best
        ? {
            slotNumber: best.slotNumber,
            predictedMinutes: best.predictedMinutes,
            confidence: best.confidence,
            source: best.source,
            predictedAvailableAt: new Date(
              now.getTime() + best.predictedMinutes * 60_000,
            ).toISOString(),
          }
        : null,
      queueDepth,
      demandFactor: HOURLY_DEMAND[hourOfDay],
      congestion: congestion
        ? {
            occupancyPct: Number(congestion.predicted_occupancy_pct),
            waitMinutes: Number(congestion.predicted_wait_minutes),
          }
        : null,
      message: best
        ? best.predictedMinutes <= 1
          ? 'A slot should be available very soon'
          : `Slot #${best.slotNumber} available in ~${best.predictedMinutes} min (${Math.round(best.confidence * 100)}% confidence)`
        : 'Unable to estimate availability',
    };
  },

  /**
   * ═══════════════════════════════════════════════════════════
   * ETA-BASED PREDICTION
   * ═══════════════════════════════════════════════════════════
   *
   * Given a user's ETA to the station, predict which slot
   * will be available when they arrive and recommend the best one.
   *
   * @param {string} stationId
   * @param {number} etaMinutes - User's estimated arrival time in minutes
   * @param {object} [preferences] - Optional connector/charging type filters
   */
  async predictForArrival(stationId, etaMinutes, preferences = {}) {
    const now = new Date();
    const arrivalTime = new Date(now.getTime() + etaMinutes * 60_000);
    const arrivalHour = arrivalTime.getHours();

    // Get base predictions
    const basePrediction = await this.predictNextAvailable(stationId);

    // If slots are available now and ETA is soon, great
    if (basePrediction.available && etaMinutes < 15) {
      return {
        ...basePrediction,
        etaMinutes,
        arrivalTime: arrivalTime.toISOString(),
        recommendation: 'Slots available now. Head there directly!',
        arrivalDemandFactor: HOURLY_DEMAND[arrivalHour],
      };
    }

    // Filter predictions: which slots will be free by arrival?
    const availableAtArrival = basePrediction.predictions.filter(
      (p) => p.predictedMinutes <= etaMinutes
    );

    // Apply connector preference filter
    let filtered = availableAtArrival;
    if (preferences.connectorType || preferences.chargingType) {
      const { rows: slotDetails } = await db.query(
        `SELECT id, connector_type, charging_type, power_output_kw
         FROM charging_slots WHERE station_id = $1`,
        [stationId],
      );
      const slotMap = new Map(slotDetails.map((s) => [s.id, s]));

      filtered = availableAtArrival.filter((p) => {
        const slot = slotMap.get(p.slotId);
        if (!slot) return false;
        if (preferences.connectorType && slot.connector_type !== preferences.connectorType) return false;
        if (preferences.chargingType && slot.charging_type !== preferences.chargingType) return false;
        return true;
      });
    }

    // Rank by: (1) available soonest before arrival, (2) highest confidence
    filtered.sort((a, b) => {
      const aBuffer = etaMinutes - a.predictedMinutes;
      const bBuffer = etaMinutes - b.predictedMinutes;
      // Prefer slots with more buffer time (available well before arrival)
      const aScore = aBuffer * 0.6 + a.confidence * 40;
      const bScore = bBuffer * 0.6 + b.confidence * 40;
      return bScore - aScore;
    });

    const bestForArrival = filtered[0] || null;

    // Check demand at arrival hour
    const arrivalDemand = HOURLY_DEMAND[arrivalHour];
    let recommendation;

    if (filtered.length >= 2) {
      recommendation = `${filtered.length} slots predicted available by your arrival. ` +
        `Best option: Slot #${bestForArrival.slotNumber}.`;
    } else if (filtered.length === 1) {
      recommendation = `1 slot predicted available by your arrival: Slot #${bestForArrival.slotNumber}. ` +
        `Consider arriving on time — demand is ${arrivalDemand > 0.7 ? 'high' : 'moderate'} at ${arrivalHour}:00.`;
    } else if (basePrediction.predictions.length > 0) {
      const soonest = basePrediction.predictions[0];
      const waitAfterArrival = soonest.predictedMinutes - etaMinutes;
      recommendation = `No slots predicted free by your arrival. ` +
        `Earliest: Slot #${soonest.slotNumber} ~${Math.max(0, waitAfterArrival)} min after you arrive. ` +
        `Consider joining the queue.`;
    } else {
      recommendation = 'Unable to predict availability at your arrival time.';
    }

    return {
      available: basePrediction.available,
      availableSlots: basePrediction.availableSlots,
      etaMinutes,
      arrivalTime: arrivalTime.toISOString(),
      arrivalDemandFactor: arrivalDemand,
      slotsAvailableAtArrival: filtered.length,
      bestSlotForArrival: bestForArrival
        ? {
            slotNumber: bestForArrival.slotNumber,
            slotId: bestForArrival.slotId,
            availableInMinutes: bestForArrival.predictedMinutes,
            bufferMinutes: etaMinutes - bestForArrival.predictedMinutes,
            confidence: bestForArrival.confidence,
            source: bestForArrival.source,
          }
        : null,
      allPredictions: basePrediction.predictions,
      queueDepth: basePrediction.queueDepth,
      recommendation,
    };
  },

  /**
   * Record usage data for future historical predictions.
   */
  async recordUsage(slotId, stationId, durationMin, energyKwh) {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const hourOfDay = now.getHours();

    await db.query(
      `INSERT INTO slot_usage_history (slot_id, station_id, day_of_week, hour_of_day, avg_session_duration_min, avg_energy_kwh, usage_count)
       VALUES ($1, $2, $3, $4, $5, $6, 1)
       ON CONFLICT (slot_id, day_of_week, hour_of_day)
       DO UPDATE SET
         avg_session_duration_min = (slot_usage_history.avg_session_duration_min * slot_usage_history.usage_count + $5) / (slot_usage_history.usage_count + 1),
         avg_energy_kwh = (slot_usage_history.avg_energy_kwh * slot_usage_history.usage_count + $6) / (slot_usage_history.usage_count + 1),
         usage_count = slot_usage_history.usage_count + 1,
         updated_at = NOW()`,
      [slotId, stationId, dayOfWeek, hourOfDay, durationMin, energyKwh],
    );
  },

  /**
   * Get hourly demand profile for a station (24-hour pattern).
   */
  getHourlyDemandProfile() {
    return HOURLY_DEMAND.map((factor, hour) => ({
      hour,
      demandFactor: factor,
      label: factor > 0.8 ? 'peak' : factor > 0.5 ? 'moderate' : 'low',
    }));
  },
};

module.exports = predictionService;

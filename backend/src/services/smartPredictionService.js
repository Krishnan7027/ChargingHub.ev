const db = require('../config/database');

/**
 * Enhanced slot prediction with confidence scoring.
 *
 * Combines multiple data sources and assigns a confidence score (0–1)
 * based on the quality and freshness of inputs.
 */
async function predictSlotAvailability(stationId) {
  // 1. Check current availability
  const { rows: availableSlots } = await db.query(
    `SELECT id, slot_number, power_output_kw, charging_type
     FROM charging_slots
     WHERE station_id = $1 AND status = 'available'`,
    [stationId],
  );

  if (availableSlots.length > 0) {
    return {
      available: true,
      availableSlots: availableSlots.length,
      slots: availableSlots.map((s) => ({
        slotId: s.id,
        slotNumber: s.slot_number,
        powerKw: Number(s.power_output_kw),
        chargingType: s.charging_type,
      })),
      predictions: [],
      message: `${availableSlots.length} slot(s) available now`,
    };
  }

  // 2. Gather predictions from all active sessions
  const { rows: sessions } = await db.query(
    `SELECT cs.id, cs.slot_id, cs.current_percentage, cs.target_percentage,
            cs.start_percentage, cs.energy_delivered_kwh, cs.average_power_kw,
            cs.started_at, cs.vehicle_battery_capacity_kwh,
            ck.slot_number, ck.power_output_kw
     FROM charging_sessions cs
     JOIN charging_slots ck ON ck.id = cs.slot_id
     WHERE ck.station_id = $1 AND cs.status = 'charging'`,
    [stationId],
  );

  // 3. Gather reservation predictions
  const { rows: reservations } = await db.query(
    `SELECT r.slot_id, r.scheduled_end, ck.slot_number
     FROM reservations r
     JOIN charging_slots ck ON ck.id = r.slot_id
     WHERE r.station_id = $1 AND r.status IN ('confirmed', 'active')`,
    [stationId],
  );

  // 4. Historical averages for current day/hour
  const now = new Date();
  const dayOfWeek = now.getDay();
  const hourOfDay = now.getHours();

  const { rows: history } = await db.query(
    `SELECT slot_id, avg_session_duration_min, usage_count
     FROM slot_usage_history
     WHERE station_id = $1 AND day_of_week = $2 AND hour_of_day = $3`,
    [stationId, dayOfWeek, hourOfDay],
  );
  const historyMap = Object.fromEntries(history.map((h) => [h.slot_id, h]));

  const predictions = [];

  // ── Session-based predictions ─────────────────────────
  for (const sess of sessions) {
    const batteryKwh = Number(sess.vehicle_battery_capacity_kwh) || 60;
    const current = Number(sess.current_percentage);
    const target = Number(sess.target_percentage);
    const remaining = target - current;

    if (remaining <= 0) {
      predictions.push({
        slotId: sess.slot_id,
        slotNumber: sess.slot_number,
        predictedMinutes: 1,
        confidence: 0.95,
        source: 'charging_progress',
        details: { currentPct: current, targetPct: target },
      });
      continue;
    }

    const powerKw = Number(sess.average_power_kw) || Number(sess.power_output_kw) || 50;
    const energyNeeded = (remaining / 100) * batteryKwh;

    // Multi-segment charging curve
    let minutes = 0;
    let pct = current;
    const step = 5; // simulate in 5% increments
    while (pct < target) {
      const segEnd = Math.min(pct + step, target);
      const segEnergy = ((segEnd - pct) / 100) * batteryKwh;
      let efficiency;
      if (pct < 60) efficiency = 0.95;
      else if (pct < 80) efficiency = 0.85;
      else if (pct < 90) efficiency = 0.55;
      else efficiency = 0.35;

      minutes += (segEnergy / (powerKw * efficiency)) * 60;
      pct = segEnd;
    }
    minutes = Math.ceil(minutes);

    // Confidence based on data quality
    let confidence = 0.7;
    if (sess.average_power_kw) confidence += 0.1;   // real-time power data
    if (sess.vehicle_battery_capacity_kwh) confidence += 0.1; // known battery
    // Sessions far along are more predictable
    if (current > 50) confidence += 0.05;
    confidence = Math.min(confidence, 0.98);

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
        energyNeededKwh: Math.round(energyNeeded * 10) / 10,
      },
    });
  }

  // ── Reservation-based predictions ─────────────────────
  for (const res of reservations) {
    const endTime = new Date(res.scheduled_end);
    const minutes = Math.max(Math.ceil((endTime - now) / 60000), 1);

    // Already have a session-based prediction for this slot?
    const existing = predictions.find((p) => p.slotId === res.slot_id);
    if (existing && existing.confidence > 0.5) continue;

    predictions.push({
      slotId: res.slot_id,
      slotNumber: res.slot_number,
      predictedMinutes: minutes,
      confidence: 0.50, // reservations are less reliable
      source: 'reservation_schedule',
      details: { scheduledEnd: res.scheduled_end },
    });
  }

  // ── History-based fallbacks for slots with no live data ─
  const coveredSlots = new Set(predictions.map((p) => p.slotId));
  const { rows: allSlots } = await db.query(
    `SELECT id, slot_number FROM charging_slots WHERE station_id = $1 AND status != 'available'`,
    [stationId],
  );
  for (const slot of allSlots) {
    if (coveredSlots.has(slot.id)) continue;
    const hist = historyMap[slot.id];
    if (hist) {
      predictions.push({
        slotId: slot.id,
        slotNumber: slot.slot_number,
        predictedMinutes: Math.ceil(Number(hist.avg_session_duration_min) || 30),
        confidence: Math.min(0.3 + Number(hist.usage_count) * 0.02, 0.60),
        source: 'historical_average',
        details: { avgDurationMin: Number(hist.avg_session_duration_min), sampleCount: Number(hist.usage_count) },
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

  // Sort by predicted time (soonest first)
  predictions.sort((a, b) => a.predictedMinutes - b.predictedMinutes);
  const best = predictions[0] || null;

  return {
    available: false,
    availableSlots: 0,
    predictions,
    nextAvailable: best
      ? {
          slotNumber: best.slotNumber,
          predictedMinutes: best.predictedMinutes,
          confidence: best.confidence,
          source: best.source,
          predicted_slot_available_time: new Date(
            now.getTime() + best.predictedMinutes * 60000,
          ).toISOString(),
          confidence_score: best.confidence,
        }
      : null,
    message: best
      ? `Slot #${best.slotNumber} will be free in ~${best.predictedMinutes} minutes (${Math.round(best.confidence * 100)}% confidence)`
      : 'No prediction data available',
  };
}

module.exports = { predictSlotAvailability };

const db = require('../config/database');

/**
 * AI Congestion Prediction Service
 *
 * Predicts station congestion levels using:
 * 1. Historical occupancy patterns (demand_forecasts table)
 * 2. Current real-time occupancy
 * 3. Upcoming reservations
 * 4. Day-of-week and time-of-day trends
 *
 * Congestion levels:
 *   low      — <40% occupancy, <5 min wait
 *   medium   — 40–70% occupancy, 5–15 min wait
 *   high     — 70–90% occupancy, 15–30 min wait
 *   critical — >90% occupancy, >30 min wait
 *
 * Confidence: 0.3 (no data) → 0.9 (rich historical + real-time data)
 */

function classifyCongestion(occupancyPct) {
  if (occupancyPct >= 90) return 'critical';
  if (occupancyPct >= 70) return 'high';
  if (occupancyPct >= 40) return 'medium';
  return 'low';
}

function estimateWaitMinutes(occupancyPct, totalSlots) {
  if (occupancyPct < 40) return 0;
  if (occupancyPct < 70) return Math.round(5 + (occupancyPct - 40) * 0.33);
  if (occupancyPct < 90) return Math.round(15 + (occupancyPct - 70) * 0.75);
  return Math.round(30 + (occupancyPct - 90) * 1.5);
}

/**
 * Predict congestion for a station for the next N hours.
 */
async function predictCongestion(stationId, hoursAhead = 24) {
  // 1. Get station slot count
  const { rows: slotRows } = await db.query(
    `SELECT COUNT(*)::int AS total FROM charging_slots WHERE station_id = $1`,
    [stationId],
  );
  const totalSlots = slotRows[0]?.total || 1;

  // 2. Current real-time occupancy
  const { rows: occupiedRows } = await db.query(
    `SELECT COUNT(*)::int AS occupied FROM charging_slots
     WHERE station_id = $1 AND status IN ('occupied', 'reserved')`,
    [stationId],
  );
  const currentOccupied = occupiedRows[0]?.occupied || 0;
  const currentOccupancyPct = (currentOccupied / totalSlots) * 100;

  // 3. Get historical demand forecasts for the station
  const now = new Date();
  const { rows: forecasts } = await db.query(
    `SELECT day_of_week, hour_of_day, avg_occupancy_rate, avg_wait_minutes, sample_count
     FROM demand_forecasts WHERE station_id = $1`,
    [stationId],
  );
  const forecastMap = {};
  for (const f of forecasts) {
    forecastMap[`${f.day_of_week}-${f.hour_of_day}`] = f;
  }

  // 4. Upcoming reservations per hour
  const futureEnd = new Date(now.getTime() + hoursAhead * 3600000);
  const { rows: reservations } = await db.query(
    `SELECT EXTRACT(DOW FROM scheduled_start)::int AS dow,
            EXTRACT(HOUR FROM scheduled_start)::int AS hour,
            COUNT(*)::int AS count
     FROM reservations
     WHERE station_id = $1 AND scheduled_start BETWEEN $2 AND $3
       AND status IN ('pending', 'confirmed')
     GROUP BY dow, hour`,
    [stationId, now.toISOString(), futureEnd.toISOString()],
  );
  const reservationMap = {};
  for (const r of reservations) {
    reservationMap[`${r.dow}-${r.hour}`] = r.count;
  }

  // 5. Build hourly predictions
  const predictions = [];
  for (let h = 0; h < hoursAhead; h++) {
    const targetTime = new Date(now.getTime() + h * 3600000);
    const dow = targetTime.getDay();
    const hour = targetTime.getHours();
    const key = `${dow}-${hour}`;

    const forecast = forecastMap[key];
    const upcomingReservations = reservationMap[key] || 0;

    let predictedOccupancyPct;
    let confidence = 0.3;
    const factors = {};

    if (h === 0) {
      // Current hour: use real-time data heavily
      const historicalRate = forecast ? Number(forecast.avg_occupancy_rate) : currentOccupancyPct;
      predictedOccupancyPct = currentOccupancyPct * 0.7 + historicalRate * 0.3;
      confidence = 0.85;
      factors.realTimeWeight = 0.7;
      factors.currentOccupied = currentOccupied;
    } else if (forecast && Number(forecast.sample_count) >= 3) {
      // Future hours with good historical data
      const historicalRate = Number(forecast.avg_occupancy_rate);
      const reservationImpact = (upcomingReservations / totalSlots) * 100;
      predictedOccupancyPct = historicalRate * 0.6 + reservationImpact * 0.3
        + currentOccupancyPct * (0.1 / Math.max(h, 1)); // current fades with distance
      confidence = Math.min(0.4 + Number(forecast.sample_count) * 0.03, 0.85);
      factors.historicalWeight = 0.6;
      factors.sampleCount = Number(forecast.sample_count);
    } else {
      // Limited data: use reservation-based + current decay
      const reservationImpact = (upcomingReservations / totalSlots) * 100;
      const decayedCurrent = currentOccupancyPct * Math.exp(-0.1 * h);
      predictedOccupancyPct = decayedCurrent + reservationImpact;
      confidence = 0.3 + (upcomingReservations > 0 ? 0.1 : 0);
      factors.limitedData = true;
    }

    predictedOccupancyPct = Math.max(0, Math.min(100, predictedOccupancyPct));
    factors.upcomingReservations = upcomingReservations;

    const congestionLevel = classifyCongestion(predictedOccupancyPct);
    const waitMinutes = estimateWaitMinutes(predictedOccupancyPct, totalSlots);
    const queueLength = Math.max(0, Math.round((predictedOccupancyPct / 100) * totalSlots - totalSlots));

    predictions.push({
      predictedFor: targetTime.toISOString(),
      hour: targetTime.getHours(),
      congestionLevel,
      predictedOccupancyPct: Math.round(predictedOccupancyPct * 10) / 10,
      predictedWaitMinutes: waitMinutes,
      predictedQueueLength: queueLength,
      confidence: Math.round(confidence * 100) / 100,
      factors,
    });
  }

  // 6. Persist predictions
  for (const p of predictions) {
    await db.query(
      `INSERT INTO congestion_predictions
         (station_id, predicted_for, congestion_level, predicted_occupancy_pct,
          predicted_wait_minutes, predicted_queue_length, confidence, factors)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (station_id, predicted_for)
       DO UPDATE SET
         congestion_level = EXCLUDED.congestion_level,
         predicted_occupancy_pct = EXCLUDED.predicted_occupancy_pct,
         predicted_wait_minutes = EXCLUDED.predicted_wait_minutes,
         predicted_queue_length = EXCLUDED.predicted_queue_length,
         confidence = EXCLUDED.confidence,
         factors = EXCLUDED.factors`,
      [stationId, p.predictedFor, p.congestionLevel, p.predictedOccupancyPct,
       p.predictedWaitMinutes, p.predictedQueueLength, p.confidence,
       JSON.stringify(p.factors)],
    );
  }

  // Find best time (lowest congestion in next 12 hours)
  const next12 = predictions.slice(0, Math.min(12, predictions.length));
  const bestHour = next12.reduce((best, p) =>
    p.predictedOccupancyPct < best.predictedOccupancyPct ? p : best, next12[0]);

  return {
    stationId,
    totalSlots,
    currentOccupancy: {
      occupied: currentOccupied,
      percentage: Math.round(currentOccupancyPct * 10) / 10,
      level: classifyCongestion(currentOccupancyPct),
    },
    predictions,
    bestTimeToVisit: bestHour ? {
      hour: bestHour.hour,
      time: bestHour.predictedFor,
      congestionLevel: bestHour.congestionLevel,
      estimatedWait: bestHour.predictedWaitMinutes,
    } : null,
    message: `Congestion forecast for next ${hoursAhead} hours generated`,
  };
}

/**
 * Get cached predictions for a station.
 */
async function getCachedPredictions(stationId, hoursAhead = 24) {
  const now = new Date();
  const futureEnd = new Date(now.getTime() + hoursAhead * 3600000);

  const { rows } = await db.query(
    `SELECT * FROM congestion_predictions
     WHERE station_id = $1 AND predicted_for BETWEEN $2 AND $3
     ORDER BY predicted_for`,
    [stationId, now.toISOString(), futureEnd.toISOString()],
  );

  if (rows.length === 0) {
    // No cached data — generate fresh
    return predictCongestion(stationId, hoursAhead);
  }

  return {
    stationId,
    predictions: rows.map((r) => ({
      predictedFor: r.predicted_for,
      hour: new Date(r.predicted_for).getHours(),
      congestionLevel: r.congestion_level,
      predictedOccupancyPct: Number(r.predicted_occupancy_pct),
      predictedWaitMinutes: Number(r.predicted_wait_minutes),
      predictedQueueLength: r.predicted_queue_length,
      confidence: Number(r.confidence),
      factors: r.factors,
    })),
    cached: true,
  };
}

module.exports = { predictCongestion, getCachedPredictions };

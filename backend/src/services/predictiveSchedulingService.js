const db = require('../config/database');

/**
 * Predictive Charging Scheduling Service
 *
 * Recommends optimal charging time-slots by combining:
 *
 * 1. Historical demand patterns (demand_forecasts table)
 * 2. Real-time and predicted congestion (congestion_predictions)
 * 3. Existing reservations (reservation conflict checks)
 * 4. Station proximity (earth_distance for multi-station search)
 * 5. User preferences (scheduling_preferences)
 *
 * Scoring formula per candidate slot:
 *   score = w_wait × (1 - waitNorm)          // 35% — lower wait is better
 *         + w_occ  × (1 - occupancyNorm)      // 25% — lower occupancy is better
 *         + w_pref × preferenceMatch           // 20% — matches user preferred hours
 *         + w_conf × confidence                // 10% — data quality
 *         + w_dist × (1 - distanceNorm)        // 10% — closer is better
 */

const WEIGHTS = {
  wait: 0.35,
  occupancy: 0.25,
  preference: 0.20,
  confidence: 0.10,
  distance: 0.10,
};

// ── Get or create user scheduling preferences ────────────────────
async function getPreferences(userId) {
  const { rows } = await db.query(
    `SELECT * FROM scheduling_preferences WHERE user_id = $1`, [userId],
  );
  if (rows.length > 0) return rows[0];

  const { rows: created } = await db.query(
    `INSERT INTO scheduling_preferences (user_id) VALUES ($1) RETURNING *`, [userId],
  );
  return created[0];
}

async function updatePreferences(userId, data) {
  const prefs = await getPreferences(userId);
  const fields = [];
  const params = [prefs.id];
  let idx = 2;

  const allowed = [
    'preferred_start_hour', 'preferred_end_hour', 'default_duration_min',
    'max_wait_min', 'prefer_fast_charging', 'home_latitude', 'home_longitude',
    'max_distance_km', 'favorite_station_ids', 'preferred_days',
  ];

  for (const key of allowed) {
    // Convert camelCase input to snake_case
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    if (data[camel] !== undefined) {
      fields.push(`${key} = $${idx++}`);
      params.push(data[camel]);
    } else if (data[key] !== undefined) {
      fields.push(`${key} = $${idx++}`);
      params.push(data[key]);
    }
  }

  if (fields.length === 0) return prefs;

  const { rows } = await db.query(
    `UPDATE scheduling_preferences SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
    params,
  );
  return rows[0];
}

// ── Find optimal charging schedule ───────────────────────────────
async function findOptimalSchedule(userId, {
  stationId = null,         // specific station, or null to search nearby
  date,                     // YYYY-MM-DD
  durationMin = 60,
  flexibilityHours = 4,    // how many hours to search around preferred time
  preferredStartHour = null,
  latitude = null,
  longitude = null,
  radiusKm = 25,
}) {
  const prefs = await getPreferences(userId);
  const targetDate = new Date(date);
  const startHour = preferredStartHour ?? prefs.preferred_start_hour ?? 8;
  const endHour = prefs.preferred_end_hour ?? 22;
  const maxWait = prefs.max_wait_min ?? 15;

  // 1. Find candidate stations
  let stations;
  if (stationId) {
    const { rows } = await db.query(
      `SELECT s.id, s.name, s.address, s.city, s.latitude, s.longitude, 0 AS distance_km,
              (SELECT COUNT(*)::int FROM charging_slots WHERE station_id = s.id) AS total_slots
       FROM stations s WHERE s.id = $1 AND s.status = 'approved'`,
      [stationId],
    );
    stations = rows;
  } else if (latitude && longitude) {
    const { rows } = await db.query(
      `SELECT s.id, s.name, s.address, s.city, s.latitude, s.longitude,
              earth_distance(ll_to_earth($1, $2), ll_to_earth(s.latitude, s.longitude)) / 1000.0 AS distance_km,
              (SELECT COUNT(*)::int FROM charging_slots WHERE station_id = s.id) AS total_slots
       FROM stations s
       WHERE s.status = 'approved'
         AND earth_distance(ll_to_earth($1, $2), ll_to_earth(s.latitude, s.longitude)) < $3 * 1000
       ORDER BY distance_km
       LIMIT 10`,
      [latitude, longitude, radiusKm],
    );
    stations = rows;
  } else {
    // Fall back to user's favorite stations or top stations
    const favoriteIds = prefs.favorite_station_ids || [];
    if (favoriteIds.length > 0) {
      const { rows } = await db.query(
        `SELECT s.id, s.name, s.address, s.city, s.latitude, s.longitude, 0 AS distance_km,
                (SELECT COUNT(*)::int FROM charging_slots WHERE station_id = s.id) AS total_slots
         FROM stations s WHERE s.id = ANY($1) AND s.status = 'approved'`,
        [favoriteIds],
      );
      stations = rows;
    } else {
      const { rows } = await db.query(
        `SELECT s.id, s.name, s.address, s.city, s.latitude, s.longitude, 0 AS distance_km,
                (SELECT COUNT(*)::int FROM charging_slots WHERE station_id = s.id) AS total_slots
         FROM stations s WHERE s.status = 'approved'
         ORDER BY (SELECT COUNT(*) FROM charging_slots WHERE station_id = s.id) DESC
         LIMIT 10`,
      );
      stations = rows;
    }
  }

  if (stations.length === 0) {
    return { recommendation: null, alternatives: [], message: 'No active stations found' };
  }

  const maxDist = Math.max(...stations.map(s => Number(s.distance_km) || 0), 1);

  // 2. For each station × each candidate hour, compute a score
  const candidates = [];
  const dow = targetDate.getDay();

  // Determine search window
  const searchStart = Math.max(0, startHour - flexibilityHours);
  const searchEnd = Math.min(23, endHour + flexibilityHours);

  for (const station of stations) {
    const sId = station.id;
    const totalSlots = Number(station.total_slots) || 1;
    const dist = Number(station.distance_km) || 0;

    // Fetch demand forecast for this station for this DOW
    const { rows: forecasts } = await db.query(
      `SELECT hour_of_day, avg_occupancy_rate, avg_wait_minutes, avg_sessions, sample_count, demand_level
       FROM demand_forecasts WHERE station_id = $1 AND day_of_week = $2
       ORDER BY hour_of_day`,
      [sId, dow],
    );
    const forecastMap = {};
    for (const f of forecasts) forecastMap[Number(f.hour_of_day)] = f;

    // Fetch congestion predictions if available
    const predStart = new Date(targetDate);
    predStart.setHours(searchStart, 0, 0, 0);
    const predEnd = new Date(targetDate);
    predEnd.setHours(searchEnd + 1, 0, 0, 0);

    const { rows: predictions } = await db.query(
      `SELECT predicted_for, predicted_occupancy_pct, predicted_wait_minutes, confidence, congestion_level
       FROM congestion_predictions
       WHERE station_id = $1 AND predicted_for BETWEEN $2 AND $3
       ORDER BY predicted_for`,
      [sId, predStart.toISOString(), predEnd.toISOString()],
    );
    const predictionMap = {};
    for (const p of predictions) {
      const h = new Date(p.predicted_for).getHours();
      predictionMap[h] = p;
    }

    // Count existing reservations per hour on this date
    const dateStr = date;
    const { rows: reservationCounts } = await db.query(
      `SELECT EXTRACT(HOUR FROM scheduled_start)::int AS hour, COUNT(*)::int AS count
       FROM reservations
       WHERE station_id = $1
         AND scheduled_start::date = $2::date
         AND status IN ('pending', 'confirmed', 'active')
       GROUP BY hour`,
      [sId, dateStr],
    );
    const resMap = {};
    for (const r of reservationCounts) resMap[r.hour] = r.count;

    // Score each candidate hour
    for (let hour = searchStart; hour <= searchEnd; hour++) {
      const forecast = forecastMap[hour];
      const prediction = predictionMap[hour];
      const reservedCount = resMap[hour] || 0;

      // Skip if all slots are reserved at this hour
      if (reservedCount >= totalSlots) continue;

      // Occupancy estimate: blend forecast + prediction + reservations
      let occupancyPct;
      let waitMin;
      let confidence;
      let congestionLevel;

      if (prediction) {
        occupancyPct = Number(prediction.predicted_occupancy_pct);
        waitMin = Number(prediction.predicted_wait_minutes);
        confidence = Number(prediction.confidence);
        congestionLevel = prediction.congestion_level;
      } else if (forecast) {
        occupancyPct = Number(forecast.avg_occupancy_rate);
        waitMin = Number(forecast.avg_wait_minutes);
        confidence = Math.min(0.3 + Number(forecast.sample_count || 0) * 0.03, 0.7);
        congestionLevel = forecast.demand_level === 'high' ? 'high'
          : forecast.demand_level === 'medium' ? 'medium' : 'low';
      } else {
        // No data — use reservation-based estimate
        occupancyPct = (reservedCount / totalSlots) * 100;
        waitMin = reservedCount >= totalSlots ? 30 : reservedCount > 0 ? 5 : 0;
        confidence = 0.2;
        congestionLevel = occupancyPct > 70 ? 'high' : occupancyPct > 40 ? 'medium' : 'low';
      }

      // Adjust occupancy for known reservations
      const reservationOccupancy = (reservedCount / totalSlots) * 100;
      occupancyPct = Math.max(occupancyPct, reservationOccupancy);

      // Skip if wait exceeds user maximum
      if (waitMin > maxWait * 2) continue;

      // Preference match: how close is this hour to the preferred start
      const hourDiff = Math.abs(hour - startHour);
      const prefMatch = Math.max(0, 1 - hourDiff / Math.max(flexibilityHours, 1));

      // Normalize values (0-1 range)
      const waitNorm = Math.min(waitMin / 45, 1);
      const occNorm = Math.min(occupancyPct / 100, 1);
      const distNorm = maxDist > 0 ? dist / maxDist : 0;

      // Composite score
      const score = (
        WEIGHTS.wait * (1 - waitNorm) +
        WEIGHTS.occupancy * (1 - occNorm) +
        WEIGHTS.preference * prefMatch +
        WEIGHTS.confidence * confidence +
        WEIGHTS.distance * (1 - distNorm)
      ) * 100;

      // Build start/end times
      const slotStart = new Date(targetDate);
      slotStart.setHours(hour, 0, 0, 0);
      const slotEnd = new Date(slotStart.getTime() + durationMin * 60000);

      // Find best available slot at this station for this time
      const { rows: availableSlots } = await db.query(
        `SELECT sl.id, sl.slot_number, sl.charging_type, sl.power_output_kw
         FROM charging_slots sl
         WHERE sl.station_id = $1
           AND NOT EXISTS (
             SELECT 1 FROM reservations r
             WHERE r.slot_id = sl.id
               AND r.status IN ('pending', 'confirmed', 'active')
               AND r.scheduled_start < $3 AND r.scheduled_end > $2
           )
         ORDER BY sl.power_output_kw DESC
         LIMIT 1`,
        [sId, slotStart.toISOString(), slotEnd.toISOString()],
      );

      const bestSlot = availableSlots[0] || null;

      candidates.push({
        stationId: sId,
        stationName: station.name,
        stationAddress: station.address,
        stationCity: station.city,
        distanceKm: dist,
        totalSlots,
        slotId: bestSlot?.id || null,
        slotNumber: bestSlot?.slot_number || null,
        chargingType: bestSlot?.charging_type || null,
        powerOutputKw: bestSlot ? Number(bestSlot.power_output_kw) : null,
        recommendedStart: slotStart.toISOString(),
        recommendedEnd: slotEnd.toISOString(),
        hour,
        predictedWaitMin: Math.round(waitMin * 10) / 10,
        predictedOccupancyPct: Math.round(occupancyPct * 10) / 10,
        congestionLevel,
        confidence: Math.round(confidence * 100) / 100,
        score: Math.round(score * 100) / 100,
        reason: buildReason(hour, startHour, waitMin, occupancyPct, congestionLevel, dist, bestSlot),
      });
    }
  }

  // 3. Sort by score descending
  candidates.sort((a, b) => b.score - a.score);

  if (candidates.length === 0) {
    return {
      recommendation: null,
      alternatives: [],
      message: 'No available time slots found. Try increasing flexibility or searching more stations.',
    };
  }

  const best = candidates[0];
  const alternatives = candidates.slice(1, 6); // top 5 alternatives

  // 4. Persist the recommendation
  await db.query(`
    INSERT INTO schedule_recommendations (
      user_id, requested_station_id, requested_date, charging_duration_min,
      flexibility_hours, preferred_start_hour,
      recommended_station_id, recommended_slot_id, recommended_start, recommended_end,
      predicted_wait_min, predicted_occupancy_pct, congestion_level, confidence, score,
      reason, alternatives_count
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
  `, [
    userId, stationId, date, durationMin,
    flexibilityHours, preferredStartHour,
    best.stationId, best.slotId, best.recommendedStart, best.recommendedEnd,
    best.predictedWaitMin, best.predictedOccupancyPct, best.congestionLevel,
    best.confidence, best.score, best.reason, alternatives.length,
  ]);

  return {
    recommendation: best,
    alternatives,
    searchParams: {
      date,
      durationMin,
      flexibilityHours,
      preferredStartHour: startHour,
      stationsSearched: stations.length,
      candidatesEvaluated: candidates.length,
    },
    message: `Best time: ${formatTime(best.hour)} with ~${best.predictedWaitMin} min wait`,
  };
}

// ── Get user's past schedule recommendations ─────────────────────
async function getMyRecommendations(userId, { limit = 10 } = {}) {
  const { rows } = await db.query(`
    SELECT sr.*, s.name AS station_name, s.address AS station_address, s.city AS station_city
    FROM schedule_recommendations sr
    JOIN stations s ON s.id = sr.recommended_station_id
    WHERE sr.user_id = $1
    ORDER BY sr.created_at DESC
    LIMIT $2
  `, [userId, limit]);
  return rows;
}

// ── Accept a recommendation (create reservation from it) ─────────
async function acceptRecommendation(recId, userId) {
  const { rows } = await db.query(
    `SELECT * FROM schedule_recommendations WHERE id = $1 AND user_id = $2`,
    [recId, userId],
  );
  if (rows.length === 0) throw new Error('Recommendation not found');
  const rec = rows[0];

  if (rec.status !== 'suggested') {
    throw new Error(`Recommendation is already ${rec.status}`);
  }

  // Mark as accepted
  await db.query(
    `UPDATE schedule_recommendations SET status = 'accepted', accepted_at = NOW() WHERE id = $1`,
    [recId],
  );

  // Return the reservation-ready data (caller will create the reservation)
  return {
    slotId: rec.recommended_slot_id,
    stationId: rec.recommended_station_id,
    scheduledStart: rec.recommended_start,
    scheduledEnd: rec.recommended_end,
    recommendationId: rec.id,
  };
}

// ── Quick recommend: find the single best station + time for "now" ─
async function quickRecommend(userId, { latitude, longitude, durationMin = 60 }) {
  const today = new Date().toISOString().slice(0, 10);
  const currentHour = new Date().getHours();

  return findOptimalSchedule(userId, {
    date: today,
    durationMin,
    flexibilityHours: 3,
    preferredStartHour: currentHour,
    latitude,
    longitude,
    radiusKm: 15,
  });
}

// ── Helpers ───────────────────────────────────────────────────────

function formatTime(hour) {
  const h = hour % 12 || 12;
  const ampm = hour < 12 ? 'AM' : 'PM';
  return `${h}:00 ${ampm}`;
}

function buildReason(hour, preferredHour, waitMin, occupancyPct, congestionLevel, distKm, slot) {
  const parts = [];

  if (waitMin < 5) {
    parts.push('minimal expected wait time');
  } else if (waitMin < 15) {
    parts.push(`short wait (~${Math.round(waitMin)} min)`);
  }

  if (congestionLevel === 'low') {
    parts.push('low station congestion');
  } else if (congestionLevel === 'medium') {
    parts.push('moderate congestion');
  }

  if (Math.abs(hour - preferredHour) <= 1) {
    parts.push('matches your preferred time');
  }

  if (distKm > 0 && distKm < 5) {
    parts.push(`nearby (${distKm.toFixed(1)} km)`);
  }

  if (slot) {
    const power = Number(slot.power_output_kw);
    if (power >= 100) parts.push(`fast charger available (${power} kW)`);
    else if (power >= 22) parts.push(`Level 2 available (${power} kW)`);
  }

  if (occupancyPct < 30) {
    parts.push(`only ${Math.round(occupancyPct)}% occupancy predicted`);
  }

  return parts.length > 0
    ? parts.join('; ') + '.'
    : 'Best available option based on congestion prediction.';
}

module.exports = {
  getPreferences,
  updatePreferences,
  findOptimalSchedule,
  getMyRecommendations,
  acceptRecommendation,
  quickRecommend,
};

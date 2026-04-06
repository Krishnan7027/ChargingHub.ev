const db = require('../config/database');

/**
 * Build or refresh the demand forecast for a station.
 *
 * Algorithm:
 * - Aggregate completed reservations and charging sessions by
 *   (day_of_week, hour_of_day) over the last 90 days.
 * - Compute average occupancy rate, reservation count, session count,
 *   and average wait time.
 * - Classify each hour as low / medium / high demand using percentile
 *   thresholds for that station.
 */
async function buildForecast(stationId) {
  // Count total slots for occupancy calculation
  const { rows: slotCountRows } = await db.query(
    `SELECT COUNT(*) AS cnt FROM charging_slots WHERE station_id = $1`,
    [stationId],
  );
  const totalSlots = Number(slotCountRows[0]?.cnt) || 1;

  // Aggregate sessions by day/hour over the last 90 days
  const { rows: sessionAgg } = await db.query(
    `SELECT
       EXTRACT(DOW FROM started_at)::int  AS dow,
       EXTRACT(HOUR FROM started_at)::int AS hod,
       COUNT(*)::int                       AS sessions,
       AVG(EXTRACT(EPOCH FROM (COALESCE(completed_at, NOW()) - started_at)) / 60)::numeric(8,2) AS avg_dur
     FROM charging_sessions
     WHERE slot_id IN (SELECT id FROM charging_slots WHERE station_id = $1)
       AND started_at > NOW() - INTERVAL '90 days'
     GROUP BY dow, hod`,
    [stationId],
  );

  // Aggregate reservations
  const { rows: resAgg } = await db.query(
    `SELECT
       EXTRACT(DOW FROM scheduled_start)::int  AS dow,
       EXTRACT(HOUR FROM scheduled_start)::int AS hod,
       COUNT(*)::int AS reservations
     FROM reservations
     WHERE station_id = $1
       AND scheduled_start > NOW() - INTERVAL '90 days'
       AND status NOT IN ('cancelled')
     GROUP BY dow, hod`,
    [stationId],
  );

  // Merge into a map keyed by "dow-hod"
  const map = {};
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      map[`${d}-${h}`] = { dow: d, hod: h, sessions: 0, reservations: 0, avgDur: 0 };
    }
  }
  for (const r of sessionAgg) {
    const key = `${r.dow}-${r.hod}`;
    if (map[key]) { map[key].sessions = r.sessions; map[key].avgDur = Number(r.avg_dur); }
  }
  for (const r of resAgg) {
    const key = `${r.dow}-${r.hod}`;
    if (map[key]) map[key].reservations = r.reservations;
  }

  // Compute percentile thresholds from the data
  const sessionCounts = Object.values(map).map((v) => v.sessions);
  sessionCounts.sort((a, b) => a - b);
  const p33 = sessionCounts[Math.floor(sessionCounts.length * 0.33)] || 0;
  const p66 = sessionCounts[Math.floor(sessionCounts.length * 0.66)] || 0;

  // Weeks of data for averaging
  const weeks = 13; // ~90 days

  // Upsert forecasts
  const params = [];
  const valueClauses = [];
  let paramIdx = 1;
  for (const entry of Object.values(map)) {
    const avgSessions = entry.sessions / weeks;
    const avgReservations = entry.reservations / weeks;
    const occupancyRate = Math.min((avgSessions / totalSlots) * 100, 100);
    const avgWait = entry.sessions > p66 ? Math.round(entry.avgDur * 0.3) : 0;
    const demand = entry.sessions > p66 ? 'high' : entry.sessions > p33 ? 'medium' : 'low';

    valueClauses.push(
      `($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, ` +
      `$${paramIdx + 3}, $${paramIdx + 4}, $${paramIdx + 5}, ` +
      `$${paramIdx + 6}, $${paramIdx + 7}, $${paramIdx + 8}, NOW())`
    );
    params.push(
      stationId, entry.dow, entry.hod,
      parseFloat(occupancyRate.toFixed(2)), parseFloat(avgReservations.toFixed(2)),
      parseFloat(avgSessions.toFixed(2)), parseFloat(avgWait.toFixed(2)),
      entry.sessions, demand
    );
    paramIdx += 9;
  }

  if (valueClauses.length > 0) {
    await db.query(
      `INSERT INTO demand_forecasts
         (station_id, day_of_week, hour_of_day,
          avg_occupancy_rate, avg_reservations, avg_sessions,
          avg_wait_minutes, sample_count, demand_level, updated_at)
       VALUES ${valueClauses.join(',')}
       ON CONFLICT (station_id, day_of_week, hour_of_day)
       DO UPDATE SET
         avg_occupancy_rate = EXCLUDED.avg_occupancy_rate,
         avg_reservations   = EXCLUDED.avg_reservations,
         avg_sessions       = EXCLUDED.avg_sessions,
         avg_wait_minutes   = EXCLUDED.avg_wait_minutes,
         sample_count       = EXCLUDED.sample_count,
         demand_level       = EXCLUDED.demand_level,
         updated_at         = NOW()`,
      params,
    );
  }
}

/**
 * Get the demand forecast for a station, optionally for a specific day.
 */
async function getForecast(stationId, dayOfWeek = null) {
  let query = `
    SELECT day_of_week, hour_of_day, avg_occupancy_rate,
           avg_reservations, avg_sessions, avg_wait_minutes,
           sample_count, demand_level, updated_at
    FROM demand_forecasts
    WHERE station_id = $1`;
  const params = [stationId];

  if (dayOfWeek !== null && dayOfWeek !== undefined) {
    query += ` AND day_of_week = $2`;
    params.push(dayOfWeek);
  }
  query += ` ORDER BY day_of_week, hour_of_day`;

  const { rows } = await db.query(query, params);

  // If no forecast data, build it on the fly
  if (rows.length === 0) {
    await buildForecast(stationId);
    const { rows: fresh } = await db.query(query, params);
    return formatForecast(fresh);
  }

  return formatForecast(rows);
}

function formatForecast(rows) {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Group by day
  const byDay = {};
  for (const r of rows) {
    const day = Number(r.day_of_week);
    if (!byDay[day]) byDay[day] = { dayName: dayNames[day], dayOfWeek: day, hours: [] };
    byDay[day].hours.push({
      hour: Number(r.hour_of_day),
      timeRange: `${String(r.hour_of_day).padStart(2, '0')}:00–${String((Number(r.hour_of_day) + 1) % 24).padStart(2, '0')}:00`,
      demandLevel: r.demand_level,
      avgOccupancyRate: Number(r.avg_occupancy_rate),
      avgWaitMinutes: Number(r.avg_wait_minutes),
      avgSessions: Number(r.avg_sessions),
      avgReservations: Number(r.avg_reservations),
      sampleCount: Number(r.sample_count),
    });
  }

  // Find peak hours per day
  const days = Object.values(byDay);
  for (const day of days) {
    day.hours.sort((a, b) => a.hour - b.hour);
    const peak = [...day.hours].sort((a, b) => b.avgSessions - a.avgSessions)[0];
    day.peakHour = peak?.hour ?? null;
  }

  return { forecast: days };
}

/**
 * Get a quick summary for today.
 */
async function getTodayForecast(stationId) {
  const dayOfWeek = new Date().getDay();
  const result = await getForecast(stationId, dayOfWeek);
  return result;
}

module.exports = { buildForecast, getForecast, getTodayForecast };

const db = require('../config/database');
const { caches } = require('../utils/cache');

// ── Heatmap Aggregation ─────────────────────────────────────────

/**
 * Aggregate charging sessions into heatmap grid cells.
 * Grid resolution: 0.01° ≈ 1.1 km
 */
async function aggregateHeatmapData(periodStart, periodEnd) {
  // Step 1: Aggregate sessions per grid cell
  const sessionAgg = await db.query(`
    SELECT
      ROUND(s.latitude::numeric, 2)  AS grid_lat,
      ROUND(s.longitude::numeric, 2) AS grid_lng,
      COUNT(cs.id)                   AS total_sessions,
      COALESCE(SUM(cs.energy_delivered_kwh), 0) AS total_energy_kwh,
      COUNT(DISTINCT cs.user_id)     AS unique_users,
      COALESCE(AVG(EXTRACT(EPOCH FROM (cs.end_time - cs.start_time)) / 60), 0) AS avg_session_duration_min
    FROM charging_sessions cs
    JOIN charging_slots sl ON sl.id = cs.slot_id
    JOIN stations s ON s.id = sl.station_id
    WHERE cs.start_time >= $1 AND cs.start_time < $2
      AND cs.status IN ('completed', 'charging')
    GROUP BY grid_lat, grid_lng
  `, [periodStart, periodEnd]);

  // Step 2: Get infrastructure per grid cell
  const infraAgg = await db.query(`
    SELECT
      ROUND(s.latitude::numeric, 2)  AS grid_lat,
      ROUND(s.longitude::numeric, 2) AS grid_lng,
      COUNT(DISTINCT s.id)           AS station_count,
      COUNT(sl.id)                   AS total_slots,
      COALESCE(
        AVG(CASE WHEN sl.status = 'occupied' THEN 1.0 ELSE 0.0 END) * 100, 0
      ) AS avg_occupancy_pct
    FROM stations s
    JOIN charging_slots sl ON sl.station_id = s.id
    WHERE s.status = 'approved'
    GROUP BY grid_lat, grid_lng
  `);

  // Build infrastructure lookup
  const infraMap = {};
  for (const row of infraAgg.rows) {
    const key = `${row.grid_lat},${row.grid_lng}`;
    infraMap[key] = row;
  }

  // Step 3: Upsert heatmap cells
  const upsertSQL = `
    INSERT INTO charging_heatmap_cells (
      grid_lat, grid_lng, total_sessions, total_energy_kwh, unique_users,
      avg_session_duration_min, station_count, total_slots, avg_occupancy_pct,
      demand_intensity, infrastructure_gap_score, period_start, period_end
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    ON CONFLICT (grid_lat, grid_lng, period_start)
    DO UPDATE SET
      total_sessions = EXCLUDED.total_sessions,
      total_energy_kwh = EXCLUDED.total_energy_kwh,
      unique_users = EXCLUDED.unique_users,
      avg_session_duration_min = EXCLUDED.avg_session_duration_min,
      station_count = EXCLUDED.station_count,
      total_slots = EXCLUDED.total_slots,
      avg_occupancy_pct = EXCLUDED.avg_occupancy_pct,
      demand_intensity = EXCLUDED.demand_intensity,
      infrastructure_gap_score = EXCLUDED.infrastructure_gap_score,
      period_end = EXCLUDED.period_end,
      updated_at = NOW()
    RETURNING *
  `;

  const cells = [];
  // Merge session data + infra data per grid cell
  const allKeys = new Set();
  for (const row of sessionAgg.rows) allKeys.add(`${row.grid_lat},${row.grid_lng}`);
  for (const key of Object.keys(infraMap)) allKeys.add(key);

  for (const key of allKeys) {
    const [lat, lng] = key.split(',').map(Number);
    const sess = sessionAgg.rows.find(r => Number(r.grid_lat) === lat && Number(r.grid_lng) === lng) || {};
    const infra = infraMap[key] || {};

    const totalSessions = Number(sess.total_sessions || 0);
    const totalSlots = Number(infra.total_slots || 0);
    const demandIntensity = totalSlots > 0 ? totalSessions / totalSlots : totalSessions;

    // Gap score: high demand + low infrastructure = high score
    const demandNorm = Math.min(totalSessions / 50, 1); // normalize to ~50 sessions as "high"
    const infraNorm = totalSlots > 0 ? Math.min(totalSlots / 20, 1) : 0;
    const gapScore = Math.round(demandNorm * 100 * (1 - infraNorm * 0.7));

    const result = await db.query(upsertSQL, [
      lat, lng,
      totalSessions,
      Number(sess.total_energy_kwh || 0),
      Number(sess.unique_users || 0),
      Number(sess.avg_session_duration_min || 0),
      Number(infra.station_count || 0),
      totalSlots,
      Number(infra.avg_occupancy_pct || 0),
      demandIntensity,
      gapScore,
      periodStart,
      periodEnd,
    ]);
    cells.push(result.rows[0]);
  }

  return { cellsUpdated: cells.length, cells };
}

/**
 * Get heatmap data for a bounding box or all cells.
 */
async function getHeatmapData({ minLat, maxLat, minLng, maxLng, periodStart, periodEnd } = {}) {
  let sql = `SELECT * FROM charging_heatmap_cells WHERE 1=1`;
  const params = [];
  let idx = 1;

  if (minLat != null) { sql += ` AND grid_lat >= $${idx++}`; params.push(minLat); }
  if (maxLat != null) { sql += ` AND grid_lat <= $${idx++}`; params.push(maxLat); }
  if (minLng != null) { sql += ` AND grid_lng >= $${idx++}`; params.push(minLng); }
  if (maxLng != null) { sql += ` AND grid_lng <= $${idx++}`; params.push(maxLng); }
  if (periodStart) { sql += ` AND period_start >= $${idx++}`; params.push(periodStart); }
  if (periodEnd) { sql += ` AND period_end <= $${idx++}`; params.push(periodEnd); }

  sql += ` ORDER BY demand_intensity DESC`;

  const { rows } = await db.query(sql, params);
  return rows;
}

// ── Charging Behavior Aggregation ────────────────────────────────

/**
 * Compute daily behavior stats per city.
 */
async function aggregateBehaviorStats(date) {
  const sql = `
    INSERT INTO charging_behavior_stats (
      city, stat_date,
      avg_session_duration_min, median_session_duration_min, p90_session_duration_min,
      level1_sessions, level2_sessions, dc_fast_sessions,
      peak_hour, off_peak_hour,
      morning_sessions, afternoon_sessions, evening_sessions, night_sessions,
      avg_energy_kwh, avg_start_soc, avg_end_soc,
      total_sessions, unique_users, repeat_users
    )
    SELECT
      st.city,
      $1::date AS stat_date,
      -- Duration metrics
      AVG(EXTRACT(EPOCH FROM (cs.end_time - cs.start_time)) / 60),
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (cs.end_time - cs.start_time)) / 60),
      PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (cs.end_time - cs.start_time)) / 60),
      -- Charging type distribution
      COUNT(*) FILTER (WHERE sl.charging_type = 'level1'),
      COUNT(*) FILTER (WHERE sl.charging_type = 'level2'),
      COUNT(*) FILTER (WHERE sl.charging_type = 'dc_fast'),
      -- Peak / off-peak hours
      MODE() WITHIN GROUP (ORDER BY EXTRACT(HOUR FROM cs.start_time)),
      (SELECT h FROM generate_series(0,23) h
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS cnt FROM charging_sessions cs2
         JOIN charging_slots sl2 ON sl2.id = cs2.slot_id
         JOIN stations st2 ON st2.id = sl2.station_id
         WHERE st2.city = st.city
           AND cs2.start_time::date = $1::date
           AND EXTRACT(HOUR FROM cs2.start_time) = h
       ) x ON true
       ORDER BY x.cnt ASC NULLS FIRST LIMIT 1),
      -- Time distribution
      COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM cs.start_time) BETWEEN 6 AND 11),
      COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM cs.start_time) BETWEEN 12 AND 17),
      COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM cs.start_time) BETWEEN 18 AND 23),
      COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM cs.start_time) < 6),
      -- Energy
      AVG(cs.energy_delivered_kwh),
      AVG(cs.start_percentage),
      AVG(cs.end_percentage),
      -- Session counts
      COUNT(*),
      COUNT(DISTINCT cs.user_id),
      COUNT(DISTINCT cs.user_id) FILTER (
        WHERE cs.user_id IN (
          SELECT user_id FROM charging_sessions
          WHERE start_time::date = $1::date
          GROUP BY user_id HAVING COUNT(*) > 1
        )
      )
    FROM charging_sessions cs
    JOIN charging_slots sl ON sl.id = cs.slot_id
    JOIN stations st ON st.id = sl.station_id
    WHERE cs.start_time::date = $1::date
      AND cs.status IN ('completed', 'charging')
      AND st.city IS NOT NULL AND st.city != ''
    GROUP BY st.city
    ON CONFLICT (city, stat_date)
    DO UPDATE SET
      avg_session_duration_min = EXCLUDED.avg_session_duration_min,
      median_session_duration_min = EXCLUDED.median_session_duration_min,
      p90_session_duration_min = EXCLUDED.p90_session_duration_min,
      level1_sessions = EXCLUDED.level1_sessions,
      level2_sessions = EXCLUDED.level2_sessions,
      dc_fast_sessions = EXCLUDED.dc_fast_sessions,
      peak_hour = EXCLUDED.peak_hour,
      off_peak_hour = EXCLUDED.off_peak_hour,
      morning_sessions = EXCLUDED.morning_sessions,
      afternoon_sessions = EXCLUDED.afternoon_sessions,
      evening_sessions = EXCLUDED.evening_sessions,
      night_sessions = EXCLUDED.night_sessions,
      avg_energy_kwh = EXCLUDED.avg_energy_kwh,
      avg_start_soc = EXCLUDED.avg_start_soc,
      avg_end_soc = EXCLUDED.avg_end_soc,
      total_sessions = EXCLUDED.total_sessions,
      unique_users = EXCLUDED.unique_users,
      repeat_users = EXCLUDED.repeat_users,
      updated_at = NOW()
    RETURNING *
  `;

  const { rows } = await db.query(sql, [date]);
  return rows;
}

/**
 * Get behavior stats for a city or all cities.
 */
async function getBehaviorStats({ city, startDate, endDate } = {}) {
  let sql = `SELECT * FROM charging_behavior_stats WHERE 1=1`;
  const params = [];
  let idx = 1;

  if (city) { sql += ` AND city = $${idx++}`; params.push(city); }
  if (startDate) { sql += ` AND stat_date >= $${idx++}`; params.push(startDate); }
  if (endDate) { sql += ` AND stat_date <= $${idx++}`; params.push(endDate); }

  sql += ` ORDER BY stat_date DESC, city`;
  const { rows } = await db.query(sql, params);
  return rows;
}

// ── City EV Trends ───────────────────────────────────────────────

/**
 * Compute monthly city-level adoption trends.
 */
async function aggregateCityTrends(month) {
  // month should be first day of month, e.g. '2026-03-01'
  const monthStart = month;
  const nextMonth = new Date(month);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const monthEnd = nextMonth.toISOString().slice(0, 10);

  // Previous month for growth calc
  const prevMonth = new Date(month);
  prevMonth.setMonth(prevMonth.getMonth() - 1);
  const prevMonthStr = prevMonth.toISOString().slice(0, 10);

  const sql = `
    WITH current_month AS (
      SELECT
        st.city,
        COUNT(DISTINCT cs.user_id) AS active_users,
        COUNT(cs.id) AS total_sessions,
        COALESCE(SUM(cs.energy_delivered_kwh), 0) AS total_energy_kwh,
        COALESCE(SUM(cs.cost), 0) AS total_revenue
      FROM charging_sessions cs
      JOIN charging_slots sl ON sl.id = cs.slot_id
      JOIN stations st ON st.id = sl.station_id
      WHERE cs.start_time >= $1::date AND cs.start_time < $2::date
        AND cs.status IN ('completed', 'charging')
        AND st.city IS NOT NULL AND st.city != ''
      GROUP BY st.city
    ),
    new_users AS (
      SELECT st.city, COUNT(DISTINCT u.id) AS new_users
      FROM users u
      JOIN charging_sessions cs ON cs.user_id = u.id
      JOIN charging_slots sl ON sl.id = cs.slot_id
      JOIN stations st ON st.id = sl.station_id
      WHERE u.created_at >= $1::date AND u.created_at < $2::date
        AND st.city IS NOT NULL
      GROUP BY st.city
    ),
    total_users AS (
      SELECT st.city, COUNT(DISTINCT cs.user_id) AS total_users
      FROM charging_sessions cs
      JOIN charging_slots sl ON sl.id = cs.slot_id
      JOIN stations st ON st.id = sl.station_id
      WHERE cs.start_time < $2::date AND st.city IS NOT NULL
      GROUP BY st.city
    ),
    infra AS (
      SELECT
        city,
        COUNT(DISTINCT id) AS total_stations,
        (SELECT COUNT(*) FROM charging_slots sl2 WHERE sl2.station_id IN (
          SELECT id FROM stations WHERE city = s.city AND status = 'approved'
        )) AS total_slots,
        COUNT(DISTINCT id) FILTER (WHERE created_at >= $1::date AND created_at < $2::date) AS new_stations
      FROM stations s
      WHERE status = 'approved' AND city IS NOT NULL AND city != ''
      GROUP BY city
    ),
    carbon AS (
      SELECT
        st.city,
        COALESCE(SUM(cf.carbon_saved_kg), 0) AS total_carbon_saved_kg
      FROM carbon_footprint_records cf
      JOIN charging_sessions cs ON cs.id = cf.session_id
      JOIN charging_slots sl ON sl.id = cs.slot_id
      JOIN stations st ON st.id = sl.station_id
      WHERE cf.created_at >= $1::date AND cf.created_at < $2::date
        AND st.city IS NOT NULL
      GROUP BY st.city
    ),
    prev_month AS (
      SELECT city, total_sessions, active_users AS users, total_energy_kwh
      FROM city_ev_trends
      WHERE stat_month = $3::date
    )
    SELECT
      cm.city,
      COALESCE(tu.total_users, cm.active_users) AS total_users,
      COALESCE(nu.new_users, 0) AS new_users,
      cm.active_users,
      cm.total_sessions,
      cm.total_energy_kwh,
      cm.total_revenue,
      COALESCE(inf.total_stations, 0) AS total_stations,
      COALESCE(inf.total_slots, 0) AS total_slots,
      COALESCE(inf.new_stations, 0) AS new_stations,
      COALESCE(ca.total_carbon_saved_kg, 0) AS total_carbon_saved_kg,
      -- Growth metrics
      CASE WHEN pm.users > 0
        THEN ROUND(((cm.active_users - pm.users)::numeric / pm.users) * 100, 2)
        ELSE 0 END AS user_growth_pct,
      CASE WHEN pm.total_sessions > 0
        THEN ROUND(((cm.total_sessions - pm.total_sessions)::numeric / pm.total_sessions) * 100, 2)
        ELSE 0 END AS session_growth_pct,
      CASE WHEN pm.total_energy_kwh > 0
        THEN ROUND(((cm.total_energy_kwh - pm.total_energy_kwh)::numeric / pm.total_energy_kwh) * 100, 2)
        ELSE 0 END AS energy_growth_pct
    FROM current_month cm
    LEFT JOIN new_users nu ON nu.city = cm.city
    LEFT JOIN total_users tu ON tu.city = cm.city
    LEFT JOIN infra inf ON inf.city = cm.city
    LEFT JOIN carbon ca ON ca.city = cm.city
    LEFT JOIN prev_month pm ON pm.city = cm.city
  `;

  const { rows } = await db.query(sql, [monthStart, monthEnd, prevMonthStr]);

  // Upsert each city
  const upsertSQL = `
    INSERT INTO city_ev_trends (
      city, stat_month, total_users, new_users, active_users,
      total_sessions, total_energy_kwh, total_revenue,
      total_stations, total_slots, new_stations, total_carbon_saved_kg,
      user_growth_pct, session_growth_pct, energy_growth_pct
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
    ON CONFLICT (city, stat_month) DO UPDATE SET
      total_users = EXCLUDED.total_users,
      new_users = EXCLUDED.new_users,
      active_users = EXCLUDED.active_users,
      total_sessions = EXCLUDED.total_sessions,
      total_energy_kwh = EXCLUDED.total_energy_kwh,
      total_revenue = EXCLUDED.total_revenue,
      total_stations = EXCLUDED.total_stations,
      total_slots = EXCLUDED.total_slots,
      new_stations = EXCLUDED.new_stations,
      total_carbon_saved_kg = EXCLUDED.total_carbon_saved_kg,
      user_growth_pct = EXCLUDED.user_growth_pct,
      session_growth_pct = EXCLUDED.session_growth_pct,
      energy_growth_pct = EXCLUDED.energy_growth_pct,
      updated_at = NOW()
    RETURNING *
  `;

  const results = [];
  for (const row of rows) {
    const res = await db.query(upsertSQL, [
      row.city, monthStart,
      row.total_users, row.new_users, row.active_users,
      row.total_sessions, row.total_energy_kwh, row.total_revenue,
      row.total_stations, row.total_slots, row.new_stations,
      row.total_carbon_saved_kg,
      row.user_growth_pct, row.session_growth_pct, row.energy_growth_pct,
    ]);
    results.push(res.rows[0]);
  }

  return results;
}

/**
 * Get city trends data.
 */
async function getCityTrends({ city, startMonth, endMonth } = {}) {
  let sql = `SELECT * FROM city_ev_trends WHERE 1=1`;
  const params = [];
  let idx = 1;

  if (city) { sql += ` AND city = $${idx++}`; params.push(city); }
  if (startMonth) { sql += ` AND stat_month >= $${idx++}`; params.push(startMonth); }
  if (endMonth) { sql += ` AND stat_month <= $${idx++}`; params.push(endMonth); }

  sql += ` ORDER BY stat_month DESC, city`;
  const { rows } = await db.query(sql, params);
  return rows;
}

/**
 * Get list of available cities from stations.
 */
async function getAvailableCities() {
  return caches.general.wrap('mobility:cities', async () => {
    const { rows } = await db.query(`
      SELECT DISTINCT city FROM stations
      WHERE city IS NOT NULL AND city != '' AND status = 'approved'
      ORDER BY city
    `);
    return rows.map(r => r.city);
  }, 10 * 60_000); // 10 minute cache — city list rarely changes
}

module.exports = {
  aggregateHeatmapData,
  getHeatmapData,
  aggregateBehaviorStats,
  getBehaviorStats,
  aggregateCityTrends,
  getCityTrends,
  getAvailableCities,
};

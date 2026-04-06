const db = require('../config/database');

/**
 * Aggregate daily stats for all stations (run as a scheduled job or on-demand).
 */
async function aggregateDailyStats(date = null) {
  const targetDate = date || new Date().toISOString().split('T')[0];

  await db.query(
    `INSERT INTO station_daily_stats
       (station_id, stat_date, total_sessions, total_reservations,
        total_energy_kwh, total_revenue, avg_session_duration_min,
        peak_hour, unique_users, avg_occupancy_rate)
     SELECT
       ck.station_id,
       $1::date,
       COUNT(cs.id)::int,
       0, -- reservations filled below
       COALESCE(SUM(cs.energy_delivered_kwh), 0),
       COALESCE(SUM(cs.cost), 0),
       COALESCE(AVG(EXTRACT(EPOCH FROM (cs.completed_at - cs.started_at)) / 60), 0)::numeric(8,2),
       MODE() WITHIN GROUP (ORDER BY EXTRACT(HOUR FROM cs.started_at)::int),
       COUNT(DISTINCT cs.user_id)::int,
       0
     FROM charging_sessions cs
     JOIN charging_slots ck ON ck.id = cs.slot_id
     WHERE cs.started_at::date = $1::date
       AND cs.status = 'completed'
     GROUP BY ck.station_id
     ON CONFLICT (station_id, stat_date)
     DO UPDATE SET
       total_sessions           = EXCLUDED.total_sessions,
       total_energy_kwh         = EXCLUDED.total_energy_kwh,
       total_revenue            = EXCLUDED.total_revenue,
       avg_session_duration_min = EXCLUDED.avg_session_duration_min,
       peak_hour                = EXCLUDED.peak_hour,
       unique_users             = EXCLUDED.unique_users,
       updated_at               = NOW()`,
    [targetDate],
  );

  // Fill in reservation counts
  await db.query(
    `UPDATE station_daily_stats sds
     SET total_reservations = sub.cnt
     FROM (
       SELECT station_id, COUNT(*)::int AS cnt
       FROM reservations
       WHERE scheduled_start::date = $1::date
         AND status NOT IN ('cancelled')
       GROUP BY station_id
     ) sub
     WHERE sds.station_id = sub.station_id
       AND sds.stat_date = $1::date`,
    [targetDate],
  );
}

/**
 * Get platform-wide analytics for the admin dashboard.
 */
async function getPlatformAnalytics({ startDate, endDate, period = 'daily' }) {
  const start = startDate || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const end = endDate || new Date().toISOString().split('T')[0];

  // ── Daily trends ──────────────────────────────────────
  const groupExpr = period === 'weekly'
    ? `DATE_TRUNC('week', stat_date)::date`
    : period === 'monthly'
      ? `DATE_TRUNC('month', stat_date)::date`
      : `stat_date`;

  const { rows: trends } = await db.query(
    `SELECT
       ${groupExpr} AS period,
       SUM(total_sessions)::int            AS sessions,
       SUM(total_reservations)::int        AS reservations,
       SUM(total_energy_kwh)::numeric(10,2) AS energy_kwh,
       SUM(total_revenue)::numeric(10,2)   AS revenue,
       SUM(unique_users)::int              AS unique_users
     FROM station_daily_stats
     WHERE stat_date BETWEEN $1 AND $2
     GROUP BY ${groupExpr}
     ORDER BY period`,
    [start, end],
  );

  // ── Most used stations ────────────────────────────────
  const { rows: topStations } = await db.query(
    `SELECT s.id, s.name, s.city,
            SUM(sds.total_sessions)::int AS total_sessions,
            SUM(sds.total_energy_kwh)::numeric(10,2) AS total_energy_kwh,
            SUM(sds.total_revenue)::numeric(10,2) AS total_revenue,
            ROUND(AVG(sds.avg_session_duration_min)::numeric, 1) AS avg_duration_min
     FROM station_daily_stats sds
     JOIN stations s ON s.id = sds.station_id
     WHERE sds.stat_date BETWEEN $1 AND $2
     GROUP BY s.id, s.name, s.city
     ORDER BY total_sessions DESC
     LIMIT 10`,
    [start, end],
  );

  // ── Peak charging hours (across all stations) ─────────
  const { rows: peakHours } = await db.query(
    `SELECT
       EXTRACT(HOUR FROM cs.started_at)::int AS hour,
       COUNT(*)::int AS sessions
     FROM charging_sessions cs
     WHERE cs.started_at BETWEEN $1::date AND ($2::date + INTERVAL '1 day')
       AND cs.status = 'completed'
     GROUP BY hour
     ORDER BY hour`,
    [start, end],
  );

  // ── Summary totals ────────────────────────────────────
  const { rows: summary } = await db.query(
    `SELECT
       SUM(total_sessions)::int              AS total_sessions,
       SUM(total_reservations)::int          AS total_reservations,
       SUM(total_energy_kwh)::numeric(10,2)  AS total_energy_kwh,
       SUM(total_revenue)::numeric(10,2)     AS total_revenue,
       ROUND(AVG(avg_session_duration_min)::numeric, 1) AS avg_session_duration_min,
       SUM(unique_users)::int                AS total_unique_users
     FROM station_daily_stats
     WHERE stat_date BETWEEN $1 AND $2`,
    [start, end],
  );

  // ── Daily reservations breakdown ──────────────────────
  const { rows: dailyReservations } = await db.query(
    `SELECT
       scheduled_start::date AS day,
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
       COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled
     FROM reservations
     WHERE scheduled_start BETWEEN $1::date AND ($2::date + INTERVAL '1 day')
     GROUP BY day
     ORDER BY day`,
    [start, end],
  );

  return {
    period: { start, end, groupBy: period },
    summary: summary[0] || {},
    trends,
    topStations,
    peakHours: peakHours.map((h) => ({
      hour: h.hour,
      label: `${String(h.hour).padStart(2, '0')}:00`,
      sessions: h.sessions,
    })),
    dailyReservations,
  };
}

/**
 * Get analytics for a single station (manager view).
 */
async function getStationAnalytics(stationId, { startDate, endDate } = {}) {
  const start = startDate || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const end = endDate || new Date().toISOString().split('T')[0];

  const { rows: daily } = await db.query(
    `SELECT stat_date, total_sessions, total_reservations,
            total_energy_kwh, total_revenue, avg_session_duration_min,
            peak_hour, unique_users
     FROM station_daily_stats
     WHERE station_id = $1 AND stat_date BETWEEN $2 AND $3
     ORDER BY stat_date`,
    [stationId, start, end],
  );

  const { rows: summary } = await db.query(
    `SELECT
       SUM(total_sessions)::int              AS total_sessions,
       SUM(total_reservations)::int          AS total_reservations,
       SUM(total_energy_kwh)::numeric(10,2)  AS total_energy_kwh,
       SUM(total_revenue)::numeric(10,2)     AS total_revenue,
       ROUND(AVG(avg_session_duration_min)::numeric, 1) AS avg_session_duration_min,
       SUM(unique_users)::int                AS total_unique_users
     FROM station_daily_stats
     WHERE station_id = $1 AND stat_date BETWEEN $2 AND $3`,
    [stationId, start, end],
  );

  // Slot utilization
  const { rows: slotUtil } = await db.query(
    `SELECT ck.slot_number, ck.charging_type, ck.power_output_kw,
            COUNT(cs.id)::int AS sessions,
            COALESCE(SUM(cs.energy_delivered_kwh), 0)::numeric(10,2) AS energy_kwh
     FROM charging_slots ck
     LEFT JOIN charging_sessions cs ON cs.slot_id = ck.id
       AND cs.started_at BETWEEN $2::date AND ($3::date + INTERVAL '1 day')
       AND cs.status = 'completed'
     WHERE ck.station_id = $1
     GROUP BY ck.id, ck.slot_number, ck.charging_type, ck.power_output_kw
     ORDER BY ck.slot_number`,
    [stationId, start, end],
  );

  return {
    period: { start, end },
    summary: summary[0] || {},
    daily,
    slotUtilization: slotUtil,
  };
}

module.exports = { aggregateDailyStats, getPlatformAnalytics, getStationAnalytics };

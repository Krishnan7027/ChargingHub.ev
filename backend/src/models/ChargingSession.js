const db = require('../config/database');

const ChargingSession = {
  async create({ reservationId, slotId, userId, startPercentage, targetPercentage }, client = null) {
    const conn = client || db;
    const { rows } = await conn.query(
      `INSERT INTO charging_sessions
         (reservation_id, slot_id, user_id, start_percentage, current_percentage, target_percentage, status, started_at)
       VALUES ($1, $2, $3, $4, $4, $5, 'charging', NOW())
       RETURNING *`,
      [reservationId, slotId, userId, startPercentage, targetPercentage || 100]
    );
    return rows[0];
  },

  async findById(id) {
    const { rows } = await db.query(
      `SELECT cs.*, u.full_name AS user_name, u.email AS user_email,
              csl.slot_number, csl.charging_type, csl.connector_type, csl.power_output_kw,
              s.name AS station_name, s.id AS station_id, s.pricing_per_kwh
       FROM charging_sessions cs
       JOIN users u ON cs.user_id = u.id
       JOIN charging_slots csl ON cs.slot_id = csl.id
       JOIN stations s ON csl.station_id = s.id
       WHERE cs.id = $1`,
      [id]
    );

    if (!rows[0]) return null;
    return this._attachEstimatedCompletion(rows[0]);
  },

  async findActiveBySlot(slotId, client = null) {
    const conn = client || db;
    const { rows } = await conn.query(
      `SELECT * FROM charging_sessions WHERE slot_id = $1 AND status = 'charging' LIMIT 1`,
      [slotId]
    );
    return rows[0] || null;
  },

  async findActiveByUser(userId) {
    const { rows } = await db.query(
      `SELECT cs.*, csl.slot_number, csl.power_output_kw, csl.charging_type,
              s.name AS station_name, s.id AS station_id
       FROM charging_sessions cs
       JOIN charging_slots csl ON cs.slot_id = csl.id
       JOIN stations s ON csl.station_id = s.id
       WHERE cs.user_id = $1 AND cs.status = 'charging'
       ORDER BY cs.started_at DESC`,
      [userId]
    );
    return rows.map((r) => this._attachEstimatedCompletion(r));
  },

  async updateProgress({ id, currentPercentage, energyDeliveredKwh, averagePowerKw, cost }) {
    const { rows } = await db.query(
      `UPDATE charging_sessions
       SET current_percentage = $1,
           energy_delivered_kwh = $2,
           average_power_kw = $3,
           cost = $4
       WHERE id = $5
       RETURNING *`,
      [currentPercentage, energyDeliveredKwh, averagePowerKw, cost, id]
    );
    return rows[0];
  },

  async complete(id) {
    const { rows } = await db.query(
      `UPDATE charging_sessions
       SET status = 'completed',
           completed_at = NOW(),
           current_percentage = target_percentage
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    return rows[0];
  },

  async findByStation(stationId, { status, page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;
    const conditions = ['csl.station_id = $1'];
    const values = [stationId];
    let idx = 2;

    if (status) {
      conditions.push(`cs.status = $${idx}`);
      values.push(status);
      idx++;
    }

    values.push(limit, offset);

    const { rows } = await db.query(
      `SELECT cs.*, u.full_name AS user_name, csl.slot_number, csl.power_output_kw
       FROM charging_sessions cs
       JOIN users u ON cs.user_id = u.id
       JOIN charging_slots csl ON cs.slot_id = csl.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY cs.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      values
    );

    return rows.map((r) => this._attachEstimatedCompletion(r));
  },

  /**
   * Calculate estimated_completion_time for a charging session row.
   * Uses current_percentage, target_percentage, power_output_kw and the
   * charging-curve slow-down above 80 %.
   */
  /**
   * Mark sessions stuck in 'charging' status for longer than maxHours as 'failed'
   * and reset the corresponding slot to 'available'.
   * Uses a CTE to atomically find and update stale sessions, then reset slots.
   * Returns the number of sessions failed.
   */
  async failStaleSessions(maxHours = 4) {
    const { rows } = await db.query(
      `WITH stale AS (
         UPDATE charging_sessions
         SET status = 'failed', completed_at = NOW()
         WHERE status = 'charging'
           AND started_at < NOW() - INTERVAL '1 hour' * $1
         RETURNING slot_id
       )
       UPDATE charging_slots
       SET status = 'available'
       WHERE id IN (SELECT slot_id FROM stale)
       RETURNING id`,
      [maxHours]
    );
    return rows.length;
  },

  async findHistoryByUser(userId, { status, station_id, start_date, end_date, sort_by = 'started_at', sort_order = 'desc', page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;
    const conditions = ['cs.user_id = $1'];
    const values = [userId];
    let idx = 2;

    if (status) {
      conditions.push(`cs.status = $${idx}`);
      values.push(status);
      idx++;
    }
    if (station_id) {
      conditions.push(`s.id = $${idx}`);
      values.push(station_id);
      idx++;
    }
    if (start_date) {
      conditions.push(`cs.started_at >= $${idx}`);
      values.push(start_date);
      idx++;
    }
    if (end_date) {
      conditions.push(`cs.started_at <= $${idx}`);
      values.push(end_date + 'T23:59:59.999Z');
      idx++;
    }

    const allowedSorts = ['started_at', 'cost', 'energy_delivered_kwh', 'completed_at'];
    const sortCol = allowedSorts.includes(sort_by) ? `cs.${sort_by}` : 'cs.started_at';
    const sortDir = sort_order === 'asc' ? 'ASC' : 'DESC';

    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total
       FROM charging_sessions cs
       JOIN charging_slots csl ON cs.slot_id = csl.id
       JOIN stations s ON csl.station_id = s.id
       WHERE ${conditions.join(' AND ')}`,
      values
    );

    values.push(limit, offset);
    const { rows } = await db.query(
      `SELECT cs.*, u.full_name AS user_name, u.email AS user_email,
              csl.slot_number, csl.charging_type, csl.connector_type, csl.power_output_kw,
              s.name AS station_name, s.id AS station_id, s.pricing_per_kwh
       FROM charging_sessions cs
       JOIN users u ON cs.user_id = u.id
       JOIN charging_slots csl ON cs.slot_id = csl.id
       JOIN stations s ON csl.station_id = s.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY ${sortCol} ${sortDir}
       LIMIT $${idx} OFFSET $${idx + 1}`,
      values
    );

    return { sessions: rows, total: countResult.rows[0].total };
  },

  async getHistoryDetail(sessionId, userId) {
    const { rows } = await db.query(
      `SELECT cs.*, u.full_name AS user_name, u.email AS user_email,
              csl.slot_number, csl.charging_type, csl.connector_type, csl.power_output_kw,
              s.name AS station_name, s.id AS station_id, s.pricing_per_kwh, s.address AS station_address
       FROM charging_sessions cs
       JOIN users u ON cs.user_id = u.id
       JOIN charging_slots csl ON cs.slot_id = csl.id
       JOIN stations s ON csl.station_id = s.id
       WHERE cs.id = $1 AND cs.user_id = $2`,
      [sessionId, userId]
    );
    return rows[0] || null;
  },

  async getUserStats(userId) {
    const { rows } = await db.query(
      `SELECT
         COUNT(*)::int AS total_sessions,
         COALESCE(SUM(energy_delivered_kwh), 0)::float AS total_energy_kwh,
         COALESCE(SUM(cost), 0)::float AS total_cost,
         COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) / 60), 0)::float AS avg_duration_min,
         CASE WHEN COUNT(*) > 0
           THEN (COALESCE(SUM(energy_delivered_kwh), 0) / COUNT(*))::float
           ELSE 0
         END AS avg_energy_per_session
       FROM charging_sessions
       WHERE user_id = $1 AND status = 'completed'`,
      [userId]
    );
    const r = rows[0];
    return {
      totalSessions: r.total_sessions,
      totalEnergyKwh: Math.round(r.total_energy_kwh * 10) / 10,
      totalCost: Math.round(r.total_cost),
      avgDurationMin: Math.round(r.avg_duration_min),
      avgEnergyPerSession: Math.round(r.avg_energy_per_session * 10) / 10,
    };
  },

  _attachEstimatedCompletion(row) {
    if (!row || row.status !== 'charging') return row;

    const remaining = parseFloat(row.target_percentage) - parseFloat(row.current_percentage);
    if (remaining <= 0) {
      row.estimated_minutes_remaining = 0;
      row.estimated_completion_time = new Date().toISOString();
      return row;
    }

    const batteryCapacityKwh = 60; // typical EV
    const energyNeeded = (remaining / 100) * batteryCapacityKwh;
    const power = parseFloat(row.average_power_kw || row.power_output_kw || 22);
    const efficiency = parseFloat(row.current_percentage) > 80 ? 0.5 : 0.85;
    const hours = energyNeeded / (power * efficiency);
    const minutes = Math.ceil(hours * 60);

    row.estimated_minutes_remaining = minutes;
    row.estimated_completion_time = new Date(Date.now() + minutes * 60_000).toISOString();
    return row;
  },
};

module.exports = ChargingSession;

const db = require('../config/database');

const ChargingSlot = {
  async create({ stationId, slotNumber, chargingType, connectorType, powerOutputKw }) {
    const { rows } = await db.query(
      `INSERT INTO charging_slots (station_id, slot_number, charging_type, connector_type, power_output_kw)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [stationId, slotNumber, chargingType, connectorType, powerOutputKw]
    );
    return rows[0];
  },

  /**
   * Returns all slots for a station, enriched with:
   *  - active_session (JSON) including current_percentage, target, and estimated_completion_time
   */
  async findByStation(stationId) {
    const { rows } = await db.query(
      `SELECT cs.*,
              CASE WHEN cs.current_session_id IS NOT NULL
                THEN (
                  SELECT row_to_json(sess) FROM (
                    SELECT id, status, current_percentage, target_percentage,
                           start_percentage, energy_delivered_kwh, average_power_kw,
                           cost, started_at
                    FROM charging_sessions
                    WHERE id = cs.current_session_id
                  ) sess
                )
                ELSE NULL
              END AS active_session
       FROM charging_slots cs
       WHERE cs.station_id = $1
       ORDER BY cs.slot_number`,
      [stationId]
    );

    // Attach estimated completion time on the application side (uses charging curve logic)
    for (const slot of rows) {
      if (slot.active_session && slot.active_session.status === 'charging') {
        const s = slot.active_session;
        const remaining = parseFloat(s.target_percentage) - parseFloat(s.current_percentage);
        if (remaining <= 0) {
          s.estimated_minutes_remaining = 0;
          s.estimated_completion_time = new Date().toISOString();
        } else {
          const batteryKwh = 60;
          const energyNeeded = (remaining / 100) * batteryKwh;
          const power = parseFloat(s.average_power_kw || slot.power_output_kw || 22);
          const efficiency = parseFloat(s.current_percentage) > 80 ? 0.5 : 0.85;
          const minutes = Math.ceil((energyNeeded / (power * efficiency)) * 60);
          s.estimated_minutes_remaining = minutes;
          s.estimated_completion_time = new Date(Date.now() + minutes * 60_000).toISOString();
        }
      }
    }

    return rows;
  },

  async findById(id, client = null) {
    const conn = client || db;
    const { rows } = await conn.query('SELECT * FROM charging_slots WHERE id = $1', [id]);
    return rows[0] || null;
  },

  /**
   * Lock a slot row for update within a transaction.
   * Must be called with a transaction client.
   */
  async findByIdForUpdate(id, client) {
    const { rows } = await client.query('SELECT * FROM charging_slots WHERE id = $1 FOR UPDATE', [id]);
    return rows[0] || null;
  },

  async updateStatus(id, status, sessionId = null, client = null) {
    const conn = client || db;
    // When freeing a slot, also clear reservation lock fields
    const clearReservation = (status === 'available');
    const { rows } = await conn.query(
      `UPDATE charging_slots
       SET status = $1,
           current_session_id = $2,
           reserved_by = CASE WHEN $4 THEN NULL ELSE reserved_by END,
           reserved_at = CASE WHEN $4 THEN NULL ELSE reserved_at END
       WHERE id = $3 RETURNING *`,
      [status, sessionId, id, clearReservation]
    );
    return rows[0];
  },

  /**
   * Atomically reserve a slot for a user.
   * Uses FOR UPDATE lock + status check to prevent double-booking.
   * Returns the locked row or null if slot is not available.
   */
  async reserveSlot(id, userId, client) {
    const { rows } = await client.query(
      `UPDATE charging_slots
       SET status = 'reserved', reserved_by = $1, reserved_at = NOW()
       WHERE id = $2 AND status = 'available'
       RETURNING *`,
      [userId, id]
    );
    return rows[0] || null;
  },

  /**
   * Release expired slot reservations.
   * Called by the scheduler — resets slots where reserved_at exceeded TTL.
   * Returns count of slots released.
   */
  async releaseExpiredReservations(ttlMinutes = 15) {
    const { rowCount } = await db.query(
      `UPDATE charging_slots
       SET status = 'available', reserved_by = NULL, reserved_at = NULL, current_session_id = NULL
       WHERE status = 'reserved'
         AND reserved_at IS NOT NULL
         AND reserved_at < NOW() - INTERVAL '1 minute' * $1`,
      [ttlMinutes]
    );
    return rowCount;
  },

  async update(id, fields) {
    const allowed = ['charging_type', 'connector_type', 'power_output_kw', 'status'];
    const sets = [];
    const values = [];
    let idx = 1;

    for (const [key, value] of Object.entries(fields)) {
      if (allowed.includes(key)) {
        sets.push(`${key} = $${idx}`);
        values.push(value);
        idx++;
      }
    }

    if (sets.length === 0) return null;
    values.push(id);

    const { rows } = await db.query(
      `UPDATE charging_slots SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return rows[0];
  },

  async delete(id) {
    await db.query('DELETE FROM charging_slots WHERE id = $1', [id]);
  },

  async getAvailableCount(stationId) {
    const { rows } = await db.query(
      `SELECT COUNT(*) FROM charging_slots WHERE station_id = $1 AND status = 'available'`,
      [stationId]
    );
    return parseInt(rows[0].count, 10);
  },
};

module.exports = ChargingSlot;

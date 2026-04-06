const db = require('../config/database');

const Reservation = {
  async create({ userId, slotId, stationId, scheduledStart, scheduledEnd, vehicleInfo, notes }, client = null) {
    const conn = client || db;
    const { rows } = await conn.query(
      `INSERT INTO reservations (user_id, slot_id, station_id, scheduled_start, scheduled_end, vehicle_info, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'confirmed')
       RETURNING *`,
      [userId, slotId, stationId, scheduledStart, scheduledEnd, JSON.stringify(vehicleInfo || {}), notes]
    );
    return rows[0];
  },

  async findById(id) {
    const { rows } = await db.query(
      `SELECT r.*,
              s.name as station_name, s.address as station_address,
              cs.slot_number, cs.charging_type, cs.connector_type,
              u.full_name as user_name, u.email as user_email
       FROM reservations r
       JOIN stations s ON r.station_id = s.id
       JOIN charging_slots cs ON r.slot_id = cs.id
       JOIN users u ON r.user_id = u.id
       WHERE r.id = $1`,
      [id]
    );
    return rows[0];
  },

  async findByUser(userId, { status, page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;
    const conditions = ['r.user_id = $1'];
    const values = [userId];
    let paramIndex = 2;

    if (status) {
      conditions.push(`r.status = $${paramIndex}`);
      values.push(status);
      paramIndex++;
    }

    values.push(limit, offset);

    const { rows } = await db.query(
      `SELECT r.*, s.name as station_name, s.address as station_address,
              cs.slot_number, cs.charging_type
       FROM reservations r
       JOIN stations s ON r.station_id = s.id
       JOIN charging_slots cs ON r.slot_id = cs.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY r.scheduled_start DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      values
    );

    return rows;
  },

  async findByStation(stationId, { status, page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;
    const conditions = ['r.station_id = $1'];
    const values = [stationId];
    let paramIndex = 2;

    if (status) {
      conditions.push(`r.status = $${paramIndex}`);
      values.push(status);
      paramIndex++;
    }

    values.push(limit, offset);

    const { rows } = await db.query(
      `SELECT r.*, u.full_name as user_name, u.email as user_email,
              cs.slot_number, cs.charging_type
       FROM reservations r
       JOIN users u ON r.user_id = u.id
       JOIN charging_slots cs ON r.slot_id = cs.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY r.scheduled_start DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      values
    );

    return rows;
  },

  async updateStatus(id, status, client = null) {
    const conn = client || db;
    const updates = { status };
    if (status === 'active') updates.actual_start = new Date();
    if (status === 'completed') updates.actual_end = new Date();

    const sets = Object.entries(updates).map(([k, _], i) => `${k} = $${i + 1}`);
    const values = Object.values(updates);
    values.push(id);

    const { rows } = await conn.query(
      `UPDATE reservations SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );
    return rows[0];
  },

  async checkConflict(slotId, scheduledStart, scheduledEnd, excludeId = null, client = null) {
    const conn = client || db;
    const conditions = [
      'slot_id = $1',
      "status IN ('confirmed', 'active')",
      'scheduled_start < $3',
      'scheduled_end > $2',
    ];
    const values = [slotId, scheduledStart, scheduledEnd];

    if (excludeId) {
      conditions.push(`id != $4`);
      values.push(excludeId);
    }

    const { rows } = await conn.query(
      `SELECT id FROM reservations WHERE ${conditions.join(' AND ')} LIMIT 1`,
      values
    );
    return rows.length > 0;
  },

  /**
   * Find the active reservation for a specific slot and user.
   */
  async findActiveBySlotAndUser(slotId, userId, client = null) {
    const conn = client || db;
    const { rows } = await conn.query(
      `SELECT * FROM reservations
       WHERE slot_id = $1 AND user_id = $2 AND status IN ('confirmed', 'active')
       ORDER BY scheduled_start ASC LIMIT 1`,
      [slotId, userId]
    );
    return rows[0] || null;
  },

  /**
   * Find any active reservation for a specific slot.
   */
  async findActiveBySlot(slotId, client = null) {
    const conn = client || db;
    const { rows } = await conn.query(
      `SELECT * FROM reservations
       WHERE slot_id = $1 AND status IN ('confirmed', 'active')
       ORDER BY scheduled_start ASC LIMIT 1`,
      [slotId]
    );
    return rows[0] || null;
  },

  async expireOldReservations() {
    const { rowCount } = await db.query(
      `WITH expired AS (
        UPDATE reservations SET status = 'expired'
        WHERE status = 'confirmed' AND scheduled_start < NOW() - INTERVAL '15 minutes'
        RETURNING slot_id
      )
      UPDATE charging_slots
      SET status = 'available', current_session_id = NULL,
          reserved_by = NULL, reserved_at = NULL
      WHERE id IN (SELECT slot_id FROM expired)
        AND status = 'reserved'
        AND current_session_id IS NULL`
    );
    return rowCount;
  },
};

module.exports = Reservation;

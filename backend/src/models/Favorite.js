const db = require('../config/database');

const Favorite = {
  async create({ userId, stationId }) {
    const { rows } = await db.query(
      `INSERT INTO favorites (user_id, station_id)
       VALUES ($1, $2)
       RETURNING *`,
      [userId, stationId]
    );
    return rows[0];
  },

  async delete({ userId, stationId }) {
    const { rows } = await db.query(
      `DELETE FROM favorites WHERE user_id = $1 AND station_id = $2 RETURNING *`,
      [userId, stationId]
    );
    return rows[0] || null;
  },

  async findByUser(userId) {
    const { rows } = await db.query(
      `SELECT f.*,
              s.name AS station_name,
              s.address AS station_address,
              s.city AS station_city,
              s.status AS station_status,
              COALESCE(slot_agg.total_slots, 0) AS total_slots,
              COALESCE(slot_agg.available_slots, 0) AS available_slots
       FROM favorites f
       JOIN stations s ON f.station_id = s.id
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS total_slots,
                COUNT(*) FILTER (WHERE status = 'available') AS available_slots
         FROM charging_slots WHERE station_id = s.id
       ) slot_agg ON true
       WHERE f.user_id = $1
       ORDER BY f.created_at DESC`,
      [userId]
    );
    return rows;
  },

  async findOne({ userId, stationId }) {
    const { rows } = await db.query(
      `SELECT * FROM favorites WHERE user_id = $1 AND station_id = $2`,
      [userId, stationId]
    );
    return rows[0] || null;
  },

  async countByStation(stationId) {
    const { rows } = await db.query(
      `SELECT COUNT(*)::int AS count FROM favorites WHERE station_id = $1`,
      [stationId]
    );
    return rows[0].count;
  },
};

module.exports = Favorite;

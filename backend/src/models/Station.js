const db = require('../config/database');
const { normalizeOperatingHours } = require('../utils/operatingHours');

const Station = {
  async create({ managerId, name, description, address, city, state, zipCode, country, latitude, longitude, operatingHours, amenities, images, pricingPerKwh }) {
    const normalized = normalizeOperatingHours(operatingHours);
    const { rows } = await db.query(
      `INSERT INTO stations (manager_id, name, description, address, city, state, zip_code, country, latitude, longitude, operating_hours, amenities, images, pricing_per_kwh)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [managerId, name, description, address, city, state, zipCode, country || 'IN', latitude, longitude, JSON.stringify(normalized), amenities || [], images || [], pricingPerKwh]
    );
    return rows[0];
  },

  async findById(id) {
    const { rows } = await db.query(
      `SELECT s.*, u.full_name as manager_name,
              COALESCE(slot_agg.total_slots, 0) as total_slots,
              COALESCE(slot_agg.available_slots, 0) as available_slots
       FROM stations s
       JOIN users u ON s.manager_id = u.id
       LEFT JOIN LATERAL (
         SELECT COUNT(*) as total_slots,
                COUNT(*) FILTER (WHERE status = 'available') as available_slots
         FROM charging_slots WHERE station_id = s.id
       ) slot_agg ON true
       WHERE s.id = $1`,
      [id]
    );
    return rows[0];
  },

  async findNearby({ latitude, longitude, radiusKm = 25, page = 1, limit = 20 }) {
    const offset = (page - 1) * limit;
    const radiusMeters = radiusKm * 1000;
    const { rows } = await db.query(
      `SELECT s.*,
              earth_distance(ll_to_earth(s.latitude, s.longitude), ll_to_earth($1, $2)) as distance_meters,
              COALESCE(slot_agg.total_slots, 0) as total_slots,
              COALESCE(slot_agg.available_slots, 0) as available_slots
       FROM stations s
       LEFT JOIN LATERAL (
         SELECT COUNT(*) as total_slots,
                COUNT(*) FILTER (WHERE status = 'available') as available_slots
         FROM charging_slots WHERE station_id = s.id
       ) slot_agg ON true
       WHERE s.status = 'approved'
         AND earth_distance(ll_to_earth(s.latitude, s.longitude), ll_to_earth($1, $2)) < $3
       ORDER BY distance_meters ASC
       LIMIT $4 OFFSET $5`,
      [latitude, longitude, radiusMeters, limit, offset]
    );
    return rows;
  },

  async search({ query, city, chargingType, page = 1, limit = 20 }) {
    const offset = (page - 1) * limit;
    const conditions = ["s.status = 'approved'"];
    const values = [];
    let paramIndex = 1;

    if (query) {
      conditions.push(`(s.name ILIKE $${paramIndex} OR s.address ILIKE $${paramIndex} OR s.description ILIKE $${paramIndex})`);
      values.push(`%${query}%`);
      paramIndex++;
    }

    if (city) {
      conditions.push(`s.city ILIKE $${paramIndex}`);
      values.push(`%${city}%`);
      paramIndex++;
    }

    if (chargingType) {
      conditions.push(`EXISTS (SELECT 1 FROM charging_slots cs WHERE cs.station_id = s.id AND cs.charging_type = $${paramIndex})`);
      values.push(chargingType);
      paramIndex++;
    }

    const where = conditions.join(' AND ');
    values.push(limit, offset);

    const { rows } = await db.query(
      `SELECT s.*,
              COALESCE(slot_agg.total_slots, 0) as total_slots,
              COALESCE(slot_agg.available_slots, 0) as available_slots
       FROM stations s
       LEFT JOIN LATERAL (
         SELECT COUNT(*) as total_slots,
                COUNT(*) FILTER (WHERE status = 'available') as available_slots
         FROM charging_slots WHERE station_id = s.id
       ) slot_agg ON true
       WHERE ${where}
       ORDER BY s.rating DESC, s.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      values
    );

    const { rows: countRows } = await db.query(
      `SELECT COUNT(*) FROM stations s WHERE ${where}`,
      values.slice(0, -2)
    );

    return { stations: rows, total: parseInt(countRows[0].count, 10) };
  },

  async findByManager(managerId, { page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;
    const { rows } = await db.query(
      `SELECT s.*,
              COALESCE(slot_agg.total_slots, 0) as total_slots,
              COALESCE(slot_agg.available_slots, 0) as available_slots
       FROM stations s
       LEFT JOIN LATERAL (
         SELECT COUNT(*) as total_slots,
                COUNT(*) FILTER (WHERE status = 'available') as available_slots
         FROM charging_slots WHERE station_id = s.id
       ) slot_agg ON true
       WHERE s.manager_id = $1
       ORDER BY s.created_at DESC
       LIMIT $2 OFFSET $3`,
      [managerId, limit, offset]
    );
    return rows;
  },

  async update(id, fields) {
    const allowed = ['name', 'description', 'address', 'city', 'state', 'zip_code', 'latitude', 'longitude', 'status', 'operating_hours', 'amenities', 'images', 'pricing_per_kwh'];
    const sets = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(fields)) {
      if (allowed.includes(key)) {
        sets.push(`${key} = $${paramIndex}`);
        if (key === 'operating_hours') {
          values.push(JSON.stringify(normalizeOperatingHours(value)));
        } else {
          values.push(value);
        }
        paramIndex++;
      }
    }

    if (sets.length === 0) return null;
    values.push(id);

    const { rows } = await db.query(
      `UPDATE stations SET ${sets.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return rows[0];
  },

  async updateStatus(id, status) {
    const { rows } = await db.query(
      'UPDATE stations SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );
    return rows[0];
  },

  async findAll({ status, page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (status) {
      conditions.push(`s.status = $${paramIndex}`);
      values.push(status);
      paramIndex++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    values.push(limit, offset);

    const { rows } = await db.query(
      `SELECT s.*, u.full_name as manager_name,
              COALESCE(slot_agg.total_slots, 0) as total_slots
       FROM stations s
       JOIN users u ON s.manager_id = u.id
       LEFT JOIN LATERAL (
         SELECT COUNT(*) as total_slots
         FROM charging_slots WHERE station_id = s.id
       ) slot_agg ON true
       ${where}
       ORDER BY s.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      values
    );

    const { rows: countRows } = await db.query(
      `SELECT COUNT(*) FROM stations s ${where}`,
      values.slice(0, -2)
    );

    return { stations: rows, total: parseInt(countRows[0].count, 10) };
  },
};

module.exports = Station;

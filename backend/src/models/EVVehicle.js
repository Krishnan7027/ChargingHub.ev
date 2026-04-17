const db = require('../config/database');

const EVVehicle = {
  async create({ userId, brand, model, batteryCapacityKwh, rangeKm, fastCharging, chargingPortType, imageUrl }) {
    const { rows } = await db.query(
      `INSERT INTO ev_vehicles (user_id, brand, model, battery_capacity_kwh, range_km, fast_charging, charging_port_type, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [userId, brand, model, batteryCapacityKwh || null, rangeKm || null, fastCharging || false, chargingPortType || null, imageUrl || null]
    );
    return rows[0];
  },

  async findByUserId(userId) {
    const { rows } = await db.query(
      `SELECT * FROM ev_vehicles WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC`,
      [userId]
    );
    return rows;
  },

  async findById(id) {
    const { rows } = await db.query(
      `SELECT * FROM ev_vehicles WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  async update(id, fields) {
    const allowed = ['brand', 'model', 'battery_capacity_kwh', 'range_km', 'fast_charging', 'charging_port_type', 'image_url'];
    const sets = [];
    const values = [];
    let idx = 1;

    // Map camelCase to snake_case
    const keyMap = {
      batteryCapacityKwh: 'battery_capacity_kwh',
      rangeKm: 'range_km',
      fastCharging: 'fast_charging',
      chargingPortType: 'charging_port_type',
      imageUrl: 'image_url',
    };

    for (const [key, value] of Object.entries(fields)) {
      const dbKey = keyMap[key] || key;
      if (allowed.includes(dbKey)) {
        sets.push(`${dbKey} = $${idx}`);
        values.push(value);
        idx++;
      }
    }

    if (sets.length === 0) return this.findById(id);

    sets.push(`updated_at = NOW()`);
    values.push(id);
    const { rows } = await db.query(
      `UPDATE ev_vehicles SET ${sets.join(', ')} WHERE id = $${idx}
       RETURNING *`,
      values
    );
    return rows[0];
  },

  async delete(id) {
    const { rowCount } = await db.query('DELETE FROM ev_vehicles WHERE id = $1', [id]);
    return rowCount > 0;
  },

  async setDefault(userId, vehicleId) {
    // Unset all defaults for this user
    await db.query(
      `UPDATE ev_vehicles SET is_default = false, updated_at = NOW() WHERE user_id = $1`,
      [userId]
    );
    // Set the specified vehicle as default
    await db.query(
      `UPDATE ev_vehicles SET is_default = true, updated_at = NOW() WHERE id = $1 AND user_id = $2`,
      [vehicleId, userId]
    );
  },
};

module.exports = EVVehicle;

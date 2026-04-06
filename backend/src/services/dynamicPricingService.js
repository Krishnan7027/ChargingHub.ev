const db = require('../config/database');

/**
 * Get the effective price for a station at a given time.
 * Evaluates all active rules and picks the one with highest priority.
 */
async function getEffectivePrice(stationId, dateTime = new Date()) {
  const dayOfWeek = dateTime.getDay();
  const timeStr = `${String(dateTime.getHours()).padStart(2, '0')}:${String(dateTime.getMinutes()).padStart(2, '0')}`;

  const { rows } = await db.query(
    `SELECT id, name, price_per_kwh, day_of_week, start_time, end_time, priority
     FROM pricing_rules
     WHERE station_id = $1
       AND is_active = true
       AND ($2::time BETWEEN start_time AND end_time)
       AND (day_of_week IS NULL OR $3 = ANY(day_of_week))
     ORDER BY priority DESC
     LIMIT 1`,
    [stationId, timeStr, dayOfWeek],
  );

  if (rows.length > 0) {
    return {
      pricePerKwh: Number(rows[0].price_per_kwh),
      ruleName: rows[0].name,
      ruleId: rows[0].id,
    };
  }

  // Fallback to station's default price
  const { rows: station } = await db.query(
    `SELECT pricing_per_kwh FROM stations WHERE id = $1`,
    [stationId],
  );
  return {
    pricePerKwh: Number(station[0]?.pricing_per_kwh) || 0.30,
    ruleName: 'Default',
    ruleId: null,
  };
}

/**
 * Estimate cost for a charging session.
 */
async function estimateCost(stationId, energyKwh, dateTime = new Date()) {
  const { pricePerKwh, ruleName } = await getEffectivePrice(stationId, dateTime);
  const estimatedCost = Math.round(energyKwh * pricePerKwh * 100) / 100;
  return {
    estimatedCost,
    pricePerKwh,
    energyKwh,
    ruleName,
  };
}

/**
 * Get the full pricing schedule for a station (all rules).
 */
async function getPricingSchedule(stationId) {
  const { rows } = await db.query(
    `SELECT id, name, price_per_kwh, day_of_week, start_time, end_time, priority, is_active
     FROM pricing_rules
     WHERE station_id = $1
     ORDER BY priority DESC, start_time ASC`,
    [stationId],
  );

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    pricePerKwh: Number(r.price_per_kwh),
    days: r.day_of_week ? r.day_of_week.map((d) => dayNames[d]) : ['All'],
    startTime: r.start_time,
    endTime: r.end_time,
    priority: r.priority,
    isActive: r.is_active,
  }));
}

/**
 * Create a pricing rule (station manager).
 */
async function createRule(stationId, { name, pricePerKwh, dayOfWeek, startTime, endTime, priority }) {
  const { rows } = await db.query(
    `INSERT INTO pricing_rules
       (station_id, name, price_per_kwh, day_of_week, start_time, end_time, priority)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [stationId, name, pricePerKwh, dayOfWeek || null, startTime || '00:00', endTime || '23:59', priority || 0],
  );
  return rows[0];
}

/**
 * Update a pricing rule.
 */
async function updateRule(ruleId, data) {
  const allowed = ['name', 'price_per_kwh', 'day_of_week', 'start_time', 'end_time', 'priority', 'is_active'];
  const sets = [];
  const vals = [];
  let idx = 1;

  for (const [key, val] of Object.entries(data)) {
    if (allowed.includes(key)) {
      sets.push(`${key} = $${idx}`);
      vals.push(val);
      idx++;
    }
  }
  if (sets.length === 0) return null;

  vals.push(ruleId);
  const { rows } = await db.query(
    `UPDATE pricing_rules SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    vals,
  );
  return rows[0];
}

/**
 * Delete a pricing rule.
 */
async function deleteRule(ruleId) {
  await db.query(`DELETE FROM pricing_rules WHERE id = $1`, [ruleId]);
}

module.exports = {
  getEffectivePrice,
  estimateCost,
  getPricingSchedule,
  createRule,
  updateRule,
  deleteRule,
};

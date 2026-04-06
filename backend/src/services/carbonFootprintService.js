const db = require('../config/database');

/**
 * Carbon Footprint Tracking Service
 *
 * Calculates CO₂ emissions avoided by EV charging vs. gasoline vehicles.
 *
 * Constants (US average, adjustable per region):
 *   - Average ICE vehicle: 8.887 kg CO₂ per gallon of gasoline
 *   - Average fuel economy: 25.4 MPG (US EPA 2023)
 *   - EV efficiency: ~3.5 miles per kWh (EPA average)
 *   - Grid carbon intensity: ~400 gCO₂/kWh (US average, varies by region)
 *   - Tree absorption: ~22 kg CO₂/year per mature tree
 *
 * Net carbon saved = gasoline_co2_avoided - grid_charging_co2
 */

const CONSTANTS = {
  ICE_CO2_PER_GALLON_KG: 8.887,       // kg CO₂ per gallon gasoline
  ICE_MPG: 25.4,                        // miles per gallon
  EV_MILES_PER_KWH: 3.5,              // miles per kWh
  GRID_CO2_G_PER_KWH: 400,            // grams CO₂ per kWh (US average)
  TREE_CO2_KG_PER_YEAR: 22,           // kg CO₂ absorbed per tree per year
  RENEWABLE_PCT_DEFAULT: 20,           // default renewable % in grid mix
};

/**
 * Record carbon footprint for a completed charging session.
 */
async function recordSessionCarbon(sessionId) {
  // Get session details
  const { rows: sessions } = await db.query(
    `SELECT cs.id, cs.user_id, cs.energy_delivered_kwh, cs.cost,
            ck.station_id, ck.power_output_kw
     FROM charging_sessions cs
     JOIN charging_slots ck ON ck.id = cs.slot_id
     WHERE cs.id = $1`,
    [sessionId],
  );
  if (sessions.length === 0) return null;
  const sess = sessions[0];
  const energyKwh = Number(sess.energy_delivered_kwh) || 0;
  if (energyKwh <= 0) return null;

  // Check if already recorded
  const { rows: existing } = await db.query(
    `SELECT id FROM carbon_footprint_records WHERE session_id = $1`,
    [sessionId],
  );
  if (existing.length > 0) return getSessionCarbon(sessionId);

  // Calculate miles this energy would power
  const evMiles = energyKwh * CONSTANTS.EV_MILES_PER_KWH;

  // Gasoline equivalent
  const gallonsAvoided = evMiles / CONSTANTS.ICE_MPG;
  const gasolineCo2AvoidedKg = gallonsAvoided * CONSTANTS.ICE_CO2_PER_GALLON_KG;

  // Grid charging emissions
  const gridCo2Kg = (energyKwh * CONSTANTS.GRID_CO2_G_PER_KWH) / 1000;

  // Net savings
  const netCarbonSavedKg = gasolineCo2AvoidedKg - gridCo2Kg;

  // Equivalencies
  const treesEquivalent = netCarbonSavedKg / CONSTANTS.TREE_CO2_KG_PER_YEAR;
  const milesOffset = evMiles;

  const { rows: created } = await db.query(
    `INSERT INTO carbon_footprint_records
       (session_id, user_id, station_id, energy_kwh,
        grid_carbon_intensity_gco2_kwh, gasoline_co2_avoided_kg,
        net_carbon_saved_kg, trees_equivalent, miles_offset, renewable_percentage)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id`,
    [sess.id, sess.user_id, sess.station_id, energyKwh,
     CONSTANTS.GRID_CO2_G_PER_KWH, gasolineCo2AvoidedKg.toFixed(3),
     netCarbonSavedKg.toFixed(3), treesEquivalent.toFixed(2),
     milesOffset.toFixed(2), CONSTANTS.RENEWABLE_PCT_DEFAULT],
  );

  return getSessionCarbon(sessionId);
}

/**
 * Get carbon footprint for a single session.
 */
async function getSessionCarbon(sessionId) {
  const { rows } = await db.query(
    `SELECT * FROM carbon_footprint_records WHERE session_id = $1`,
    [sessionId],
  );
  if (rows.length === 0) return null;
  return formatCarbonRecord(rows[0]);
}

/**
 * Get carbon footprint summary for a user.
 */
async function getUserCarbonSummary(userId) {
  const { rows: summary } = await db.query(
    `SELECT
       COUNT(*)::int AS total_sessions,
       SUM(energy_kwh)::numeric(10,2) AS total_energy_kwh,
       SUM(gasoline_co2_avoided_kg)::numeric(10,3) AS total_gasoline_co2_avoided_kg,
       SUM(net_carbon_saved_kg)::numeric(10,3) AS total_carbon_saved_kg,
       SUM(trees_equivalent)::numeric(10,2) AS total_trees_equivalent,
       SUM(miles_offset)::numeric(10,2) AS total_miles_offset
     FROM carbon_footprint_records WHERE user_id = $1`,
    [userId],
  );

  // Monthly trend
  const { rows: monthly } = await db.query(
    `SELECT
       DATE_TRUNC('month', created_at)::date AS month,
       SUM(energy_kwh)::numeric(10,2) AS energy_kwh,
       SUM(net_carbon_saved_kg)::numeric(10,3) AS carbon_saved_kg,
       COUNT(*)::int AS sessions
     FROM carbon_footprint_records WHERE user_id = $1
     GROUP BY DATE_TRUNC('month', created_at)
     ORDER BY month DESC LIMIT 12`,
    [userId],
  );

  const s = summary[0] || {};
  return {
    userId,
    totals: {
      sessions: s.total_sessions || 0,
      energyKwh: Number(s.total_energy_kwh || 0),
      gasolineCo2AvoidedKg: Number(s.total_gasoline_co2_avoided_kg || 0),
      carbonSavedKg: Number(s.total_carbon_saved_kg || 0),
      treesEquivalent: Number(s.total_trees_equivalent || 0),
      milesOffset: Number(s.total_miles_offset || 0),
    },
    monthlyTrend: monthly.map((m) => ({
      month: m.month,
      energyKwh: Number(m.energy_kwh),
      carbonSavedKg: Number(m.carbon_saved_kg),
      sessions: m.sessions,
    })),
  };
}

/**
 * Get carbon footprint summary for a station.
 */
async function getStationCarbonSummary(stationId, { startDate, endDate } = {}) {
  const start = startDate || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const end = endDate || new Date().toISOString().split('T')[0];

  const { rows: summary } = await db.query(
    `SELECT
       COUNT(*)::int AS total_sessions,
       SUM(energy_kwh)::numeric(10,2) AS total_energy_kwh,
       SUM(gasoline_co2_avoided_kg)::numeric(10,3) AS total_gasoline_co2_avoided_kg,
       SUM(net_carbon_saved_kg)::numeric(10,3) AS total_carbon_saved_kg,
       SUM(trees_equivalent)::numeric(10,2) AS total_trees_equivalent,
       SUM(miles_offset)::numeric(10,2) AS total_miles_offset,
       AVG(renewable_percentage)::numeric(5,2) AS avg_renewable_pct
     FROM carbon_footprint_records
     WHERE station_id = $1 AND created_at::date BETWEEN $2 AND $3`,
    [stationId, start, end],
  );

  // Daily trend
  const { rows: daily } = await db.query(
    `SELECT
       created_at::date AS day,
       SUM(energy_kwh)::numeric(10,2) AS energy_kwh,
       SUM(net_carbon_saved_kg)::numeric(10,3) AS carbon_saved_kg,
       COUNT(*)::int AS sessions
     FROM carbon_footprint_records
     WHERE station_id = $1 AND created_at::date BETWEEN $2 AND $3
     GROUP BY created_at::date ORDER BY day`,
    [stationId, start, end],
  );

  const s = summary[0] || {};
  return {
    stationId,
    period: { start, end },
    totals: {
      sessions: s.total_sessions || 0,
      energyKwh: Number(s.total_energy_kwh || 0),
      gasolineCo2AvoidedKg: Number(s.total_gasoline_co2_avoided_kg || 0),
      carbonSavedKg: Number(s.total_carbon_saved_kg || 0),
      treesEquivalent: Number(s.total_trees_equivalent || 0),
      milesOffset: Number(s.total_miles_offset || 0),
      avgRenewablePct: Number(s.avg_renewable_pct || 0),
    },
    dailyTrend: daily.map((d) => ({
      day: d.day,
      energyKwh: Number(d.energy_kwh),
      carbonSavedKg: Number(d.carbon_saved_kg),
      sessions: d.sessions,
    })),
  };
}

/**
 * Get platform-wide carbon summary (admin).
 */
async function getPlatformCarbonSummary() {
  const { rows: summary } = await db.query(
    `SELECT
       COUNT(*)::int AS total_sessions,
       SUM(energy_kwh)::numeric(10,2) AS total_energy_kwh,
       SUM(gasoline_co2_avoided_kg)::numeric(10,3) AS total_gasoline_co2_avoided_kg,
       SUM(net_carbon_saved_kg)::numeric(10,3) AS total_carbon_saved_kg,
       SUM(trees_equivalent)::numeric(10,2) AS total_trees_equivalent,
       SUM(miles_offset)::numeric(10,2) AS total_miles_offset,
       COUNT(DISTINCT user_id)::int AS unique_users,
       COUNT(DISTINCT station_id)::int AS unique_stations
     FROM carbon_footprint_records`,
  );

  const s = summary[0] || {};
  return {
    totals: {
      sessions: s.total_sessions || 0,
      energyKwh: Number(s.total_energy_kwh || 0),
      gasolineCo2AvoidedKg: Number(s.total_gasoline_co2_avoided_kg || 0),
      carbonSavedKg: Number(s.total_carbon_saved_kg || 0),
      treesEquivalent: Number(s.total_trees_equivalent || 0),
      milesOffset: Number(s.total_miles_offset || 0),
      uniqueUsers: s.unique_users || 0,
      uniqueStations: s.unique_stations || 0,
    },
  };
}

function formatCarbonRecord(r) {
  return {
    id: r.id,
    sessionId: r.session_id,
    userId: r.user_id,
    stationId: r.station_id,
    energyKwh: Number(r.energy_kwh),
    gridCarbonIntensity: Number(r.grid_carbon_intensity_gco2_kwh),
    gasolineCo2AvoidedKg: Number(r.gasoline_co2_avoided_kg),
    netCarbonSavedKg: Number(r.net_carbon_saved_kg),
    treesEquivalent: Number(r.trees_equivalent),
    milesOffset: Number(r.miles_offset),
    renewablePercentage: Number(r.renewable_percentage),
    createdAt: r.created_at,
  };
}

module.exports = {
  recordSessionCarbon,
  getSessionCarbon,
  getUserCarbonSummary,
  getStationCarbonSummary,
  getPlatformCarbonSummary,
};

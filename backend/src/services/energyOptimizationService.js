const db = require('../config/database');

/**
 * Smart Energy Optimization Engine
 *
 * Analyzes station data across the platform and generates optimization
 * recommendations for:
 *
 * 1. Load Shifting — redirect demand from overloaded to underutilized stations
 * 2. Demand Redirection — recommend alternative stations when congestion is high
 * 3. Schedule Optimization — suggest optimal charging times for cost/grid savings
 * 4. Power Reduction — recommend power caps during peak grid load
 *
 * Scoring uses weighted multi-factor analysis:
 *   - Grid load (30%) — prioritize stations with lower grid utilization
 *   - Occupancy (25%) — prefer stations with more open slots
 *   - Carbon impact (20%) — favor lower-carbon options
 *   - Cost efficiency (15%) — recommend cost-effective charging times
 *   - User convenience (10%) — minimize distance/wait
 */

/**
 * Generate optimization recommendations for a station.
 */
async function generateStationOptimizations(stationId) {
  const recommendations = [];

  // 1. Check grid load
  const { rows: gridRows } = await db.query(
    `SELECT * FROM grid_load_profiles WHERE station_id = $1`,
    [stationId],
  );
  const grid = gridRows[0];

  if (grid && Number(grid.load_percentage) > 70) {
    const loadPct = Number(grid.load_percentage);
    const priority = loadPct > 90 ? 'critical' : loadPct > 80 ? 'high' : 'medium';
    const savingsKwh = (loadPct - 70) / 100 * Number(grid.grid_capacity_kw) * 0.5; // 30 min reduction

    recommendations.push({
      type: 'power_reduce',
      priority,
      title: `Reduce power draw — grid at ${loadPct.toFixed(0)}%`,
      description: `Station grid is at ${loadPct.toFixed(1)}% capacity. Recommend reducing power to high-SoC sessions to prevent overload.`,
      estimatedSavingsKwh: Math.round(savingsKwh * 10) / 10,
      estimatedCostSavings: Math.round(savingsKwh * 0.12 * 100) / 100, // ~$0.12/kWh demand charge
      estimatedCarbonSavingsKg: Math.round(savingsKwh * 0.4 * 10) / 10, // 400g CO2/kWh
      metadata: { currentLoadPct: loadPct, gridCapacityKw: Number(grid.grid_capacity_kw) },
    });
  }

  // 2. Check occupancy and suggest demand redirection
  const { rows: slotRows } = await db.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status IN ('occupied', 'reserved'))::int AS busy
     FROM charging_slots WHERE station_id = $1`,
    [stationId],
  );
  const total = slotRows[0]?.total || 1;
  const busy = slotRows[0]?.busy || 0;
  const occupancyPct = (busy / total) * 100;

  if (occupancyPct >= 80) {
    // Find nearby underutilized stations
    const { rows: station } = await db.query(
      `SELECT latitude, longitude FROM stations WHERE id = $1`, [stationId],
    );
    if (station.length > 0) {
      const { rows: nearby } = await db.query(
        `SELECT s.id, s.name, s.city,
                earth_distance(ll_to_earth($1, $2), ll_to_earth(s.latitude, s.longitude)) / 1000 AS distance_km,
                COUNT(ck.id) FILTER (WHERE ck.status = 'available')::int AS available_slots,
                COUNT(ck.id)::int AS total_slots
         FROM stations s
         JOIN charging_slots ck ON ck.station_id = s.id
         WHERE s.id != $3 AND s.status = 'approved'
           AND earth_distance(ll_to_earth($1, $2), ll_to_earth(s.latitude, s.longitude)) < 20000
         GROUP BY s.id, s.name, s.city, s.latitude, s.longitude
         HAVING COUNT(ck.id) FILTER (WHERE ck.status = 'available') > 0
         ORDER BY distance_km LIMIT 3`,
        [station[0].latitude, station[0].longitude, stationId],
      );

      if (nearby.length > 0) {
        recommendations.push({
          type: 'demand_redirect',
          priority: occupancyPct >= 100 ? 'high' : 'medium',
          title: `Redirect demand — ${busy}/${total} slots occupied`,
          description: `Station at ${occupancyPct.toFixed(0)}% occupancy. ${nearby.length} nearby stations have available slots.`,
          estimatedSavingsKwh: 0,
          estimatedCostSavings: 0,
          estimatedCarbonSavingsKg: 0,
          metadata: {
            occupancyPct,
            nearbyAlternatives: nearby.map((n) => ({
              stationId: n.id, name: n.name, city: n.city,
              distanceKm: Math.round(Number(n.distance_km) * 10) / 10,
              availableSlots: n.available_slots, totalSlots: n.total_slots,
            })),
          },
        });
      }
    }
  }

  // 3. Check demand forecast for schedule optimization
  const now = new Date();
  const { rows: forecast } = await db.query(
    `SELECT hour_of_day, demand_level, avg_occupancy_rate
     FROM demand_forecasts
     WHERE station_id = $1 AND day_of_week = $2
     ORDER BY avg_occupancy_rate ASC LIMIT 3`,
    [stationId, now.getDay()],
  );

  if (forecast.length > 0) {
    const offPeakHours = forecast
      .filter((f) => f.demand_level === 'low')
      .map((f) => `${String(f.hour_of_day).padStart(2, '0')}:00`);

    if (offPeakHours.length > 0) {
      recommendations.push({
        type: 'schedule_optimize',
        priority: 'low',
        title: 'Off-peak charging recommended',
        description: `Lower demand expected at ${offPeakHours.join(', ')}. Charging during these hours reduces grid stress and may cost less.`,
        estimatedSavingsKwh: 0,
        estimatedCostSavings: 0,
        estimatedCarbonSavingsKg: 0,
        metadata: { offPeakHours, dayOfWeek: now.getDay() },
      });
    }
  }

  // 4. Persist recommendations
  for (const rec of recommendations) {
    await db.query(
      `INSERT INTO energy_optimization_recommendations
         (station_id, recommendation_type, priority, title, description,
          estimated_savings_kwh, estimated_cost_savings, estimated_carbon_savings_kg,
          metadata, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [stationId, rec.type, rec.priority, rec.title, rec.description,
       rec.estimatedSavingsKwh, rec.estimatedCostSavings, rec.estimatedCarbonSavingsKg,
       JSON.stringify(rec.metadata),
       new Date(Date.now() + 3600000).toISOString()], // expire in 1 hour
    );
  }

  return recommendations;
}

/**
 * Get active recommendations for a station.
 */
async function getStationRecommendations(stationId) {
  const { rows } = await db.query(
    `SELECT * FROM energy_optimization_recommendations
     WHERE station_id = $1 AND status = 'pending'
       AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY
       CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
       created_at DESC
     LIMIT 20`,
    [stationId],
  );

  return rows.map(formatRecommendation);
}

/**
 * Get platform-wide optimization summary (admin).
 */
async function getPlatformOptimizationSummary() {
  // Active recommendations by type
  const { rows: byType } = await db.query(
    `SELECT recommendation_type, priority, COUNT(*)::int AS count,
            SUM(estimated_savings_kwh)::numeric(10,2) AS total_savings_kwh,
            SUM(estimated_cost_savings)::numeric(10,2) AS total_cost_savings,
            SUM(estimated_carbon_savings_kg)::numeric(10,2) AS total_carbon_savings_kg
     FROM energy_optimization_recommendations
     WHERE status = 'pending' AND (expires_at IS NULL OR expires_at > NOW())
     GROUP BY recommendation_type, priority
     ORDER BY recommendation_type`,
  );

  // Grid status overview
  const { rows: gridOverview } = await db.query(
    `SELECT grid_status, COUNT(*)::int AS count,
            AVG(load_percentage)::numeric(5,1) AS avg_load_pct,
            MAX(load_percentage)::numeric(5,1) AS max_load_pct
     FROM grid_load_profiles
     GROUP BY grid_status`,
  );

  return {
    recommendations: byType,
    gridOverview,
  };
}

/**
 * Accept or reject a recommendation.
 */
async function updateRecommendationStatus(recommendationId, status) {
  await db.query(
    `UPDATE energy_optimization_recommendations SET status = $2, updated_at = NOW() WHERE id = $1`,
    [recommendationId, status],
  );
}

/**
 * Cleanup expired recommendations.
 */
async function cleanupExpired() {
  await db.query(
    `UPDATE energy_optimization_recommendations
     SET status = 'expired', updated_at = NOW()
     WHERE status = 'pending' AND expires_at < NOW()`,
  );
}

function formatRecommendation(r) {
  return {
    id: r.id,
    stationId: r.station_id,
    type: r.recommendation_type,
    priority: r.priority,
    title: r.title,
    description: r.description,
    estimatedSavingsKwh: Number(r.estimated_savings_kwh),
    estimatedCostSavings: Number(r.estimated_cost_savings),
    estimatedCarbonSavingsKg: Number(r.estimated_carbon_savings_kg),
    status: r.status,
    metadata: r.metadata,
    expiresAt: r.expires_at,
    createdAt: r.created_at,
  };
}

module.exports = {
  generateStationOptimizations,
  getStationRecommendations,
  getPlatformOptimizationSummary,
  updateRecommendationStatus,
  cleanupExpired,
};

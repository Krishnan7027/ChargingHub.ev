const db = require('../config/database');

/**
 * Analyze heatmap demand + existing stations to find coverage gaps
 * and recommend new station locations.
 */
async function generateRecommendations({ city, minGapScore = 30 } = {}) {
  // Step 1: Find high-demand / underserved grid cells
  let cellSQL = `
    SELECT * FROM charging_heatmap_cells
    WHERE infrastructure_gap_score >= $1
  `;
  const cellParams = [minGapScore];
  if (city) {
    // Filter cells by proximity to stations in the given city
    cellSQL += `
      AND EXISTS (
        SELECT 1 FROM stations s
        WHERE s.city = $2 AND s.status = 'approved'
          AND ABS(s.latitude - grid_lat) < 0.05
          AND ABS(s.longitude - grid_lng) < 0.05
      )
    `;
    cellParams.push(city);
  }
  cellSQL += ` ORDER BY infrastructure_gap_score DESC, demand_intensity DESC LIMIT 50`;

  const { rows: gapCells } = await db.query(cellSQL, cellParams);

  if (gapCells.length === 0) {
    return { recommendations: [], message: 'No significant infrastructure gaps found' };
  }

  const recommendations = [];

  for (const cell of gapCells) {
    const lat = Number(cell.grid_lat);
    const lng = Number(cell.grid_lng);

    // Find nearest existing station
    const nearestRes = await db.query(`
      SELECT
        id, name, city,
        earth_distance(ll_to_earth($1, $2), ll_to_earth(latitude, longitude)) / 1000.0 AS distance_km
      FROM stations
      WHERE status = 'approved'
      ORDER BY earth_distance(ll_to_earth($1, $2), ll_to_earth(latitude, longitude))
      LIMIT 1
    `, [lat, lng]);

    const nearest = nearestRes.rows[0];
    const nearestKm = nearest ? Number(nearest.distance_km) : null;
    const resolvedCity = nearest?.city || city || 'Unknown';

    // Scoring
    const demandScore = Math.min(Number(cell.demand_intensity) * 10, 100);
    const coverageGapScore = Number(cell.infrastructure_gap_score);
    // Traffic proxy: sessions density
    const trafficScore = Math.min(Number(cell.total_sessions) * 2, 100);

    // Weighted overall score
    const overallScore = Math.round(
      demandScore * 0.4 +
      coverageGapScore * 0.35 +
      trafficScore * 0.25
    );

    // Determine recommended charger types and slot count
    const avgDuration = Number(cell.avg_session_duration_min || 30);
    const recommendedTypes = avgDuration < 30
      ? ['dc_fast', 'level2']
      : avgDuration < 60
        ? ['level2', 'dc_fast']
        : ['level2', 'level1'];

    const slotsNeeded = Math.max(4, Math.ceil(Number(cell.total_sessions) / 10));
    const estimatedDaily = Math.round(Number(cell.total_sessions) / 7); // rough weekly->daily

    // Build area description
    const areaDesc = nearestKm
      ? `${nearestKm.toFixed(1)} km from nearest station (${nearest.name}). ` +
        `Grid cell shows ${cell.total_sessions} sessions with ${cell.avg_occupancy_pct}% avg occupancy.`
      : `New coverage area with ${cell.total_sessions} sessions.`;

    // Population density proxy from unique users
    const popDensityScore = Math.min(Number(cell.unique_users) * 5, 100);

    const reason = buildReason({
      demandScore, coverageGapScore, trafficScore, nearestKm, avgDuration,
      totalSessions: Number(cell.total_sessions), occupancy: Number(cell.avg_occupancy_pct),
    });

    recommendations.push({
      latitude: lat,
      longitude: lng,
      city: resolvedCity,
      areaDescription: areaDesc,
      overallScore,
      demandScore: Math.round(demandScore),
      coverageGapScore: Math.round(coverageGapScore),
      trafficScore: Math.round(trafficScore),
      recommendedSlots: slotsNeeded,
      recommendedChargerTypes: recommendedTypes,
      estimatedDailySessions: estimatedDaily,
      nearestStationKm: nearestKm ? Number(nearestKm.toFixed(2)) : null,
      avgDemandInArea: Number(cell.demand_intensity),
      populationDensityScore: popDensityScore,
      reason,
    });
  }

  // Sort by overall score descending
  recommendations.sort((a, b) => b.overallScore - a.overallScore);

  // Persist top recommendations
  const persisted = [];
  for (const rec of recommendations.slice(0, 20)) {
    const res = await db.query(`
      INSERT INTO infrastructure_recommendations (
        latitude, longitude, city, area_description,
        overall_score, demand_score, coverage_gap_score, traffic_score,
        recommended_slots, recommended_charger_types, estimated_daily_sessions,
        nearest_station_km, avg_demand_in_area, population_density_score, reason
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      RETURNING *
    `, [
      rec.latitude, rec.longitude, rec.city, rec.areaDescription,
      rec.overallScore, rec.demandScore, rec.coverageGapScore, rec.trafficScore,
      rec.recommendedSlots, rec.recommendedChargerTypes, rec.estimatedDailySessions,
      rec.nearestStationKm, rec.avgDemandInArea, rec.populationDensityScore, rec.reason,
    ]);
    persisted.push(res.rows[0]);
  }

  return { recommendations: persisted, totalGapCells: gapCells.length };
}

/**
 * Get existing recommendations, optionally filtered.
 */
async function getRecommendations({ city, status, minScore, limit = 20 } = {}) {
  let sql = `SELECT * FROM infrastructure_recommendations WHERE 1=1`;
  const params = [];
  let idx = 1;

  if (city) { sql += ` AND city = $${idx++}`; params.push(city); }
  if (status) { sql += ` AND status = $${idx++}`; params.push(status); }
  if (minScore) { sql += ` AND overall_score >= $${idx++}`; params.push(minScore); }

  sql += ` ORDER BY overall_score DESC LIMIT $${idx++}`;
  params.push(limit);

  const { rows } = await db.query(sql, params);
  return rows;
}

/**
 * Update recommendation status.
 */
async function updateRecommendationStatus(recId, status) {
  const validStatuses = ['proposed', 'approved', 'rejected', 'built'];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
  }

  const { rows } = await db.query(`
    UPDATE infrastructure_recommendations
    SET status = $2, updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [recId, status]);

  if (rows.length === 0) throw new Error('Recommendation not found');
  return rows[0];
}

/**
 * Get infrastructure planning summary for a city.
 */
async function getCitySummary(city) {
  const [recsRes, stationsRes, heatmapRes] = await Promise.all([
    db.query(`
      SELECT status, COUNT(*) AS count, AVG(overall_score) AS avg_score
      FROM infrastructure_recommendations
      WHERE city = $1
      GROUP BY status
    `, [city]),
    db.query(`
      SELECT COUNT(*) AS total_stations,
        SUM((SELECT COUNT(*) FROM charging_slots WHERE station_id = s.id)) AS total_slots
      FROM stations s WHERE city = $1 AND status = 'approved'
    `, [city]),
    db.query(`
      SELECT
        AVG(demand_intensity) AS avg_demand,
        AVG(infrastructure_gap_score) AS avg_gap_score,
        SUM(total_sessions) AS total_sessions
      FROM charging_heatmap_cells hc
      WHERE EXISTS (
        SELECT 1 FROM stations s
        WHERE s.city = $1 AND s.status = 'approved'
          AND ABS(s.latitude - hc.grid_lat) < 0.05
          AND ABS(s.longitude - hc.grid_lng) < 0.05
      )
    `, [city]),
  ]);

  return {
    city,
    recommendations: recsRes.rows,
    infrastructure: stationsRes.rows[0],
    demand: heatmapRes.rows[0],
  };
}

// ── Helpers ───────────────────────────────────────────────────────

function buildReason({ demandScore, coverageGapScore, trafficScore, nearestKm, avgDuration, totalSessions, occupancy }) {
  const parts = [];

  if (coverageGapScore > 70) {
    parts.push('Significant infrastructure gap detected');
  } else if (coverageGapScore > 40) {
    parts.push('Moderate infrastructure gap');
  }

  if (demandScore > 70) {
    parts.push(`high charging demand (${totalSessions} sessions)`);
  }

  if (nearestKm && nearestKm > 5) {
    parts.push(`nearest station is ${nearestKm.toFixed(1)} km away`);
  }

  if (occupancy > 80) {
    parts.push(`nearby stations at ${occupancy.toFixed(0)}% occupancy`);
  }

  if (avgDuration > 60) {
    parts.push('users need longer charging sessions — Level 2 recommended');
  } else if (avgDuration < 25) {
    parts.push('fast turnaround area — DC fast chargers recommended');
  }

  return parts.length > 0
    ? parts.join('; ') + '.'
    : 'Area shows moderate demand with room for infrastructure growth.';
}

module.exports = {
  generateRecommendations,
  getRecommendations,
  updateRecommendationStatus,
  getCitySummary,
};

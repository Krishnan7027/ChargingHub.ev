const db = require('../config/database');
const { getReliabilityScoresForStations } = require('./communityReviewService');

/**
 * Smart Station Recommendation Engine
 *
 * Scores stations using a weighted multi-factor model:
 *  - Distance (25 %)      → closer is better
 *  - Availability (22 %)  → more open slots is better
 *  - Charging Speed (18 %) → faster max charger is better
 *  - Wait Time (13 %)     → based on current sessions + predictions
 *  - Rating (10 %)        → higher is better
 *  - Reliability (12 %)   → community reliability score (0-100%)
 *
 * Returns a ranked list with a composite score and a human-friendly
 * recommendation label.
 */
async function getRecommendations({
  latitude,
  longitude,
  radiusKm = 25,
  chargingType = null,
  connectorType = null,
  limit = 10,
}) {
  let typeFilter = '';
  const params = [latitude, longitude, radiusKm * 1000];
  let idx = 4;

  if (chargingType) {
    typeFilter += ` AND EXISTS (
      SELECT 1 FROM charging_slots cs2
      WHERE cs2.station_id = s.id AND cs2.charging_type = $${idx}
    )`;
    params.push(chargingType);
    idx++;
  }
  if (connectorType) {
    typeFilter += ` AND EXISTS (
      SELECT 1 FROM charging_slots cs2
      WHERE cs2.station_id = s.id AND cs2.connector_type = $${idx}
    )`;
    params.push(connectorType);
    idx++;
  }

  params.push(limit);

  const { rows: stations } = await db.query(
    `SELECT
       s.id, s.name, s.address, s.city, s.latitude, s.longitude,
       s.rating, s.total_reviews, s.pricing_per_kwh, s.amenities,
       s.operating_hours,
       COUNT(cs.id)                                    AS total_slots,
       COUNT(cs.id) FILTER (WHERE cs.status = 'available') AS available_slots,
       MAX(cs.power_output_kw)                         AS max_power_kw,
       AVG(cs.power_output_kw)                         AS avg_power_kw,
       earth_distance(
         ll_to_earth($1, $2),
         ll_to_earth(s.latitude, s.longitude)
       ) AS distance_m
     FROM stations s
     LEFT JOIN charging_slots cs ON cs.station_id = s.id
     WHERE s.status = 'approved'
       AND earth_distance(
             ll_to_earth($1, $2),
             ll_to_earth(s.latitude, s.longitude)
           ) < $3
       ${typeFilter}
     GROUP BY s.id
     ORDER BY distance_m ASC
     LIMIT $${idx}`,
    params,
  );

  if (stations.length === 0) return { recommendations: [], message: 'No stations found in this area' };

  // Fetch reliability scores for all candidate stations
  const stationIds = stations.map((s) => s.id);
  const reliabilityMap = await getReliabilityScoresForStations(stationIds);

  // Fetch wait-time estimates from active sessions
  const { rows: activeSessions } = await db.query(
    `SELECT ck.station_id,
            AVG(
              CASE WHEN cs.target_percentage > cs.current_percentage
              THEN CEIL(
                ((cs.target_percentage - cs.current_percentage) / 100.0 * 60)
                / (GREATEST(COALESCE(cs.average_power_kw, ck.power_output_kw), 1) * 0.85)
                * 60
              )
              ELSE 0 END
            )::int AS avg_remaining_min,
            COUNT(*)::int AS active_count
     FROM charging_sessions cs
     JOIN charging_slots ck ON ck.id = cs.slot_id
     WHERE ck.station_id = ANY($1) AND cs.status = 'charging'
     GROUP BY ck.station_id`,
    [stationIds],
  );
  const waitMap = Object.fromEntries(
    activeSessions.map((a) => [a.station_id, { avgMin: a.avg_remaining_min, count: a.active_count }]),
  );

  // ── Score each station ──────────────────────────────────
  const maxDistance = Math.max(...stations.map((s) => Number(s.distance_m)), 1);
  const maxPower = Math.max(...stations.map((s) => Number(s.max_power_kw) || 7), 1);

  const scored = stations.map((s) => {
    const distKm = Number(s.distance_m) / 1000;
    const available = Number(s.available_slots);
    const total = Number(s.total_slots) || 1;
    const maxPw = Number(s.max_power_kw) || 7;
    const rating = Number(s.rating) || 3;

    const waitInfo = waitMap[s.id];
    const estimatedWaitMin = available > 0 ? 0 : (waitInfo?.avgMin || 15);

    // Community reliability data
    const reliability = reliabilityMap[s.id];
    const reliabilityPct = reliability ? reliability.reliabilityScore : 50; // default 50% if no reviews

    // Normalised scores (0–1, higher = better)
    const distScore = 1 - Number(s.distance_m) / maxDistance;
    const availScore = available / total;
    const speedScore = maxPw / maxPower;
    const waitScore = 1 / (1 + estimatedWaitMin / 20);
    const ratingScore = rating / 5;
    const reliabilityScore = reliabilityPct / 100;

    const compositeScore =
      distScore * 0.25 +
      availScore * 0.22 +
      speedScore * 0.18 +
      waitScore * 0.13 +
      ratingScore * 0.10 +
      reliabilityScore * 0.12;

    // Speed label
    let speedLabel;
    if (maxPw >= 100) speedLabel = 'Ultra Fast';
    else if (maxPw >= 50) speedLabel = 'Fast';
    else if (maxPw >= 7) speedLabel = 'Standard';
    else speedLabel = 'Slow';

    // Recommendation label
    let label;
    if (compositeScore > 0.75) label = 'Highly Recommended';
    else if (compositeScore > 0.50) label = 'Good Option';
    else label = 'Available';

    return {
      stationId: s.id,
      name: s.name,
      address: s.address,
      city: s.city,
      latitude: Number(s.latitude),
      longitude: Number(s.longitude),
      distanceKm: Math.round(distKm * 10) / 10,
      availableSlots: available,
      totalSlots: total,
      maxPowerKw: maxPw,
      avgPowerKw: Math.round(Number(s.avg_power_kw) || 7),
      speedLabel,
      rating: Math.round(rating * 10) / 10,
      totalReviews: Number(s.total_reviews),
      pricingPerKwh: Number(s.pricing_per_kwh) || null,
      estimatedWaitMin,
      amenities: s.amenities || [],
      operatingHours: s.operating_hours,
      score: Math.round(compositeScore * 100) / 100,
      label,
      reliabilityPct: Math.round(reliabilityPct),
      communityReviews: reliability?.totalReviews || 0,
      scoreBreakdown: {
        distance: Math.round(distScore * 100),
        availability: Math.round(availScore * 100),
        speed: Math.round(speedScore * 100),
        waitTime: Math.round(waitScore * 100),
        rating: Math.round(ratingScore * 100),
        reliability: Math.round(reliabilityScore * 100),
      },
    };
  });

  scored.sort((a, b) => b.score - a.score);

  return {
    recommendations: scored,
    topPick: scored[0] || null,
    message: scored[0]
      ? `We recommend ${scored[0].name} — ${scored[0].distanceKm} km away, ` +
        `${scored[0].estimatedWaitMin === 0 ? 'no wait' : `~${scored[0].estimatedWaitMin} min wait`}, ` +
        `${scored[0].speedLabel} charging`
      : 'No recommendations available',
  };
}

module.exports = { getRecommendations };

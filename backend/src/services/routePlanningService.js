const db = require('../config/database');

// ── Haversine distance (km) ────────────────────────────────
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Interpolate point along a straight line ────────────────
function interpolate(lat1, lon1, lat2, lon2, fraction) {
  return {
    lat: lat1 + (lat2 - lat1) * fraction,
    lng: lon1 + (lon2 - lon1) * fraction,
  };
}

// ── Estimate charging time (minutes) to gain a given kWh ───
function estimateChargingMinutes(energyKwh, powerKw, startPct) {
  // Charging curve: slower above 80 %
  const efficiency = startPct > 80 ? 0.5 : 0.85;
  const effectivePower = powerKw * efficiency;
  if (effectivePower <= 0) return 60; // fallback 1 hour
  return Math.ceil((energyKwh / effectivePower) * 60);
}

/**
 * Plan a route with optimal charging stops.
 *
 * Algorithm (greedy with look‑ahead):
 * 1. Compute straight‑line trip distance.
 * 2. Determine effective range from battery % and vehicle range.
 * 3. Walk along the route; when remaining range drops below a safety
 *    buffer, search for nearby approved stations with available slots.
 * 4. Score candidate stations (distance penalty, wait time, speed,
 *    availability) and pick the best.
 * 5. "Charge" at the stop to 80 % (optimal fast‑charge target),
 *    then continue.
 */
async function planRoute({
  startLat, startLng,
  endLat, endLng,
  batteryPercentage,
  vehicleRangeKm,
  vehicleBatteryCapacityKwh = 60,
}) {
  const totalDistanceKm = haversineKm(startLat, startLng, endLat, endLng);
  let currentRangeKm = (batteryPercentage / 100) * vehicleRangeKm;
  const safetyBuffer = vehicleRangeKm * 0.15; // keep 15 % reserve
  const chargeTargetPct = 80;

  const stops = [];
  let currentLat = startLat;
  let currentLng = startLng;
  let distanceCovered = 0;

  // Keep planning stops until we can reach the destination
  while (currentRangeKm - safetyBuffer < totalDistanceKm - distanceCovered) {
    // The furthest we dare go before charging
    const maxReach = currentRangeKm - safetyBuffer;
    // Point along the route where we'd run low
    const reachFraction = (distanceCovered + maxReach) / totalDistanceKm;
    const searchPoint = interpolate(
      startLat, startLng, endLat, endLng,
      Math.min(reachFraction, 0.99),
    );

    // Find approved stations within 30 km of that point
    const { rows: candidates } = await db.query(
      `SELECT s.id, s.name, s.address, s.city, s.latitude, s.longitude,
              s.rating, s.pricing_per_kwh,
              COUNT(cs.id) FILTER (WHERE cs.status = 'available') AS available_slots,
              COUNT(cs.id) AS total_slots,
              MAX(cs.power_output_kw) AS max_power_kw,
              earth_distance(
                ll_to_earth($1, $2),
                ll_to_earth(s.latitude, s.longitude)
              ) / 1000 AS distance_km
       FROM stations s
       LEFT JOIN charging_slots cs ON cs.station_id = s.id
       WHERE s.status = 'approved'
         AND earth_distance(
               ll_to_earth($1, $2),
               ll_to_earth(s.latitude, s.longitude)
             ) / 1000 < 30
       GROUP BY s.id
       ORDER BY distance_km ASC
       LIMIT 10`,
      [searchPoint.lat, searchPoint.lng],
    );

    if (candidates.length === 0) {
      // No station found – expand radius
      break;
    }

    // ── Score each candidate ──────────────────────────────
    const scored = candidates.map((c) => {
      const distScore = 1 / (1 + Number(c.distance_km));           // closer is better
      const availScore = Number(c.available_slots) / Math.max(Number(c.total_slots), 1);
      const speedScore = Math.min(Number(c.max_power_kw || 7) / 150, 1); // normalise to 150 kW
      const ratingScore = Number(c.rating || 3) / 5;

      // Estimate wait if no slots available
      const estimatedWaitMin = Number(c.available_slots) > 0 ? 0 : 10;
      const waitPenalty = 1 / (1 + estimatedWaitMin / 30);

      const score =
        distScore * 0.30 +
        availScore * 0.25 +
        speedScore * 0.20 +
        ratingScore * 0.10 +
        waitPenalty * 0.15;

      return { ...c, score, estimatedWaitMin };
    });

    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];

    // Distance from current position to the chosen station
    const legDistance = haversineKm(currentLat, currentLng, best.latitude, best.longitude);

    // Energy consumed on this leg
    const energyPerKm = vehicleBatteryCapacityKwh / vehicleRangeKm;
    const energyConsumed = legDistance * energyPerKm;
    const arrivalPct = Math.max(batteryPercentage - (energyConsumed / vehicleBatteryCapacityKwh) * 100, 5);

    // Charge to 80 %
    const energyToCharge = ((chargeTargetPct - arrivalPct) / 100) * vehicleBatteryCapacityKwh;
    const chargingTimeMin = estimateChargingMinutes(
      energyToCharge,
      Number(best.max_power_kw) || 50,
      arrivalPct,
    );

    stops.push({
      stopNumber: stops.length + 1,
      stationId: best.id,
      stationName: best.name,
      address: best.address,
      city: best.city,
      latitude: Number(best.latitude),
      longitude: Number(best.longitude),
      distanceFromPrevKm: Math.round(legDistance * 10) / 10,
      arrivalBatteryPct: Math.round(arrivalPct),
      departureBatteryPct: chargeTargetPct,
      estimatedChargingMin: chargingTimeMin,
      estimatedWaitMin: best.estimatedWaitMin,
      chargingSpeedKw: Number(best.max_power_kw) || 50,
      availableSlots: Number(best.available_slots),
      totalSlots: Number(best.total_slots),
      rating: Number(best.rating) || 0,
      pricingPerKwh: Number(best.pricing_per_kwh) || 0,
      estimatedCost: Math.round(energyToCharge * (Number(best.pricing_per_kwh) || 0.3) * 100) / 100,
    });

    // Update state after charging
    distanceCovered += legDistance;
    currentLat = Number(best.latitude);
    currentLng = Number(best.longitude);
    currentRangeKm = (chargeTargetPct / 100) * vehicleRangeKm;
    batteryPercentage = chargeTargetPct;

    // Safety: prevent infinite loops
    if (stops.length >= 20) break;
  }

  const remainingDistance = haversineKm(currentLat, currentLng, endLat, endLng);

  return {
    totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
    totalStops: stops.length,
    estimatedTotalChargingMin: stops.reduce((s, st) => s + st.estimatedChargingMin + st.estimatedWaitMin, 0),
    estimatedTotalCost: Math.round(stops.reduce((s, st) => s + st.estimatedCost, 0) * 100) / 100,
    arrivalBatteryPct: Math.round(
      batteryPercentage - (remainingDistance / vehicleRangeKm) * 100,
    ),
    stops,
    route: {
      start: { lat: startLat, lng: startLng },
      end: { lat: endLat, lng: endLng },
      waypoints: stops.map((s) => ({ lat: s.latitude, lng: s.longitude })),
    },
  };
}

/**
 * Save a route plan for a user.
 */
async function saveRoutePlan(userId, plan) {
  const { rows } = await db.query(
    `INSERT INTO route_plans
       (user_id, name, start_location, end_location, vehicle_range_km,
        battery_percentage, total_distance_km, charging_stops)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      userId,
      plan.name || 'Untitled Route',
      JSON.stringify(plan.route.start),
      JSON.stringify(plan.route.end),
      plan.vehicleRangeKm,
      plan.batteryPercentage,
      plan.totalDistanceKm,
      JSON.stringify(plan.stops),
    ],
  );
  return rows[0];
}

async function getUserRoutePlans(userId) {
  const { rows } = await db.query(
    `SELECT * FROM route_plans WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
    [userId],
  );
  return rows;
}

module.exports = { planRoute, saveRoutePlan, getUserRoutePlans, haversineKm };

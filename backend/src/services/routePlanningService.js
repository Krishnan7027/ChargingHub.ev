'use strict';

const db = require('../config/database');
const routing = require('./routingService');

// ── Estimate charging time (minutes) to gain a given kWh ───
function estimateChargingMinutes(energyKwh, powerKw, startPct) {
  const efficiency = startPct > 80 ? 0.5 : 0.85;
  const effectivePower = powerKw * efficiency;
  if (effectivePower <= 0) return 60;
  return Math.ceil((energyKwh / effectivePower) * 60);
}

/**
 * Find candidate charging stations along a route corridor.
 *
 * Searches for approved stations within `corridorKm` of any sample point
 * along the route polyline, then deduplicates and ranks by distance along route.
 */
async function findStationsAlongCorridor(polylinePoints, corridorKm = 15) {
  const samples = routing.sampleAlongRoute(polylinePoints, 20);
  if (samples.length === 0) return [];

  // Build a single query that unions corridor searches at each sample point
  // For efficiency, use a bounding box first then earth_distance for precision
  const allStationIds = new Set();
  const allStations = [];

  for (const sample of samples) {
    const { rows } = await db.query(
      `SELECT s.id, s.name, s.address, s.city, s.latitude, s.longitude,
              s.rating, s.pricing_per_kwh,
              COUNT(cs.id) FILTER (WHERE cs.status = 'available') AS available_slots,
              COUNT(cs.id) AS total_slots,
              MAX(cs.power_output_kw) AS max_power_kw,
              earth_distance(
                ll_to_earth($1, $2),
                ll_to_earth(s.latitude, s.longitude)
              ) / 1000 AS distance_from_route_km
       FROM stations s
       LEFT JOIN charging_slots cs ON cs.station_id = s.id
       WHERE s.status = 'approved'
         AND earth_distance(
               ll_to_earth($1, $2),
               ll_to_earth(s.latitude, s.longitude)
             ) / 1000 < $3
       GROUP BY s.id
       ORDER BY distance_from_route_km ASC
       LIMIT 5`,
      [sample.lat, sample.lng, corridorKm],
    );

    for (const row of rows) {
      if (!allStationIds.has(row.id)) {
        allStationIds.add(row.id);
        // Calculate position along route
        const { distFromRoute, distAlongRouteKm } = routing.distanceAlongRoute(
          polylinePoints, Number(row.latitude), Number(row.longitude),
        );
        allStations.push({
          ...row,
          distFromRouteKm: Math.round(distFromRoute * 10) / 10,
          distAlongRouteKm: Math.round(distAlongRouteKm * 10) / 10,
        });
      }
    }
  }

  // Sort by position along route
  allStations.sort((a, b) => a.distAlongRouteKm - b.distAlongRouteKm);
  return allStations;
}

/**
 * Score a candidate station for charging stop selection.
 */
function scoreStation(station, distancePenalty = 0) {
  const distScore = 1 / (1 + station.distFromRouteKm + distancePenalty);
  const availScore = Number(station.available_slots) / Math.max(Number(station.total_slots), 1);
  const speedScore = Math.min(Number(station.max_power_kw || 7) / 150, 1);
  const ratingScore = Number(station.rating || 3) / 5;
  const estimatedWaitMin = Number(station.available_slots) > 0 ? 0 : 10;
  const waitPenalty = 1 / (1 + estimatedWaitMin / 30);

  return {
    score: distScore * 0.25 + availScore * 0.25 + speedScore * 0.25 + ratingScore * 0.10 + waitPenalty * 0.15,
    estimatedWaitMin,
  };
}

/**
 * Plan a route with optimal charging stops using real road routing.
 *
 * Algorithm:
 * 1. Get real road route from OSRM (or fallback)
 * 2. Find all candidate stations along the route corridor
 * 3. Walk along the route; when range drops below safety buffer,
 *    pick the best station near current position along the route
 * 4. Re-route through charging stops for accurate polyline
 */
async function planRoute({
  startLat, startLng,
  endLat, endLng,
  batteryPercentage,
  vehicleRangeKm,
  vehicleBatteryCapacityKwh = 60,
}) {
  // Step 1: Get the real road route (origin → destination)
  const initialRoute = await routing.getSimpleRoute(
    { lat: startLat, lng: startLng },
    { lat: endLat, lng: endLng },
  );

  const totalDistanceKm = initialRoute.distanceKm;
  const totalDurationMin = initialRoute.durationMin;
  const energyPerKm = vehicleBatteryCapacityKwh / vehicleRangeKm;
  const safetyBuffer = vehicleRangeKm * 0.15;
  const chargeTargetPct = 80;

  // Check if we can make it without stopping
  const currentRangeKm = (batteryPercentage / 100) * vehicleRangeKm;
  if (currentRangeKm - safetyBuffer >= totalDistanceKm) {
    // No charging needed
    const energyUsed = totalDistanceKm * energyPerKm;
    const arrivalPct = Math.round(batteryPercentage - (energyUsed / vehicleBatteryCapacityKwh) * 100);
    return {
      totalDistanceKm,
      totalDurationMin,
      totalStops: 0,
      estimatedTotalChargingMin: 0,
      estimatedTotalCost: 0,
      arrivalBatteryPct: Math.max(arrivalPct, 0),
      stops: [],
      route: {
        start: { lat: startLat, lng: startLng },
        end: { lat: endLat, lng: endLng },
        waypoints: [],
        polyline: initialRoute.polylinePoints,
        provider: initialRoute.provider,
      },
      directions: initialRoute.steps,
    };
  }

  // Step 2: Find candidate stations along the route corridor
  const candidates = await findStationsAlongCorridor(initialRoute.polylinePoints, 15);

  // Step 3: Greedy charging stop selection along the route
  const stops = [];
  let currentPositionKm = 0;
  let currentBattery = batteryPercentage;
  let currentLat = startLat;
  let currentLng = startLng;

  while (true) {
    const remainingDistanceKm = totalDistanceKm - currentPositionKm;
    const currentRange = (currentBattery / 100) * vehicleRangeKm;

    // Can we reach the destination?
    if (currentRange - safetyBuffer >= remainingDistanceKm) break;

    // Find the furthest we can go
    const maxReachKm = currentPositionKm + currentRange - safetyBuffer;

    // Find candidate stations between current position and max reach
    const viable = candidates.filter((c) =>
      c.distAlongRouteKm > currentPositionKm + 5 && // at least 5km ahead
      c.distAlongRouteKm <= maxReachKm &&
      !stops.some((s) => s.stationId === c.id), // not already picked
    );

    if (viable.length === 0) {
      // Try expanding — any station we can reach that's ahead of us
      const expanded = candidates.filter((c) =>
        c.distAlongRouteKm > currentPositionKm &&
        c.distAlongRouteKm <= maxReachKm + safetyBuffer * 0.5 &&
        !stops.some((s) => s.stationId === c.id),
      );
      if (expanded.length === 0) break; // no options — break to avoid infinite loop
      viable.push(...expanded);
    }

    // Score and pick the best station
    const scored = viable.map((c) => {
      const { score, estimatedWaitMin } = scoreStation(c);
      return { ...c, score, estimatedWaitMin };
    });
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];

    // Calculate leg energy
    const legDistance = best.distAlongRouteKm - currentPositionKm;
    const energyConsumed = legDistance * energyPerKm;
    const arrivalPct = Math.max(currentBattery - (energyConsumed / vehicleBatteryCapacityKwh) * 100, 2);

    // Energy to charge to 80%
    const energyToCharge = ((chargeTargetPct - arrivalPct) / 100) * vehicleBatteryCapacityKwh;
    const chargingTimeMin = estimateChargingMinutes(
      Math.max(energyToCharge, 0),
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
      distAlongRouteKm: best.distAlongRouteKm,
      detourKm: best.distFromRouteKm,
      arrivalBatteryPct: Math.round(arrivalPct),
      departureBatteryPct: chargeTargetPct,
      estimatedChargingMin: chargingTimeMin,
      estimatedWaitMin: best.estimatedWaitMin,
      chargingSpeedKw: Number(best.max_power_kw) || 50,
      availableSlots: Number(best.available_slots),
      totalSlots: Number(best.total_slots),
      rating: Number(best.rating) || 0,
      pricingPerKwh: Number(best.pricing_per_kwh) || 0,
      estimatedCost: Math.round(Math.max(energyToCharge, 0) * (Number(best.pricing_per_kwh) || 0.3) * 100) / 100,
    });

    currentPositionKm = best.distAlongRouteKm;
    currentLat = Number(best.latitude);
    currentLng = Number(best.longitude);
    currentBattery = chargeTargetPct;

    if (stops.length >= 20) break;
  }

  // Step 4: Get final route through all stops for accurate polyline
  let finalRoute = initialRoute;
  if (stops.length > 0) {
    try {
      const allWaypoints = [
        { lat: startLat, lng: startLng },
        ...stops.map((s) => ({ lat: s.latitude, lng: s.longitude })),
        { lat: endLat, lng: endLng },
      ];
      finalRoute = await routing.getRoute(allWaypoints);
    } catch {
      // If re-routing fails, keep the initial route
    }
  }

  // Calculate arrival battery
  const lastLegKm = stops.length > 0
    ? totalDistanceKm - stops[stops.length - 1].distAlongRouteKm
    : totalDistanceKm;
  const lastLegEnergy = lastLegKm * energyPerKm;
  const finalBattery = stops.length > 0 ? chargeTargetPct : batteryPercentage;
  const arrivalBatteryPct = Math.round(
    Math.max(finalBattery - (lastLegEnergy / vehicleBatteryCapacityKwh) * 100, 0),
  );

  // Total charging time
  const totalChargingMin = stops.reduce((s, st) => s + st.estimatedChargingMin + st.estimatedWaitMin, 0);

  return {
    totalDistanceKm: finalRoute.distanceKm,
    totalDurationMin: finalRoute.durationMin + totalChargingMin,
    totalDrivingMin: finalRoute.durationMin,
    totalStops: stops.length,
    estimatedTotalChargingMin: totalChargingMin,
    estimatedTotalCost: Math.round(stops.reduce((s, st) => s + st.estimatedCost, 0) * 100) / 100,
    arrivalBatteryPct,
    stops,
    route: {
      start: { lat: startLat, lng: startLng },
      end: { lat: endLat, lng: endLng },
      waypoints: stops.map((s) => ({ lat: s.latitude, lng: s.longitude })),
      polyline: finalRoute.polylinePoints,
      provider: finalRoute.provider,
    },
    directions: finalRoute.steps,
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

module.exports = { planRoute, saveRoutePlan, getUserRoutePlans, haversineKm: routing.haversineKm };

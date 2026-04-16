'use strict';

/**
 * Routing Service — provider-abstracted road-based routing.
 *
 * Primary:  OSRM (free, no API key)
 * Fallback: Haversine straight-line (when OSRM is unavailable)
 *
 * Designed for easy swap to Google Maps, Mapbox, or OpenRouteService.
 */

const env = require('../config/env');

// ── Polyline decoding (Google-format, used by OSRM) ─────────
function decodePolyline(encoded) {
  const points = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

// ── Haversine (fallback) ────────────────────────────────────
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

// ── Interpolate along a straight line ───────────────────────
function interpolatePoints(lat1, lon1, lat2, lon2, numPoints = 20) {
  const points = [];
  for (let i = 0; i <= numPoints; i++) {
    const f = i / numPoints;
    points.push({
      lat: lat1 + (lat2 - lat1) * f,
      lng: lon1 + (lon2 - lon1) * f,
    });
  }
  return points;
}

// ── OSRM provider ───────────────────────────────────────────
const OSRM_BASE = env.osrmBaseUrl || 'https://router.project-osrm.org';

/**
 * Get a road-based route from OSRM.
 *
 * @param {Array<{lat, lng}>} waypoints — [origin, ...via, destination]
 * @returns {{ distanceKm, durationMin, polylinePoints, steps, provider }}
 */
async function osrmRoute(waypoints) {
  const coords = waypoints.map((w) => `${w.lng},${w.lat}`).join(';');
  const url = `${OSRM_BASE}/route/v1/driving/${coords}?overview=full&geometries=polyline&steps=true&alternatives=false`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`OSRM returned ${res.status}`);
    }

    const data = await res.json();
    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      throw new Error(`OSRM error: ${data.code || 'no routes'}`);
    }

    const route = data.routes[0];
    const polylinePoints = decodePolyline(route.geometry);

    // Extract turn-by-turn steps
    const steps = [];
    for (const leg of route.legs) {
      for (const step of leg.steps) {
        if (step.maneuver && step.distance > 0) {
          steps.push({
            instruction: step.name
              ? `${step.maneuver.type} onto ${step.name}`
              : step.maneuver.type,
            distanceKm: Math.round((step.distance / 1000) * 10) / 10,
            durationMin: Math.round(step.duration / 60),
          });
        }
      }
    }

    return {
      distanceKm: Math.round((route.distance / 1000) * 10) / 10,
      durationMin: Math.round(route.duration / 60),
      polylinePoints,
      steps,
      provider: 'osrm',
    };
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

// ── Haversine fallback provider ─────────────────────────────
function haversineFallback(waypoints) {
  let totalKm = 0;
  for (let i = 1; i < waypoints.length; i++) {
    totalKm += haversineKm(
      waypoints[i - 1].lat, waypoints[i - 1].lng,
      waypoints[i].lat, waypoints[i].lng,
    );
  }

  // Generate interpolated points for a visual line
  const polylinePoints = [];
  for (let i = 1; i < waypoints.length; i++) {
    const segment = interpolatePoints(
      waypoints[i - 1].lat, waypoints[i - 1].lng,
      waypoints[i].lat, waypoints[i].lng,
      10,
    );
    if (i > 1) segment.shift(); // avoid duplicate at junction
    polylinePoints.push(...segment);
  }

  // Estimate duration: avg 50 km/h for straight-line
  const durationMin = Math.round((totalKm / 50) * 60);

  return {
    distanceKm: Math.round(totalKm * 10) / 10,
    durationMin,
    polylinePoints,
    steps: [],
    provider: 'haversine-fallback',
  };
}

// ── Public API ──────────────────────────────────────────────

/**
 * Get a route between waypoints using the best available provider.
 *
 * @param {Array<{lat, lng}>} waypoints — [origin, ...via, destination]
 * @returns {Promise<RouteResult>}
 */
async function getRoute(waypoints) {
  if (!waypoints || waypoints.length < 2) {
    throw new Error('At least 2 waypoints required');
  }

  try {
    return await osrmRoute(waypoints);
  } catch (err) {
    console.warn(`[routing] OSRM failed (${err.message}), using Haversine fallback`);
    return haversineFallback(waypoints);
  }
}

/**
 * Get a route between just two points (convenience).
 */
async function getSimpleRoute(origin, destination) {
  return getRoute([origin, destination]);
}

/**
 * Sample points along a route polyline at regular intervals.
 * Used to search for stations along the route corridor.
 *
 * @param {Array<{lat, lng}>} polylinePoints
 * @param {number} intervalKm — sample every N km
 * @returns {Array<{lat, lng, cumulativeKm}>}
 */
function sampleAlongRoute(polylinePoints, intervalKm = 20) {
  if (!polylinePoints || polylinePoints.length === 0) return [];

  const samples = [{ ...polylinePoints[0], cumulativeKm: 0 }];
  let accumulated = 0;
  let lastSampleKm = 0;

  for (let i = 1; i < polylinePoints.length; i++) {
    const segKm = haversineKm(
      polylinePoints[i - 1].lat, polylinePoints[i - 1].lng,
      polylinePoints[i].lat, polylinePoints[i].lng,
    );
    accumulated += segKm;

    if (accumulated - lastSampleKm >= intervalKm) {
      samples.push({ ...polylinePoints[i], cumulativeKm: Math.round(accumulated * 10) / 10 });
      lastSampleKm = accumulated;
    }
  }

  return samples;
}

/**
 * Find the closest point on a polyline to a given coordinate.
 * Returns the cumulative distance along the route to that point.
 */
function distanceAlongRoute(polylinePoints, targetLat, targetLng) {
  let minDist = Infinity;
  let bestCumKm = 0;
  let cumKm = 0;

  for (let i = 0; i < polylinePoints.length; i++) {
    if (i > 0) {
      cumKm += haversineKm(
        polylinePoints[i - 1].lat, polylinePoints[i - 1].lng,
        polylinePoints[i].lat, polylinePoints[i].lng,
      );
    }
    const d = haversineKm(polylinePoints[i].lat, polylinePoints[i].lng, targetLat, targetLng);
    if (d < minDist) {
      minDist = d;
      bestCumKm = cumKm;
    }
  }

  return { distFromRoute: minDist, distAlongRouteKm: bestCumKm };
}

module.exports = {
  getRoute,
  getSimpleRoute,
  sampleAlongRoute,
  distanceAlongRoute,
  haversineKm,
  decodePolyline,
};

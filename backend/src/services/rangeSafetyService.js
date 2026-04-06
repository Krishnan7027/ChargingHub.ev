const db = require('../config/database');

/**
 * EV Range Safety Assistant Service
 *
 * Prevents drivers from running out of battery by:
 * 1. Estimating remaining range from battery %, capacity, and efficiency
 * 2. Finding nearby stations within reachable range using earth_distance
 * 3. Assessing trip feasibility (origin → destination)
 * 4. Generating alerts when range is low or no stations are reachable
 *
 * Range formula:
 *   baseRange = (batteryPct / 100) × capacityKwh / efficiencyKwhPerKm
 *   adjustedRange = baseRange × styleMultiplier × climateMultiplier × speedMultiplier
 *
 * Safety thresholds:
 *   - warning:  range < 50 km  OR  nearest station > 70% of range
 *   - critical: range < 20 km  OR  nearest station > 90% of range
 */

const STYLE_MULTIPLIERS = { eco: 1.15, normal: 1.0, sport: 0.80 };
const CLIMATE_PENALTY = 0.90; // 10% reduction when climate control on
const SAFETY_BUFFER = 0.85; // keep 15% safety margin on range estimates

const THRESHOLDS = {
  lowRangeKm: 50,
  criticalRangeKm: 20,
  warningStationRatio: 0.70, // station > 70% of range = warning
  criticalStationRatio: 0.90, // station > 90% of range = critical
};

// ── Profile CRUD ──────────────────────────────────────────────

async function getOrCreateProfile(userId) {
  const { rows } = await db.query(
    'SELECT * FROM vehicle_range_profiles WHERE user_id = $1',
    [userId],
  );
  if (rows[0]) return rows[0];

  const { rows: created } = await db.query(
    `INSERT INTO vehicle_range_profiles (user_id) VALUES ($1) RETURNING *`,
    [userId],
  );
  return created[0];
}

async function updateProfile(userId, data) {
  const fields = [];
  const values = [];
  let idx = 1;

  const allowed = [
    'vehicle_name', 'battery_capacity_kwh', 'current_battery_pct',
    'efficiency_kwh_per_km', 'driving_style', 'climate_control_on',
    'avg_speed_kmh', 'last_latitude', 'last_longitude',
  ];

  for (const key of allowed) {
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    if (data[camel] !== undefined) {
      fields.push(`${key} = $${idx}`);
      values.push(data[camel]);
      idx++;
    }
  }
  if (fields.length === 0) return getOrCreateProfile(userId);

  fields.push(`updated_at = NOW()`);
  if (data.lastLatitude !== undefined || data.lastLongitude !== undefined) {
    fields.push(`last_location_updated_at = NOW()`);
  }

  values.push(userId);
  const { rows } = await db.query(
    `UPDATE vehicle_range_profiles SET ${fields.join(', ')} WHERE user_id = $${idx} RETURNING *`,
    values,
  );
  if (!rows[0]) return getOrCreateProfile(userId);
  return rows[0];
}

// ── Range Calculation ─────────────────────────────────────────

function calculateRange(profile) {
  const batteryPct = parseFloat(profile.current_battery_pct) || 80;
  const capacityKwh = parseFloat(profile.battery_capacity_kwh) || 60;
  const efficiencyKwhPerKm = parseFloat(profile.efficiency_kwh_per_km) || 0.18;
  const style = profile.driving_style || 'normal';
  const climateOn = profile.climate_control_on || false;
  const avgSpeedKmh = parseFloat(profile.avg_speed_kmh) || 60;

  // base range
  const baseRangeKm = (batteryPct / 100) * capacityKwh / efficiencyKwhPerKm;

  // modifiers
  const styleMult = STYLE_MULTIPLIERS[style] || 1.0;
  const climateMult = climateOn ? CLIMATE_PENALTY : 1.0;

  // speed modifier: efficiency drops above 90 km/h and below 30 km/h
  let speedMult = 1.0;
  if (avgSpeedKmh > 90) speedMult = 1 - ((avgSpeedKmh - 90) * 0.005); // ~0.5% per km/h over 90
  else if (avgSpeedKmh < 30) speedMult = 0.95;
  speedMult = Math.max(0.6, Math.min(1.0, speedMult));

  const adjustedRange = baseRangeKm * styleMult * climateMult * speedMult;
  const safeRange = adjustedRange * SAFETY_BUFFER;

  return {
    baseRangeKm: Math.round(baseRangeKm * 10) / 10,
    adjustedRangeKm: Math.round(adjustedRange * 10) / 10,
    safeRangeKm: Math.round(safeRange * 10) / 10,
    batteryPct,
    capacityKwh,
    efficiencyKwhPerKm,
    modifiers: {
      style: { factor: style, multiplier: styleMult },
      climate: { active: climateOn, multiplier: climateMult },
      speed: { avgKmh: avgSpeedKmh, multiplier: Math.round(speedMult * 1000) / 1000 },
    },
  };
}

// ── Find Nearby Stations Within Range ─────────────────────────

async function findStationsInRange(latitude, longitude, rangeKm, limit = 10) {
  const radiusMeters = rangeKm * 1000;
  const { rows } = await db.query(
    `SELECT s.id, s.name, s.address, s.city, s.latitude, s.longitude,
            s.pricing_per_kwh, s.rating,
            (earth_distance(
              ll_to_earth($1, $2),
              ll_to_earth(s.latitude, s.longitude)
            ) / 1000.0) AS distance_km,
            COUNT(sl.id) FILTER (WHERE sl.status = 'available') AS available_slots,
            COUNT(sl.id) AS total_slots,
            MAX(sl.power_output_kw) AS max_power_kw
     FROM stations s
     LEFT JOIN charging_slots sl ON sl.station_id = s.id
     WHERE s.status = 'approved'
       AND earth_distance(
             ll_to_earth($1, $2),
             ll_to_earth(s.latitude, s.longitude)
           ) <= $3
     GROUP BY s.id
     ORDER BY distance_km ASC
     LIMIT $4`,
    [latitude, longitude, radiusMeters, limit],
  );
  return rows.map((r) => ({
    ...r,
    distance_km: parseFloat(parseFloat(r.distance_km).toFixed(2)),
    available_slots: parseInt(r.available_slots, 10),
    total_slots: parseInt(r.total_slots, 10),
    max_power_kw: r.max_power_kw ? parseFloat(r.max_power_kw) : null,
  }));
}

// ── Range Assessment ──────────────────────────────────────────

async function assessRange(userId, { latitude, longitude } = {}) {
  const profile = await getOrCreateProfile(userId);

  const lat = latitude || parseFloat(profile.last_latitude);
  const lng = longitude || parseFloat(profile.last_longitude);
  const hasLocation = lat && lng && !isNaN(lat) && !isNaN(lng);

  const range = calculateRange(profile);
  const result = {
    profile: formatProfile(profile),
    range,
    nearbyStations: [],
    alerts: [],
    status: 'safe',
  };

  if (!hasLocation) {
    result.status = 'no_location';
    result.alerts.push({
      type: 'info',
      title: 'Location Required',
      message: 'Update your location to get nearby station recommendations and range alerts.',
    });
    return result;
  }

  // update profile location
  if (latitude && longitude) {
    await db.query(
      `UPDATE vehicle_range_profiles
       SET last_latitude = $1, last_longitude = $2, last_location_updated_at = NOW()
       WHERE user_id = $3`,
      [latitude, longitude, userId],
    );
  }

  // find stations within safe range
  const stations = await findStationsInRange(lat, lng, range.safeRangeKm);
  result.nearbyStations = stations;

  const nearestStation = stations[0] || null;
  const nearestDistKm = nearestStation ? nearestStation.distance_km : null;

  // assess safety
  const alerts = [];

  if (range.safeRangeKm < THRESHOLDS.criticalRangeKm) {
    result.status = 'critical';
    alerts.push({
      type: 'critical_range',
      severity: 'critical',
      title: 'Critical Battery Level',
      message: `Estimated safe range is only ${range.safeRangeKm} km. Find a charging station immediately.`,
    });
  } else if (range.safeRangeKm < THRESHOLDS.lowRangeKm) {
    result.status = 'warning';
    alerts.push({
      type: 'low_range',
      severity: 'warning',
      title: 'Low Range Warning',
      message: `Estimated safe range is ${range.safeRangeKm} km. Consider charging soon.`,
    });
  }

  if (nearestDistKm === null) {
    // No stations found in range
    if (result.status === 'safe') result.status = 'warning';
    alerts.push({
      type: 'no_station_in_range',
      severity: 'critical',
      title: 'No Charging Station In Range',
      message: `No approved charging stations found within your safe range of ${range.safeRangeKm} km.`,
    });
  } else if (nearestDistKm > range.safeRangeKm * THRESHOLDS.criticalStationRatio) {
    if (result.status === 'safe') result.status = 'warning';
    alerts.push({
      type: 'station_suggested',
      severity: 'warning',
      title: 'Nearest Station Close to Range Limit',
      message: `Nearest station "${nearestStation.name}" is ${nearestDistKm} km away (${Math.round((nearestDistKm / range.safeRangeKm) * 100)}% of your safe range). Charge soon.`,
    });
  } else if (nearestDistKm > range.safeRangeKm * THRESHOLDS.warningStationRatio) {
    alerts.push({
      type: 'station_suggested',
      severity: 'info',
      title: 'Nearest Station',
      message: `Nearest station "${nearestStation.name}" is ${nearestDistKm} km away with ${nearestStation.available_slots} available slots.`,
    });
  }

  result.alerts = alerts;

  // persist alerts
  for (const alert of alerts) {
    await db.query(
      `INSERT INTO range_alerts (user_id, profile_id, alert_type, severity, title, message,
        battery_pct_at_alert, estimated_range_km, nearest_station_km, nearest_station_id,
        suggested_stations, latitude, longitude)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        userId, profile.id, alert.type, alert.severity, alert.title, alert.message,
        range.batteryPct, range.safeRangeKm, nearestDistKm,
        nearestStation?.id || null,
        JSON.stringify(stations.slice(0, 5).map((s) => ({ id: s.id, name: s.name, distanceKm: s.distance_km }))),
        lat, lng,
      ],
    );
  }

  return result;
}

// ── Trip Safety Check ─────────────────────────────────────────

async function checkTripSafety(userId, { originLat, originLng, destLat, destLng }) {
  const profile = await getOrCreateProfile(userId);
  const range = calculateRange(profile);

  // Haversine approximate distance
  const tripDistanceKm = haversineKm(originLat, originLng, destLat, destLng);
  const bufferKm = range.safeRangeKm - tripDistanceKm;
  const safetyMarginPct = (bufferKm / range.safeRangeKm) * 100;
  const isSafe = bufferKm > 0;

  const result = {
    tripDistanceKm: Math.round(tripDistanceKm * 10) / 10,
    estimatedRangeKm: range.safeRangeKm,
    rangeBufferKm: Math.round(bufferKm * 10) / 10,
    safetyMarginPct: Math.round(safetyMarginPct),
    isSafe,
    status: isSafe ? (safetyMarginPct > 30 ? 'safe' : 'tight') : 'unsafe',
    suggestedStop: null,
    alerts: [],
  };

  if (!isSafe) {
    // Find a station along the route (midpoint search)
    const midLat = (originLat + destLat) / 2;
    const midLng = (originLng + destLng) / 2;
    const searchRadius = Math.max(range.safeRangeKm * 0.6, 20);
    const midStations = await findStationsInRange(midLat, midLng, searchRadius, 5);

    if (midStations.length > 0) {
      result.suggestedStop = midStations[0];
      result.alerts.push({
        type: 'trip_unsafe',
        severity: 'critical',
        title: 'Trip Exceeds Safe Range',
        message: `This trip is ${result.tripDistanceKm} km but your safe range is only ${range.safeRangeKm} km. Stop at "${midStations[0].name}" (${midStations[0].distance_km} km from midpoint) to charge.`,
      });
    } else {
      result.alerts.push({
        type: 'trip_unsafe',
        severity: 'critical',
        title: 'Trip Exceeds Safe Range',
        message: `This trip is ${result.tripDistanceKm} km but your safe range is only ${range.safeRangeKm} km. No charging stations found along the route — consider charging before departure.`,
      });
    }
  } else if (safetyMarginPct < 30) {
    // Tight margin — find en-route stations just in case
    const midLat = (originLat + destLat) / 2;
    const midLng = (originLng + destLng) / 2;
    const midStations = await findStationsInRange(midLat, midLng, tripDistanceKm * 0.5, 3);
    if (midStations.length > 0) {
      result.suggestedStop = midStations[0];
    }
    result.alerts.push({
      type: 'low_range',
      severity: 'warning',
      title: 'Tight Range Margin',
      message: `You have only ${result.rangeBufferKm} km of buffer (${result.safetyMarginPct}% margin). Consider a precautionary charging stop.`,
    });
  }

  // find stations near destination
  const destStations = await findStationsInRange(destLat, destLng, 25, 5);
  result.destinationStations = destStations;

  // persist trip check
  await db.query(
    `INSERT INTO trip_safety_checks (user_id, origin_lat, origin_lng, destination_lat, destination_lng,
      trip_distance_km, battery_pct_at_start, estimated_range_km, range_buffer_km, is_safe,
      safety_margin_pct, recommended_charge_stop, suggested_station_id, suggested_station_name,
      suggested_station_distance_km)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [
      userId, originLat, originLng, destLat, destLng,
      result.tripDistanceKm, range.batteryPct, range.safeRangeKm, result.rangeBufferKm,
      isSafe, result.safetyMarginPct, !!result.suggestedStop,
      result.suggestedStop?.id || null, result.suggestedStop?.name || null,
      result.suggestedStop?.distance_km || null,
    ],
  );

  return { ...result, range, profile: formatProfile(profile) };
}

// ── Get Alerts ────────────────────────────────────────────────

async function getAlerts(userId, { limit = 20, unreadOnly = false } = {}) {
  const where = unreadOnly ? 'AND ra.is_read = false' : '';
  const { rows } = await db.query(
    `SELECT ra.*, s.name AS station_name
     FROM range_alerts ra
     LEFT JOIN stations s ON s.id = ra.nearest_station_id
     WHERE ra.user_id = $1 ${where}
     ORDER BY ra.created_at DESC
     LIMIT $2`,
    [userId, limit],
  );
  return rows;
}

async function markAlertRead(alertId, userId) {
  await db.query(
    `UPDATE range_alerts SET is_read = true WHERE id = $1 AND user_id = $2`,
    [alertId, userId],
  );
}

async function markAllAlertsRead(userId) {
  await db.query(
    `UPDATE range_alerts SET is_read = true WHERE user_id = $1 AND is_read = false`,
    [userId],
  );
}

// ── Get Trip History ──────────────────────────────────────────

async function getTripHistory(userId, limit = 10) {
  const { rows } = await db.query(
    `SELECT * FROM trip_safety_checks WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, limit],
  );
  return rows;
}

// ── Helpers ───────────────────────────────────────────────────

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg) { return deg * Math.PI / 180; }

function formatProfile(p) {
  return {
    id: p.id,
    userId: p.user_id,
    vehicleName: p.vehicle_name,
    batteryCapacityKwh: parseFloat(p.battery_capacity_kwh),
    currentBatteryPct: parseFloat(p.current_battery_pct),
    efficiencyKwhPerKm: parseFloat(p.efficiency_kwh_per_km),
    drivingStyle: p.driving_style,
    climateControlOn: p.climate_control_on,
    avgSpeedKmh: parseFloat(p.avg_speed_kmh),
    lastLatitude: p.last_latitude ? parseFloat(p.last_latitude) : null,
    lastLongitude: p.last_longitude ? parseFloat(p.last_longitude) : null,
    lastLocationUpdatedAt: p.last_location_updated_at,
    estimatedRangeKm: p.estimated_range_km ? parseFloat(p.estimated_range_km) : null,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

module.exports = {
  getOrCreateProfile,
  updateProfile,
  calculateRange,
  assessRange,
  findStationsInRange,
  checkTripSafety,
  getAlerts,
  markAlertRead,
  markAllAlertsRead,
  getTripHistory,
};

const { body, query } = require('express-validator');
const rangeSafetyService = require('../services/rangeSafetyService');

// ── Validation ────────────────────────────────────────────────

const assessValidation = [
  query('latitude').optional().isFloat({ min: -90, max: 90 }),
  query('longitude').optional().isFloat({ min: -180, max: 180 }),
];

const tripCheckValidation = [
  body('originLat').isFloat({ min: -90, max: 90 }).withMessage('Valid origin latitude required'),
  body('originLng').isFloat({ min: -180, max: 180 }).withMessage('Valid origin longitude required'),
  body('destLat').isFloat({ min: -90, max: 90 }).withMessage('Valid destination latitude required'),
  body('destLng').isFloat({ min: -180, max: 180 }).withMessage('Valid destination longitude required'),
];

// ── Handlers ──────────────────────────────────────────────────

async function getProfile(req, res, next) {
  try {
    const profile = await rangeSafetyService.getOrCreateProfile(req.user.id);
    const range = rangeSafetyService.calculateRange(profile);
    res.json({
      profile: formatProfile(profile),
      range,
    });
  } catch (err) {
    next(err);
  }
}

async function updateProfile(req, res, next) {
  try {
    const profile = await rangeSafetyService.updateProfile(req.user.id, req.body);
    const range = rangeSafetyService.calculateRange(profile);
    res.json({
      profile: formatProfile(profile),
      range,
    });
  } catch (err) {
    next(err);
  }
}

async function assessRange(req, res, next) {
  try {
    const latitude = req.query.latitude ? parseFloat(req.query.latitude) : undefined;
    const longitude = req.query.longitude ? parseFloat(req.query.longitude) : undefined;
    const result = await rangeSafetyService.assessRange(req.user.id, { latitude, longitude });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function checkTripSafety(req, res, next) {
  try {
    const { originLat, originLng, destLat, destLng } = req.body;
    const result = await rangeSafetyService.checkTripSafety(req.user.id, {
      originLat: parseFloat(originLat),
      originLng: parseFloat(originLng),
      destLat: parseFloat(destLat),
      destLng: parseFloat(destLng),
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getAlerts(req, res, next) {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const unreadOnly = req.query.unreadOnly === 'true';
    const alerts = await rangeSafetyService.getAlerts(req.user.id, { limit, unreadOnly });
    res.json({ alerts, count: alerts.length });
  } catch (err) {
    next(err);
  }
}

async function markAlertRead(req, res, next) {
  try {
    await rangeSafetyService.markAlertRead(req.params.alertId, req.user.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function markAllAlertsRead(req, res, next) {
  try {
    await rangeSafetyService.markAllAlertsRead(req.user.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function getNearbyStations(req, res, next) {
  try {
    const latitude = parseFloat(req.query.latitude);
    const longitude = parseFloat(req.query.longitude);
    const rangeKm = parseFloat(req.query.rangeKm) || 50;
    const limit = parseInt(req.query.limit) || 10;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'latitude and longitude required' });
    }

    const stations = await rangeSafetyService.findStationsInRange(latitude, longitude, rangeKm, limit);
    res.json({ stations, count: stations.length });
  } catch (err) {
    next(err);
  }
}

async function getTripHistory(req, res, next) {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const trips = await rangeSafetyService.getTripHistory(req.user.id, limit);
    res.json({ trips, count: trips.length });
  } catch (err) {
    next(err);
  }
}

// ── Helper ────────────────────────────────────────────────────

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
    estimatedRangeKm: p.estimated_range_km ? parseFloat(p.estimated_range_km) : null,
  };
}

module.exports = {
  assessValidation,
  tripCheckValidation,
  getProfile,
  updateProfile,
  assessRange,
  checkTripSafety,
  getAlerts,
  markAlertRead,
  markAllAlertsRead,
  getNearbyStations,
  getTripHistory,
};

const { body, query } = require('express-validator');
const routePlanningService = require('../services/routePlanningService');

const planRouteValidation = [
  body('startLat').isFloat({ min: -90, max: 90 }),
  body('startLng').isFloat({ min: -180, max: 180 }),
  body('endLat').isFloat({ min: -90, max: 90 }),
  body('endLng').isFloat({ min: -180, max: 180 }),
  body('batteryPercentage').isFloat({ min: 0, max: 100 }),
  body('vehicleRangeKm').isFloat({ min: 50, max: 1000 }),
  body('vehicleBatteryCapacityKwh').optional().isFloat({ min: 10, max: 200 }),
];

async function planRoute(req, res, next) {
  try {
    const plan = await routePlanningService.planRoute(req.body);
    res.json(plan);
  } catch (err) {
    next(err);
  }
}

async function savePlan(req, res, next) {
  try {
    const saved = await routePlanningService.saveRoutePlan(req.user.id, req.body);
    res.status(201).json(saved);
  } catch (err) {
    next(err);
  }
}

async function getMyPlans(req, res, next) {
  try {
    const plans = await routePlanningService.getUserRoutePlans(req.user.id);
    res.json(plans);
  } catch (err) {
    next(err);
  }
}

module.exports = { planRouteValidation, planRoute, savePlan, getMyPlans };

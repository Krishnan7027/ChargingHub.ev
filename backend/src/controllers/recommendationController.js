const { query } = require('express-validator');
const recommendationService = require('../services/recommendationService');

const recommendValidation = [
  query('latitude').isFloat({ min: -90, max: 90 }),
  query('longitude').isFloat({ min: -180, max: 180 }),
  query('radiusKm').optional().isFloat({ min: 1, max: 100 }),
  query('chargingType').optional().isIn(['level1', 'level2', 'dc_fast']),
  query('connectorType').optional().isIn(['type1', 'type2', 'ccs', 'chademo', 'tesla']),
  query('limit').optional().isInt({ min: 1, max: 50 }),
];

async function getRecommendations(req, res, next) {
  try {
    const { latitude, longitude, radiusKm, chargingType, connectorType, limit } = req.query;
    const result = await recommendationService.getRecommendations({
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      radiusKm: radiusKm ? parseFloat(radiusKm) : 25,
      chargingType: chargingType || null,
      connectorType: connectorType || null,
      limit: limit ? parseInt(limit, 10) : 10,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { recommendValidation, getRecommendations };

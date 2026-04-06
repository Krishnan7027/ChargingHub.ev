const predictionService = require('../services/predictionService');
const { caches } = require('../utils/cache');

async function getSmartPrediction(req, res, next) {
  try {
    const cacheKey = `prediction:${req.params.stationId}`;

    const result = await caches.prediction.wrap(cacheKey, () =>
      predictionService.predictNextAvailable(req.params.stationId)
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function predictForArrival(req, res, next) {
  try {
    const etaMinutes = parseInt(req.query.eta) || 15;
    const preferences = {};
    if (req.query.connectorType) preferences.connectorType = req.query.connectorType;
    if (req.query.chargingType) preferences.chargingType = req.query.chargingType;

    const prediction = await predictionService.predictForArrival(
      req.params.stationId, etaMinutes, preferences
    );
    res.json(prediction);
  } catch (err) {
    next(err);
  }
}

function getDemandProfile(req, res) {
  res.json(predictionService.getHourlyDemandProfile());
}

module.exports = { getSmartPrediction, predictForArrival, getDemandProfile };

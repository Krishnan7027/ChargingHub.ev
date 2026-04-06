const congestionService = require('../services/congestionPredictionService');
const { caches } = require('../utils/cache');

async function predictCongestion(req, res, next) {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const result = await congestionService.predictCongestion(req.params.stationId, hours);
    // Cache the freshly computed prediction
    caches.congestion.set(`congestion:${req.params.stationId}:${hours}`, result);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getCachedPredictions(req, res, next) {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const cacheKey = `congestion:${req.params.stationId}:${hours}`;

    // Try in-memory cache first
    const cached = caches.congestion.get(cacheKey);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    const result = await congestionService.getCachedPredictions(req.params.stationId, hours);
    caches.congestion.set(cacheKey, result);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { predictCongestion, getCachedPredictions };

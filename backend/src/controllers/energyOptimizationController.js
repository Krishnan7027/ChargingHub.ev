const optimizationService = require('../services/energyOptimizationService');

async function getStationRecommendations(req, res, next) {
  try {
    const result = await optimizationService.getStationRecommendations(req.params.stationId);
    res.json({ stationId: req.params.stationId, recommendations: result });
  } catch (err) {
    next(err);
  }
}

async function generateOptimizations(req, res, next) {
  try {
    const result = await optimizationService.generateStationOptimizations(req.params.stationId);
    res.json({ stationId: req.params.stationId, recommendations: result, generated: result.length });
  } catch (err) {
    next(err);
  }
}

async function getPlatformSummary(req, res, next) {
  try {
    const result = await optimizationService.getPlatformOptimizationSummary();
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function updateRecommendation(req, res, next) {
  try {
    const { status } = req.body;
    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be accepted or rejected' });
    }
    await optimizationService.updateRecommendationStatus(req.params.recommendationId, status);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { getStationRecommendations, generateOptimizations, getPlatformSummary, updateRecommendation };

const batteryHealthService = require('../services/batteryHealthService');

async function getHealth(req, res, next) {
  try {
    const data = await batteryHealthService.getHealth(req.user.id);
    if (!data || !data.profile) {
      return res.json({
        profile: null,
        healthHistory: [],
        recommendations: [],
        chargingPatterns: null,
        message: 'No battery health data yet. Run an analysis to get started.',
      });
    }
    res.json(data);
  } catch (err) { next(err); }
}

async function analyzeHealth(req, res, next) {
  try {
    const data = await batteryHealthService.analyzeHealth(req.user.id);
    res.json(data);
  } catch (err) { next(err); }
}

async function updateProfile(req, res, next) {
  try {
    const { vehicleName, batteryCapacityKwh, manufactureYear } = req.body;
    const profile = await batteryHealthService.updateProfile(req.user.id, {
      vehicleName, batteryCapacityKwh, manufactureYear,
    });
    res.json(profile);
  } catch (err) { next(err); }
}

async function getHealthHistory(req, res, next) {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 90;
    const snapshots = await batteryHealthService.getHealthHistory(req.user.id, limit);
    res.json({ snapshots });
  } catch (err) { next(err); }
}

async function getRecommendations(req, res, next) {
  try {
    const recs = await batteryHealthService.getActiveRecommendations(req.user.id);
    res.json({ recommendations: recs });
  } catch (err) { next(err); }
}

async function dismissRecommendation(req, res, next) {
  try {
    const rec = await batteryHealthService.dismissRecommendation(req.params.recId, req.user.id);
    res.json(rec);
  } catch (err) { next(err); }
}

module.exports = {
  getHealth,
  analyzeHealth,
  updateProfile,
  getHealthHistory,
  getRecommendations,
  dismissRecommendation,
};

const carbonService = require('../services/carbonFootprintService');

async function getSessionCarbon(req, res, next) {
  try {
    const result = await carbonService.getSessionCarbon(req.params.sessionId);
    if (!result) return res.status(404).json({ error: 'No carbon record for this session' });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function recordSessionCarbon(req, res, next) {
  try {
    const result = await carbonService.recordSessionCarbon(req.params.sessionId);
    if (!result) return res.status(404).json({ error: 'Session not found or no energy delivered' });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getUserCarbon(req, res, next) {
  try {
    const result = await carbonService.getUserCarbonSummary(req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getStationCarbon(req, res, next) {
  try {
    const result = await carbonService.getStationCarbonSummary(req.params.stationId, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getPlatformCarbon(req, res, next) {
  try {
    const result = await carbonService.getPlatformCarbonSummary();
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { getSessionCarbon, recordSessionCarbon, getUserCarbon, getStationCarbon, getPlatformCarbon };

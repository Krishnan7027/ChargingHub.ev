const twinService = require('../services/batteryDigitalTwinService');

async function getTwinBySession(req, res, next) {
  try {
    const result = await twinService.getTwinBySession(req.params.sessionId);
    if (!result) return res.status(404).json({ error: 'No digital twin found for this session' });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function simulateStep(req, res, next) {
  try {
    const result = await twinService.simulateStep(req.params.sessionId);
    if (!result) return res.status(404).json({ error: 'Session not found or not active' });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getStationTwins(req, res, next) {
  try {
    const twins = await twinService.getStationTwins(req.params.stationId);
    res.json({ stationId: req.params.stationId, twins, count: twins.length });
  } catch (err) {
    next(err);
  }
}

module.exports = { getTwinBySession, simulateStep, getStationTwins };

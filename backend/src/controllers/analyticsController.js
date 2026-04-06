const analyticsService = require('../services/analyticsService');

async function getPlatformAnalytics(req, res, next) {
  try {
    const { startDate, endDate, period } = req.query;
    const result = await analyticsService.getPlatformAnalytics({
      startDate, endDate, period,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getStationAnalytics(req, res, next) {
  try {
    const { startDate, endDate } = req.query;
    const result = await analyticsService.getStationAnalytics(
      req.params.stationId, { startDate, endDate },
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function triggerAggregation(req, res, next) {
  try {
    const { date } = req.body;
    await analyticsService.aggregateDailyStats(date || null);
    res.json({ message: 'Daily stats aggregated successfully' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getPlatformAnalytics, getStationAnalytics, triggerAggregation };

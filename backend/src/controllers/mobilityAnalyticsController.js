const mobilityService = require('../services/mobilityAnalyticsService');
const infraService = require('../services/infrastructurePlanningService');

// ── Heatmap ──────────────────────────────────────────────────────

async function getHeatmapData(req, res, next) {
  try {
    const { minLat, maxLat, minLng, maxLng, periodStart, periodEnd } = req.query;
    const data = await mobilityService.getHeatmapData({
      minLat: minLat ? Number(minLat) : undefined,
      maxLat: maxLat ? Number(maxLat) : undefined,
      minLng: minLng ? Number(minLng) : undefined,
      maxLng: maxLng ? Number(maxLng) : undefined,
      periodStart,
      periodEnd,
    });
    res.json({ cells: data, count: data.length });
  } catch (err) { next(err); }
}

async function aggregateHeatmap(req, res, next) {
  try {
    const { periodStart, periodEnd } = req.body;
    if (!periodStart || !periodEnd) {
      return res.status(400).json({ error: 'periodStart and periodEnd are required' });
    }
    const result = await mobilityService.aggregateHeatmapData(periodStart, periodEnd);
    res.json(result);
  } catch (err) { next(err); }
}

// ── Behavior Stats ───────────────────────────────────────────────

async function getBehaviorStats(req, res, next) {
  try {
    const { city, startDate, endDate } = req.query;
    const data = await mobilityService.getBehaviorStats({ city, startDate, endDate });
    res.json({ stats: data, count: data.length });
  } catch (err) { next(err); }
}

async function aggregateBehavior(req, res, next) {
  try {
    const { date } = req.body;
    if (!date) return res.status(400).json({ error: 'date is required' });
    const result = await mobilityService.aggregateBehaviorStats(date);
    res.json({ stats: result, citiesUpdated: result.length });
  } catch (err) { next(err); }
}

// ── City Trends ──────────────────────────────────────────────────

async function getCityTrends(req, res, next) {
  try {
    const { city, startMonth, endMonth } = req.query;
    const data = await mobilityService.getCityTrends({ city, startMonth, endMonth });
    res.json({ trends: data, count: data.length });
  } catch (err) { next(err); }
}

async function aggregateCityTrends(req, res, next) {
  try {
    const { month } = req.body;
    if (!month) return res.status(400).json({ error: 'month is required (YYYY-MM-DD, first of month)' });
    const result = await mobilityService.aggregateCityTrends(month);
    res.json({ trends: result, citiesUpdated: result.length });
  } catch (err) { next(err); }
}

async function getAvailableCities(req, res, next) {
  try {
    const cities = await mobilityService.getAvailableCities();
    res.json({ cities });
  } catch (err) { next(err); }
}

// ── Infrastructure Planning ──────────────────────────────────────

async function generateInfraRecommendations(req, res, next) {
  try {
    const { city, minGapScore } = req.body;
    const result = await infraService.generateRecommendations({
      city,
      minGapScore: minGapScore ? Number(minGapScore) : undefined,
    });
    res.json(result);
  } catch (err) { next(err); }
}

async function getInfraRecommendations(req, res, next) {
  try {
    const { city, status, minScore, limit } = req.query;
    const data = await infraService.getRecommendations({
      city, status,
      minScore: minScore ? Number(minScore) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    res.json({ recommendations: data, count: data.length });
  } catch (err) { next(err); }
}

async function updateInfraRecommendation(req, res, next) {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'status is required' });
    const result = await infraService.updateRecommendationStatus(req.params.recId, status);
    res.json(result);
  } catch (err) { next(err); }
}

async function getCitySummary(req, res, next) {
  try {
    const { city } = req.params;
    if (!city) return res.status(400).json({ error: 'city parameter is required' });
    const summary = await infraService.getCitySummary(city);
    res.json(summary);
  } catch (err) { next(err); }
}

module.exports = {
  getHeatmapData,
  aggregateHeatmap,
  getBehaviorStats,
  aggregateBehavior,
  getCityTrends,
  aggregateCityTrends,
  getAvailableCities,
  generateInfraRecommendations,
  getInfraRecommendations,
  updateInfraRecommendation,
  getCitySummary,
};

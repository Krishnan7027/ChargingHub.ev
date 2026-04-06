const demandForecastService = require('../services/demandForecastService');
const { caches } = require('../utils/cache');

async function getForecast(req, res, next) {
  try {
    const { day } = req.query;
    const dayOfWeek = day !== undefined ? parseInt(day, 10) : null;
    const cacheKey = `demand:${req.params.stationId}:${dayOfWeek}`;

    const result = await caches.demand.wrap(cacheKey, () =>
      demandForecastService.getForecast(req.params.stationId, dayOfWeek)
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getTodayForecast(req, res, next) {
  try {
    const cacheKey = `demand:${req.params.stationId}:today`;

    const result = await caches.demand.wrap(cacheKey, () =>
      demandForecastService.getTodayForecast(req.params.stationId),
      5 * 60_000, // 5 min for today's forecast
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function refreshForecast(req, res, next) {
  try {
    await demandForecastService.buildForecast(req.params.stationId);
    // Invalidate cached forecasts for this station
    caches.demand.invalidatePrefix(`demand:${req.params.stationId}`);
    res.json({ message: 'Forecast rebuilt successfully' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getForecast, getTodayForecast, refreshForecast };

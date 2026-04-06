const gridService = require('../services/gridLoadBalancingService');
const { caches } = require('../utils/cache');

async function getGridProfile(req, res, next) {
  try {
    const cacheKey = `grid:${req.params.stationId}`;

    const result = await caches.grid.wrap(cacheKey, () =>
      gridService.getGridProfile(req.params.stationId)
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function updateGridSettings(req, res, next) {
  try {
    const result = await gridService.updateGridSettings(req.params.stationId, req.body);
    // Invalidate grid cache for this station
    caches.grid.delete(`grid:${req.params.stationId}`);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { getGridProfile, updateGridSettings };

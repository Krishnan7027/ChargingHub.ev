const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const smartPredCtrl = require('../controllers/smartPredictionController');
const demandCtrl = require('../controllers/demandForecastController');
const recCtrl = require('../controllers/recommendationController');
const pricingCtrl = require('../controllers/pricingController');
const analyticsCtrl = require('../controllers/analyticsController');
const twinCtrl = require('../controllers/batteryDigitalTwinController');
const congestionCtrl = require('../controllers/congestionController');
const gridCtrl = require('../controllers/gridLoadController');
const carbonCtrl = require('../controllers/carbonFootprintController');
const energyOptCtrl = require('../controllers/energyOptimizationController');
const allocCtrl = require('../controllers/slotAllocationController');
const mobilityCtrl = require('../controllers/mobilityAnalyticsController');
const batteryHealthCtrl = require('../controllers/batteryHealthController');
const schedCtrl = require('../controllers/predictiveSchedulingController');
const rangeSafetyCtrl = require('../controllers/rangeSafetyController');
const reviewCtrl = require('../controllers/communityReviewController');
const gamifyCtrl = require('../controllers/gamificationController');

// ── Smart Predictions (enhanced) ────────────────────────────
router.get('/predictions/:stationId', smartPredCtrl.getSmartPrediction);

// ── Demand Forecasting ──────────────────────────────────────
router.get('/demand/:stationId', demandCtrl.getForecast);
router.get('/demand/:stationId/today', demandCtrl.getTodayForecast);
router.post('/demand/:stationId/refresh', authenticate, authorize('admin', 'manager'), demandCtrl.refreshForecast);

// ── Smart Recommendations ───────────────────────────────────
router.get('/recommendations', recCtrl.recommendValidation, validate, recCtrl.getRecommendations);

// ── Dynamic Pricing ─────────────────────────────────────────
router.get('/pricing/:stationId', pricingCtrl.getSchedule);
router.get('/pricing/:stationId/current', pricingCtrl.getCurrentPrice);
router.get('/pricing/:stationId/estimate', pricingCtrl.estimateCost);
router.post('/pricing/:stationId/rules', authenticate, authorize('manager', 'admin'), pricingCtrl.ruleValidation, validate, pricingCtrl.createRule);
router.put('/pricing/rules/:ruleId', authenticate, authorize('manager', 'admin'), pricingCtrl.updateRule);
router.delete('/pricing/rules/:ruleId', authenticate, authorize('manager', 'admin'), pricingCtrl.deleteRule);

// ── Analytics ───────────────────────────────────────────────
router.get('/analytics/platform', authenticate, authorize('admin'), analyticsCtrl.getPlatformAnalytics);
router.get('/analytics/stations/:stationId', authenticate, authorize('admin', 'manager'), analyticsCtrl.getStationAnalytics);
router.post('/analytics/aggregate', authenticate, authorize('admin'), analyticsCtrl.triggerAggregation);

// ── Battery Digital Twin ────────────────────────────────────
router.get('/twin/session/:sessionId', twinCtrl.getTwinBySession);
router.post('/twin/session/:sessionId/simulate', authenticate, twinCtrl.simulateStep);
router.get('/twin/station/:stationId', twinCtrl.getStationTwins);

// ── Congestion Prediction ───────────────────────────────────
router.get('/congestion/:stationId', congestionCtrl.getCachedPredictions);
router.post('/congestion/:stationId/predict', authenticate, congestionCtrl.predictCongestion);

// ── Grid Load Balancing ─────────────────────────────────────
router.get('/grid/:stationId', gridCtrl.getGridProfile);
router.put('/grid/:stationId/settings', authenticate, authorize('manager', 'admin'), gridCtrl.updateGridSettings);

// ── Carbon Footprint ────────────────────────────────────────
router.get('/carbon/session/:sessionId', carbonCtrl.getSessionCarbon);
router.post('/carbon/session/:sessionId/record', authenticate, carbonCtrl.recordSessionCarbon);
router.get('/carbon/me', authenticate, carbonCtrl.getUserCarbon);
router.get('/carbon/station/:stationId', carbonCtrl.getStationCarbon);
router.get('/carbon/platform', authenticate, authorize('admin'), carbonCtrl.getPlatformCarbon);

// ── Energy Optimization ─────────────────────────────────────
router.get('/optimization/:stationId', energyOptCtrl.getStationRecommendations);
router.post('/optimization/:stationId/generate', authenticate, authorize('manager', 'admin'), energyOptCtrl.generateOptimizations);
router.get('/optimization/platform/summary', authenticate, authorize('admin'), energyOptCtrl.getPlatformSummary);
router.put('/optimization/recommendations/:recommendationId', authenticate, authorize('manager', 'admin'), energyOptCtrl.updateRecommendation);

// ── Autonomous Slot Allocation ────────────────────────────────
router.get('/allocation/:stationId/recommend', allocCtrl.recommendValidation, validate, allocCtrl.recommend);
router.get('/allocation/:stationId/queue', allocCtrl.getQueue);
router.get('/allocation/:stationId/queue/me', authenticate, allocCtrl.getMyQueueStatus);
router.post('/allocation/:stationId/queue', authenticate, allocCtrl.joinQueue);
router.delete('/allocation/:stationId/queue', authenticate, allocCtrl.leaveQueue);
router.post('/allocation/:stationId/process-queue', authenticate, authorize('manager', 'admin'), allocCtrl.processQueue);
router.get('/allocation/:stationId/reassignments', authenticate, allocCtrl.checkReassignments);

// ── Mobility Analytics ──────────────────────────────────────────
router.get('/mobility/heatmap', mobilityCtrl.getHeatmapData);
router.post('/mobility/heatmap/aggregate', authenticate, authorize('admin'), mobilityCtrl.aggregateHeatmap);
router.get('/mobility/behavior', mobilityCtrl.getBehaviorStats);
router.post('/mobility/behavior/aggregate', authenticate, authorize('admin'), mobilityCtrl.aggregateBehavior);
router.get('/mobility/trends', mobilityCtrl.getCityTrends);
router.post('/mobility/trends/aggregate', authenticate, authorize('admin'), mobilityCtrl.aggregateCityTrends);
router.get('/mobility/cities', mobilityCtrl.getAvailableCities);

// ── Infrastructure Planning ─────────────────────────────────────
router.post('/mobility/infrastructure/generate', authenticate, authorize('admin'), mobilityCtrl.generateInfraRecommendations);
router.get('/mobility/infrastructure', mobilityCtrl.getInfraRecommendations);
router.put('/mobility/infrastructure/:recId', authenticate, authorize('admin'), mobilityCtrl.updateInfraRecommendation);
router.get('/mobility/infrastructure/city/:city', mobilityCtrl.getCitySummary);

// ── Battery Health Prediction ───────────────────────────────────
router.get('/battery-health', authenticate, batteryHealthCtrl.getHealth);
router.post('/battery-health/analyze', authenticate, batteryHealthCtrl.analyzeHealth);
router.put('/battery-health/profile', authenticate, batteryHealthCtrl.updateProfile);
router.get('/battery-health/history', authenticate, batteryHealthCtrl.getHealthHistory);
router.get('/battery-health/recommendations', authenticate, batteryHealthCtrl.getRecommendations);
router.patch('/battery-health/recommendations/:recId/dismiss', authenticate, batteryHealthCtrl.dismissRecommendation);

// ── Predictive Scheduling ───────────────────────────────────────
router.post('/scheduling/find', authenticate, schedCtrl.findScheduleValidation, validate, schedCtrl.findOptimalSchedule);
router.get('/scheduling/quick', authenticate, schedCtrl.quickRecommend);
router.post('/scheduling/accept/:recId', authenticate, schedCtrl.acceptRecommendation);
router.get('/scheduling/my-recommendations', authenticate, schedCtrl.getMyRecommendations);
router.get('/scheduling/preferences', authenticate, schedCtrl.getPreferences);
router.put('/scheduling/preferences', authenticate, schedCtrl.updatePreferences);

// ── Range Safety Assistant ────────────────────────────────────────
router.get('/range-safety/profile', authenticate, rangeSafetyCtrl.getProfile);
router.put('/range-safety/profile', authenticate, rangeSafetyCtrl.updateProfile);
router.get('/range-safety/assess', authenticate, rangeSafetyCtrl.assessValidation, validate, rangeSafetyCtrl.assessRange);
router.post('/range-safety/trip-check', authenticate, rangeSafetyCtrl.tripCheckValidation, validate, rangeSafetyCtrl.checkTripSafety);
router.get('/range-safety/alerts', authenticate, rangeSafetyCtrl.getAlerts);
router.patch('/range-safety/alerts/:alertId/read', authenticate, rangeSafetyCtrl.markAlertRead);
router.post('/range-safety/alerts/read-all', authenticate, rangeSafetyCtrl.markAllAlertsRead);
router.get('/range-safety/stations-nearby', authenticate, rangeSafetyCtrl.getNearbyStations);
router.get('/range-safety/trip-history', authenticate, rangeSafetyCtrl.getTripHistory);

// ── Community Reviews & Reliability ───────────────────────────────
router.post('/reviews/:stationId', authenticate, reviewCtrl.createReviewValidation, validate, reviewCtrl.createReview);
router.get('/reviews/station/:stationId', reviewCtrl.getStationReviews);
router.get('/reviews/my', authenticate, reviewCtrl.getUserReviews);
router.delete('/reviews/:reviewId', authenticate, reviewCtrl.deleteReview);
router.post('/reviews/:reviewId/vote', authenticate, reviewCtrl.voteHelpful);
router.post('/reviews/:reviewId/report', authenticate, reviewCtrl.reportReview);
router.get('/reliability/leaderboard', reviewCtrl.getLeaderboard);
router.get('/reliability/:stationId', reviewCtrl.getReliabilityScore);
router.post('/reliability/:stationId/recalculate', authenticate, authorize('admin'), reviewCtrl.recalculateReliability);

// ── Gamification & Rewards ────────────────────────────────────────
router.get('/rewards/wallet', authenticate, gamifyCtrl.getWalletSummary);
router.get('/rewards/history', authenticate, gamifyCtrl.getPointsHistory);
router.get('/rewards/stats', authenticate, gamifyCtrl.getUserStats);
router.post('/rewards/award-session', authenticate, gamifyCtrl.awardSessionValidation, validate, gamifyCtrl.awardSessionPoints);
router.post('/rewards/award-review', authenticate, gamifyCtrl.awardReviewPoints);
router.get('/rewards/badges', authenticate, gamifyCtrl.getBadgeCatalog);
router.get('/rewards/catalog', gamifyCtrl.getRewardCatalog);
router.post('/rewards/redeem', authenticate, gamifyCtrl.redeemValidation, validate, gamifyCtrl.redeemReward);
router.get('/rewards/redemptions', authenticate, gamifyCtrl.getUserRedemptions);
router.get('/rewards/leaderboard', gamifyCtrl.getLeaderboard);

module.exports = router;

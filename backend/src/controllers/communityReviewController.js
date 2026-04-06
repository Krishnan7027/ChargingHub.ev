const { body, query, param } = require('express-validator');
const reviewService = require('../services/communityReviewService');

// ── Validation ────────────────────────────────────────────────

const createReviewValidation = [
  param('stationId').isUUID().withMessage('Valid station ID required'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Overall rating 1-5 required'),
  body('chargingSpeedRating').optional().isInt({ min: 1, max: 5 }),
  body('reliabilityRating').optional().isInt({ min: 1, max: 5 }),
  body('cleanlinessRating').optional().isInt({ min: 1, max: 5 }),
  body('waitTimeRating').optional().isInt({ min: 1, max: 5 }),
  body('comment').optional().isString().isLength({ max: 2000 }),
  body('wouldRecommend').optional().isBoolean(),
  body('visitDate').optional().isISO8601(),
  body('chargingTypeUsed').optional().isString(),
];

// ── Handlers ──────────────────────────────────────────────────

async function createReview(req, res, next) {
  try {
    const review = await reviewService.createReview(
      req.user.id, req.params.stationId, req.body,
    );
    res.status(201).json(review);
  } catch (err) {
    next(err);
  }
}

async function getStationReviews(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const sort = req.query.sort || 'recent';
    const result = await reviewService.getStationReviews(req.params.stationId, { page, limit, sort });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getUserReviews(req, res, next) {
  try {
    const reviews = await reviewService.getUserReviews(req.user.id);
    res.json({ reviews, count: reviews.length });
  } catch (err) {
    next(err);
  }
}

async function deleteReview(req, res, next) {
  try {
    const deleted = await reviewService.deleteReview(req.params.reviewId, req.user.id);
    if (!deleted) return res.status(404).json({ error: 'Review not found or not yours' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function voteHelpful(req, res, next) {
  try {
    const isHelpful = req.body.isHelpful !== false;
    const result = await reviewService.voteHelpful(req.params.reviewId, req.user.id, isHelpful);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function reportReview(req, res, next) {
  try {
    await reviewService.reportReview(req.params.reviewId, req.user.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function getReliabilityScore(req, res, next) {
  try {
    const result = await reviewService.getReliabilityScore(req.params.stationId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function recalculateReliability(req, res, next) {
  try {
    const result = await reviewService.calculateReliabilityScore(req.params.stationId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getLeaderboard(req, res, next) {
  try {
    const city = req.query.city || undefined;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const minReviews = parseInt(req.query.minReviews) || 3;
    const results = await reviewService.getReliabilityLeaderboard({ city, limit, minReviews });
    res.json({ stations: results, count: results.length });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createReviewValidation,
  createReview,
  getStationReviews,
  getUserReviews,
  deleteReview,
  voteHelpful,
  reportReview,
  getReliabilityScore,
  recalculateReliability,
  getLeaderboard,
};

const { body, param } = require('express-validator');
const gamificationService = require('../services/gamificationService');

// ── Validation ────────────────────────────────────────────────

const redeemValidation = [
  body('rewardId').isUUID().withMessage('Valid reward ID required'),
];

const awardSessionValidation = [
  body('sessionId').isUUID().withMessage('Valid session ID required'),
];

// ── Handlers ──────────────────────────────────────────────────

async function getWalletSummary(req, res, next) {
  try {
    const summary = await gamificationService.getWalletSummary(req.user.id);
    res.json(summary);
  } catch (err) {
    next(err);
  }
}

async function getPointsHistory(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 30, 100);
    const offset = parseInt(req.query.offset) || 0;
    const result = await gamificationService.getPointsHistory(req.user.id, { limit, offset });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function awardSessionPoints(req, res, next) {
  try {
    const result = await gamificationService.awardSessionPoints(req.user.id, req.body.sessionId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function awardReviewPoints(req, res, next) {
  try {
    const result = await gamificationService.awardReviewPoints(req.user.id, req.body.reviewId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getBadgeCatalog(req, res, next) {
  try {
    const badges = await gamificationService.getBadgeCatalog(req.user?.id);
    res.json({ badges, count: badges.length });
  } catch (err) {
    next(err);
  }
}

async function getRewardCatalog(req, res, next) {
  try {
    const rewards = await gamificationService.getRewardCatalog();
    res.json({ rewards, count: rewards.length });
  } catch (err) {
    next(err);
  }
}

async function redeemReward(req, res, next) {
  try {
    const result = await gamificationService.redeemReward(req.user.id, req.body.rewardId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getUserRedemptions(req, res, next) {
  try {
    const status = req.query.status || undefined;
    const redemptions = await gamificationService.getUserRedemptions(req.user.id, { status });
    res.json({ redemptions, count: redemptions.length });
  } catch (err) {
    next(err);
  }
}

async function getLeaderboard(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const leaders = await gamificationService.getLeaderboard({ limit });
    res.json({ leaders, count: leaders.length });
  } catch (err) {
    next(err);
  }
}

async function getUserStats(req, res, next) {
  try {
    const stats = await gamificationService.getUserStats(req.user.id);
    res.json(stats);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  redeemValidation,
  awardSessionValidation,
  getWalletSummary,
  getPointsHistory,
  awardSessionPoints,
  awardReviewPoints,
  getBadgeCatalog,
  getRewardCatalog,
  redeemReward,
  getUserRedemptions,
  getLeaderboard,
  getUserStats,
};

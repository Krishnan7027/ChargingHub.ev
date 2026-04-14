const { param } = require('express-validator');
const favoriteService = require('../services/favoriteService');

const stationIdValidation = [
  param('stationId').isUUID().withMessage('Valid station ID required'),
];

async function addFavorite(req, res, next) {
  try {
    const favorite = await favoriteService.addFavorite(req.user.id, req.params.stationId);
    res.status(201).json(favorite);
  } catch (err) {
    next(err);
  }
}

async function removeFavorite(req, res, next) {
  try {
    await favoriteService.removeFavorite(req.user.id, req.params.stationId);
    res.status(200).json({ message: 'Favorite removed' });
  } catch (err) {
    next(err);
  }
}

async function getUserFavorites(req, res, next) {
  try {
    const favorites = await favoriteService.getUserFavorites(req.user.id);
    res.json(favorites);
  } catch (err) {
    next(err);
  }
}

async function getFavoriteStatus(req, res, next) {
  try {
    const status = await favoriteService.getFavoriteStatus(req.user.id, req.params.stationId);
    res.json(status);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  stationIdValidation,
  addFavorite,
  removeFavorite,
  getUserFavorites,
  getFavoriteStatus,
};

const { Router } = require('express');
const favoriteController = require('../controllers/favoriteController');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = Router();

// List user's favorites
router.get('/', authenticate, favoriteController.getUserFavorites);

// Add a favorite
router.post(
  '/:stationId',
  authenticate,
  favoriteController.stationIdValidation,
  validate,
  favoriteController.addFavorite
);

// Remove a favorite
router.delete(
  '/:stationId',
  authenticate,
  favoriteController.stationIdValidation,
  validate,
  favoriteController.removeFavorite
);

// Check favorite status for a station
router.get(
  '/:stationId/status',
  authenticate,
  favoriteController.stationIdValidation,
  validate,
  favoriteController.getFavoriteStatus
);

module.exports = router;

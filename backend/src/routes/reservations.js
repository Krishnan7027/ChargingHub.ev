const { Router } = require('express');
const reservationController = require('../controllers/reservationController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = Router();

// Static routes first
router.post('/', authenticate, reservationController.createValidation, validate, reservationController.create);
router.get('/my', authenticate, reservationController.getUserReservations);
router.get('/station/:stationId', authenticate, authorize('manager', 'admin'), reservationController.getStationReservations);

// Parameterised routes
router.get('/:id', authenticate, reservationController.getDetails);
router.patch('/:id/cancel', authenticate, reservationController.cancel);

module.exports = router;

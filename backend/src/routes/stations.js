const { Router } = require('express');
const stationController = require('../controllers/stationController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = Router();

// --- Static routes MUST come before /:id to avoid parameter capture ---

// Public search routes
router.get('/nearby', stationController.nearbyValidation, validate, stationController.getNearby);
router.get('/search', stationController.search);

// Manager routes (static path segments before :id)
router.get('/manager/my-stations', authenticate, authorize('manager'), stationController.getManagerStations);
router.post('/', authenticate, authorize('manager'), stationController.createValidation, validate, stationController.create);

// Parameterised routes
router.get('/:id', stationController.getDetails);
router.get('/:id/predictions', stationController.getPredictions);
router.put('/:id', authenticate, authorize('manager'), stationController.update);

// Slot management
router.post('/:id/slots', authenticate, authorize('manager'), stationController.slotValidation, validate, stationController.addSlot);
router.put('/:id/slots/:slotId', authenticate, authorize('manager'), stationController.updateSlot);
router.delete('/:id/slots/:slotId', authenticate, authorize('manager'), stationController.deleteSlot);

// Admin routes
router.patch('/:id/approve', authenticate, authorize('admin'), stationController.approve);
router.patch('/:id/reject', authenticate, authorize('admin'), stationController.reject);
router.patch('/:id/disable', authenticate, authorize('admin'), stationController.disable);

module.exports = router;

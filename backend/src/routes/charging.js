const { Router } = require('express');
const chargingController = require('../controllers/chargingController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = Router();

// --- Static routes first ---
router.post('/start', authenticate, chargingController.startValidation, validate, chargingController.startSession);
router.get('/active', authenticate, chargingController.getActiveSessions);
router.get('/history', authenticate, chargingController.getUserHistory);
router.get('/history/stats', authenticate, chargingController.getUserStats);
router.get('/history/:sessionId', authenticate, chargingController.getHistoryDetail);
router.get('/station/:stationId', authenticate, authorize('manager', 'admin'), chargingController.getStationSessions);

// --- Parameterised routes after ---
router.get('/:id', authenticate, chargingController.getSessionDetails);
router.patch('/:id/progress', authenticate, authorize('manager'), chargingController.updateValidation, validate, chargingController.updateProgress);
router.patch('/:id/complete', authenticate, authorize('manager'), chargingController.completeSession);

module.exports = router;

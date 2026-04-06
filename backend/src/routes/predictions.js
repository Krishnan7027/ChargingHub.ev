const { Router } = require('express');
const { getSmartPrediction, predictForArrival, getDemandProfile } = require('../controllers/smartPredictionController');

const router = Router();

router.get('/stations/:stationId/next-available', getSmartPrediction);

// ETA-based prediction: predict availability at user's arrival time
router.get('/stations/:stationId/arrival', predictForArrival);

// Hourly demand profile
router.get('/demand-profile', getDemandProfile);

module.exports = router;

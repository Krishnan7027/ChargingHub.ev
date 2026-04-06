const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { registerVehicle, getUserVehicles, deregisterVehicle, simulatePlugEvent } = require('../controllers/plugChargeController');

router.use(authenticate);

// Register vehicle for Plug & Charge
router.post('/vehicles', [
  body('vehicleId').isString().trim().notEmpty().withMessage('Vehicle ID is required'),
  body('vehicleName').optional().isString().trim(),
  body('connectorType').optional().isIn(['type1', 'type2', 'ccs', 'chademo', 'tesla']),
  body('batteryCapacityKwh').optional().isFloat({ min: 10, max: 200 }),
  body('defaultTargetPercentage').optional().isInt({ min: 20, max: 100 }),
], validate, registerVehicle);

// Get my registered vehicles
router.get('/vehicles', getUserVehicles);

// Deregister a vehicle
router.delete('/vehicles/:vehicleId', deregisterVehicle);

// Simulate plug event (for testing — in production this comes via WebSocket from hardware)
router.post('/simulate-plug', [
  body('vehicleId').isString().trim().notEmpty(),
  body('slotId').isUUID(),
  body('currentBatteryPct').optional().isInt({ min: 0, max: 100 }),
], validate, simulatePlugEvent);

module.exports = router;

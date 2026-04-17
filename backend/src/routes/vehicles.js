const { Router } = require('express');
const evVehicleController = require('../controllers/evVehicleController');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = Router();

router.use(authenticate); // All vehicle routes need auth

router.post('/', evVehicleController.addValidation, validate, evVehicleController.addVehicle);
router.get('/', evVehicleController.getMyVehicles);
router.get('/:id', evVehicleController.getVehicle);
router.put('/:id', evVehicleController.addValidation, validate, evVehicleController.updateVehicle);
router.delete('/:id', evVehicleController.deleteVehicle);
router.patch('/:id/default', evVehicleController.setDefault);

module.exports = router;

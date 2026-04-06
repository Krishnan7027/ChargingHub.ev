const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const paymentController = require('../controllers/paymentController');

router.use(authenticate);

router.post('/', paymentController.createPaymentValidation, validate, paymentController.createPayment);
router.post('/:id/process', paymentController.processPayment);
router.post('/:id/refund', paymentController.refundPayment);
router.get('/my', paymentController.getUserPayments);
router.get('/estimate/:stationId', paymentController.estimateCost);
router.get('/:id', paymentController.getPayment);

module.exports = router;

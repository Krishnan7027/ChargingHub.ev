const { Router } = require('express');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = Router();

router.post('/register', authController.registerValidation, validate, authController.register);
router.post('/login', authController.loginValidation, validate, authController.login);
router.get('/profile', authenticate, authController.getProfile);
router.put('/profile', authenticate, authController.updateProfileValidation, validate, authController.updateProfile);
router.post('/change-password', authenticate, authController.changePasswordValidation, validate, authController.changePassword);

module.exports = router;

const { body } = require('express-validator');
const otpService = require('../services/otpService');

const otpController = {
  sendOtpValidation: [
    body('email').isEmail().withMessage('Valid email address required'),
  ],

  async sendOtp(req, res, next) {
    try {
      const result = await otpService.sendOTP({ email: req.body.email });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  verifyOtpValidation: [
    body('email').isEmail().withMessage('Valid email address required'),
    body('otp').isLength({ min: 6, max: 6 }).isNumeric().withMessage('OTP must be 6 digits'),
  ],

  async verifyOtp(req, res, next) {
    try {
      const result = await otpService.verifyOTP({ email: req.body.email, otp: req.body.otp });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = otpController;

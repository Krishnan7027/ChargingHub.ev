const { body } = require('express-validator');
const otpService = require('../services/otpService');

const otpController = {
  sendOtpValidation: [
    body('type').isIn(['email', 'mobile']).withMessage('Type must be email or mobile'),
    body('identifier').trim().notEmpty().withMessage('Email or mobile required'),
    body('identifier').custom((value, { req }) => {
      if (req.body.type === 'email') {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          throw new Error('Valid email address required');
        }
      } else if (req.body.type === 'mobile') {
        // Allow digits, +, spaces, hyphens. Min 10 digits.
        const digits = value.replace(/[\s\-\+\(\)]/g, '');
        if (!/^\d{10,15}$/.test(digits)) {
          throw new Error('Valid mobile number required (10-15 digits)');
        }
      }
      return true;
    }),
  ],

  async sendOtp(req, res, next) {
    try {
      const result = await otpService.sendOTP(req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  verifyOtpValidation: [
    body('identifier').trim().notEmpty().withMessage('Email or mobile required'),
    body('type').isIn(['email', 'mobile']).withMessage('Type must be email or mobile'),
    body('otp').isLength({ min: 6, max: 6 }).isNumeric().withMessage('OTP must be 6 digits'),
  ],

  async verifyOtp(req, res, next) {
    try {
      const result = await otpService.verifyOTP(req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = otpController;

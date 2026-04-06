const { body } = require('express-validator');
const authService = require('../services/authService');

const authController = {
  registerValidation: [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('fullName').trim().notEmpty().withMessage('Full name required'),
    body('phone').optional().isMobilePhone().withMessage('Valid phone number required'),
    body('role').optional().isIn(['customer', 'manager']).withMessage('Role must be customer or manager'),
  ],

  async register(req, res, next) {
    try {
      const result = await authService.register(req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },

  loginValidation: [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],

  async login(req, res, next) {
    try {
      const result = await authService.login(req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async getProfile(req, res, next) {
    try {
      const user = await authService.getProfile(req.user.id);
      res.json(user);
    } catch (err) {
      next(err);
    }
  },

  updateProfileValidation: [
    body('fullName').optional().trim().notEmpty(),
    body('phone').optional().isMobilePhone(),
    body('avatarUrl').optional().isURL(),
  ],

  async updateProfile(req, res, next) {
    try {
      const user = await authService.updateProfile(req.user.id, req.body);
      res.json(user);
    } catch (err) {
      next(err);
    }
  },

  changePasswordValidation: [
    body('currentPassword').notEmpty().withMessage('Current password required'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
  ],

  async changePassword(req, res, next) {
    try {
      await authService.changePassword(req.user.id, req.body);
      res.json({ message: 'Password changed successfully' });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = authController;

const { body } = require('express-validator');
const paymentService = require('../services/paymentService');

const paymentController = {
  createPaymentValidation: [
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be positive'),
    body('reservationId').optional().isUUID(),
    body('sessionId').optional().isUUID(),
    body('paymentMethod').optional().isIn(['card', 'wallet', 'upi']),
  ],

  async createPayment(req, res, next) {
    try {
      const payment = await paymentService.createPayment({
        userId: req.user.id, ...req.body,
      });
      res.status(201).json(payment);
    } catch (err) { next(err); }
  },

  async processPayment(req, res, next) {
    try {
      const result = await paymentService.processPayment(req.params.id, req.user.id, req.user.role);
      res.json(result);
    } catch (err) { next(err); }
  },

  async refundPayment(req, res, next) {
    try {
      const result = await paymentService.refundPayment(req.params.id, req.user.id, req.user.role);
      res.json(result);
    } catch (err) { next(err); }
  },

  async getPayment(req, res, next) {
    try {
      const payment = await paymentService.getPayment(req.params.id, req.user.id, req.user.role);
      if (!payment) return res.status(404).json({ error: 'Payment not found' });
      res.json(payment);
    } catch (err) { next(err); }
  },

  async getUserPayments(req, res, next) {
    try {
      const payments = await paymentService.getUserPayments(req.user.id, {
        status: req.query.status,
        limit: parseInt(req.query.limit) || 20,
        offset: parseInt(req.query.offset) || 0,
      });
      res.json(payments);
    } catch (err) { next(err); }
  },

  async estimateCost(req, res, next) {
    try {
      const estimate = await paymentService.estimateCost(
        req.params.stationId,
        parseInt(req.query.batteryPct) || 20,
        parseInt(req.query.targetPct) || 80,
        parseFloat(req.query.batteryCapacityKwh) || 60,
      );
      if (!estimate) return res.status(404).json({ error: 'Station not found' });
      res.json(estimate);
    } catch (err) { next(err); }
  },
};

module.exports = paymentController;

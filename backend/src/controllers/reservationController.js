const { body } = require('express-validator');
const reservationService = require('../services/reservationService');

const reservationController = {
  createValidation: [
    body('slotId').isUUID().withMessage('Valid slot ID required'),
    body('stationId').isUUID().withMessage('Valid station ID required'),
    body('scheduledStart').isISO8601().withMessage('Valid start time required (ISO 8601)'),
    body('scheduledEnd').isISO8601().withMessage('Valid end time required (ISO 8601)'),
    body('vehicleInfo').optional().isObject(),
    body('notes').optional().isString().isLength({ max: 500 }),
  ],

  async create(req, res, next) {
    try {
      const reservation = await reservationService.createReservation(req.user.id, req.body);
      res.status(201).json(reservation);
    } catch (err) {
      next(err);
    }
  },

  async getUserReservations(req, res, next) {
    try {
      const reservations = await reservationService.getUserReservations(req.user.id, req.query);
      res.json(reservations);
    } catch (err) {
      next(err);
    }
  },

  async getStationReservations(req, res, next) {
    try {
      const reservations = await reservationService.getStationReservations(
        req.params.stationId,
        req.user.id,
        req.query
      );
      res.json(reservations);
    } catch (err) {
      next(err);
    }
  },

  async getDetails(req, res, next) {
    try {
      const reservation = await reservationService.getReservationDetails(
        req.params.id,
        req.user.id,
        req.user.role
      );
      res.json(reservation);
    } catch (err) {
      next(err);
    }
  },

  async cancel(req, res, next) {
    try {
      const reservation = await reservationService.cancelReservation(req.params.id, req.user.id);
      res.json(reservation);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = reservationController;

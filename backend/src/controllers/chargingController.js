const { body } = require('express-validator');
const chargingService = require('../services/chargingService');

const chargingController = {
  startValidation: [
    body('slotId').isUUID(),
    body('startPercentage').isFloat({ min: 0, max: 100 }),
    body('targetPercentage').optional().isFloat({ min: 1, max: 100 }),
    body('reservationId').optional().isUUID(),
  ],

  async startSession(req, res, next) {
    try {
      const session = await chargingService.startSession({
        ...req.body,
        userId: req.user.id,
      });
      res.status(201).json(session);
    } catch (err) {
      next(err);
    }
  },

  updateValidation: [
    body('currentPercentage').isFloat({ min: 0, max: 100 }),
    body('energyDeliveredKwh').optional().isFloat({ min: 0 }),
    body('averagePowerKw').optional().isFloat({ min: 0 }),
    body('cost').optional().isFloat({ min: 0 }),
  ],

  async updateProgress(req, res, next) {
    try {
      const session = await chargingService.updateProgress(req.params.id, req.body);
      res.json(session);
    } catch (err) {
      next(err);
    }
  },

  async completeSession(req, res, next) {
    try {
      const session = await chargingService.completeSession(req.params.id);
      res.json(session);
    } catch (err) {
      next(err);
    }
  },

  async getActiveSessions(req, res, next) {
    try {
      const sessions = await chargingService.getActiveSessionsForUser(req.user.id);
      res.json(sessions);
    } catch (err) {
      next(err);
    }
  },

  async getSessionDetails(req, res, next) {
    try {
      const session = await chargingService.getSessionDetails(req.params.id, req.user.id, req.user.role);
      res.json(session);
    } catch (err) {
      next(err);
    }
  },

  async getStationSessions(req, res, next) {
    try {
      const sessions = await chargingService.getStationSessions(req.params.stationId, req.query);
      res.json(sessions);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = chargingController;

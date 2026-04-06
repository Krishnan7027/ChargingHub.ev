const { body, query } = require('express-validator');
const allocationService = require('../services/slotAllocationService');

const slotAllocationController = {
  // Validation for recommend endpoint
  recommendValidation: [
    query('batteryPercentage').isFloat({ min: 0, max: 100 }).withMessage('Battery percentage 0-100 required'),
    query('targetPercentage').optional().isFloat({ min: 1, max: 100 }),
    query('batteryCapacityKwh').optional().isFloat({ min: 1 }),
    query('preferredStart').optional().isISO8601(),
    query('connectorType').optional().isString(),
    query('chargingType').optional().isString(),
  ],

  /**
   * GET /intelligent/allocation/:stationId/recommend?batteryPercentage=18&targetPercentage=80
   * Returns the optimal slot recommendation with full scoring breakdown.
   */
  async recommend(req, res, next) {
    try {
      const result = await allocationService.recommendSlot(req.params.stationId, {
        batteryPercentage: parseFloat(req.query.batteryPercentage),
        targetPercentage: parseFloat(req.query.targetPercentage || '80'),
        batteryCapacityKwh: parseFloat(req.query.batteryCapacityKwh || '60'),
        preferredStart: req.query.preferredStart || null,
        connectorType: req.query.connectorType || null,
        chargingType: req.query.chargingType || null,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /intelligent/allocation/:stationId/queue
   * Join the waiting queue when all slots are occupied.
   */
  async joinQueue(req, res, next) {
    try {
      const result = await allocationService.joinQueue(req.user.id, req.params.stationId, {
        batteryPercentage: req.body.batteryPercentage,
        targetPercentage: req.body.targetPercentage,
        batteryCapacityKwh: req.body.batteryCapacityKwh,
        connectorType: req.body.connectorType,
        chargingType: req.body.chargingType,
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },

  /**
   * DELETE /intelligent/allocation/:stationId/queue
   * Leave the waiting queue.
   */
  async leaveQueue(req, res, next) {
    try {
      const result = await allocationService.leaveQueue(req.user.id, req.params.stationId);
      res.json(result || { message: 'Not in queue' });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /intelligent/allocation/:stationId/queue
   * Get the current queue for a station.
   */
  async getQueue(req, res, next) {
    try {
      const queue = await allocationService.getStationQueue(req.params.stationId);
      res.json({ stationId: req.params.stationId, queue, count: queue.length });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /intelligent/allocation/:stationId/queue/me
   * Get the current user's queue status.
   */
  async getMyQueueStatus(req, res, next) {
    try {
      const entry = await allocationService.getUserQueueStatus(req.user.id, req.params.stationId);
      res.json(entry || { inQueue: false });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /intelligent/allocation/:stationId/process-queue
   * Manually trigger queue processing (admin/manager).
   */
  async processQueue(req, res, next) {
    try {
      const result = await allocationService.processQueue(req.params.stationId);
      res.json(result || { message: 'No one in queue or no slot available' });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /intelligent/allocation/:stationId/reassignments
   * Check for dynamic reassignment opportunities.
   */
  async checkReassignments(req, res, next) {
    try {
      const reassignments = await allocationService.checkReassignment(req.params.stationId);
      res.json({ stationId: req.params.stationId, reassignments, count: reassignments.length });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = slotAllocationController;

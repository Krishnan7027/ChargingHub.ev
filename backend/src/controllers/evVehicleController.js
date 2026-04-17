const { body } = require('express-validator');
const evVehicleService = require('../services/evVehicleService');

const evVehicleController = {
  addValidation: [
    body('brand').trim().notEmpty().withMessage('Brand required'),
    body('model').trim().notEmpty().withMessage('Model required'),
    body('batteryCapacityKwh').optional().isFloat({ min: 1 }).withMessage('Battery capacity must be positive'),
    body('rangeKm').optional().isInt({ min: 1 }).withMessage('Range must be positive'),
    body('fastCharging').optional().isBoolean(),
    body('chargingPortType').optional().trim().notEmpty(),
    body('imageUrl').optional().isURL(),
  ],

  async addVehicle(req, res, next) {
    try {
      const vehicle = await evVehicleService.addVehicle(req.user.id, req.body);
      res.status(201).json(vehicle);
    } catch (err) {
      next(err);
    }
  },

  async getMyVehicles(req, res, next) {
    try {
      const vehicles = await evVehicleService.getUserVehicles(req.user.id);
      res.json(vehicles);
    } catch (err) {
      next(err);
    }
  },

  async getVehicle(req, res, next) {
    try {
      const vehicle = await evVehicleService.getVehicle(req.params.id);
      res.json(vehicle);
    } catch (err) {
      next(err);
    }
  },

  async updateVehicle(req, res, next) {
    try {
      const vehicle = await evVehicleService.updateVehicle(req.params.id, req.user.id, req.body);
      res.json(vehicle);
    } catch (err) {
      next(err);
    }
  },

  async deleteVehicle(req, res, next) {
    try {
      await evVehicleService.deleteVehicle(req.params.id, req.user.id);
      res.json({ message: 'Vehicle deleted' });
    } catch (err) {
      next(err);
    }
  },

  async setDefault(req, res, next) {
    try {
      const vehicle = await evVehicleService.setDefaultVehicle(req.user.id, req.params.id);
      res.json(vehicle);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = evVehicleController;

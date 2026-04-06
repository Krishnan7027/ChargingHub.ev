const { body, query } = require('express-validator');
const stationService = require('../services/stationService');
const predictionService = require('../services/predictionService');
const { validateOperatingHours } = require('../utils/operatingHours');

const stationController = {
  createValidation: [
    body('name').trim().notEmpty().withMessage('Station name required'),
    body('address').trim().notEmpty().withMessage('Address required'),
    body('city').trim().notEmpty().withMessage('City required'),
    body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required'),
    body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required'),
    body('pricingPerKwh').optional().isFloat({ min: 0 }),
    body('operatingHours').optional().isObject().custom((value) => {
      if (value) {
        const result = validateOperatingHours(value);
        if (!result.valid) throw new Error(result.error);
      }
      return true;
    }),
    body('amenities').optional().isArray(),
  ],

  async create(req, res, next) {
    try {
      const station = await stationService.createStation(req.user.id, req.body);
      res.status(201).json(station);
    } catch (err) {
      next(err);
    }
  },

  async getDetails(req, res, next) {
    try {
      const station = await stationService.getStationDetails(req.params.id);
      res.json(station);
    } catch (err) {
      next(err);
    }
  },

  nearbyValidation: [
    query('latitude').isFloat({ min: -90, max: 90 }),
    query('longitude').isFloat({ min: -180, max: 180 }),
    query('radiusKm').optional().isFloat({ min: 1, max: 100 }),
  ],

  async getNearby(req, res, next) {
    try {
      const { latitude, longitude, radiusKm, page, limit } = req.query;
      const stations = await stationService.getNearbyStations({
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        radiusKm: radiusKm ? parseFloat(radiusKm) : undefined,
        page: parseInt(page, 10) || 1,
        limit: parseInt(limit, 10) || 20,
      });
      res.json(stations);
    } catch (err) {
      next(err);
    }
  },

  async search(req, res, next) {
    try {
      const result = await stationService.searchStations(req.query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async getManagerStations(req, res, next) {
    try {
      const stations = await stationService.getManagerStations(req.user.id, req.query);
      res.json(stations);
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const station = await stationService.updateStation(req.params.id, req.user.id, req.body);
      res.json(station);
    } catch (err) {
      next(err);
    }
  },

  async approve(req, res, next) {
    try {
      const station = await stationService.approveStation(req.params.id, req.user.id);
      // Broadcast to managers
      const ws = req.app.get('ws');
      if (ws) ws.notifyManagers('station:approved', { stationId: station.id, name: station.name });
      res.json(station);
    } catch (err) {
      next(err);
    }
  },

  async reject(req, res, next) {
    try {
      const station = await stationService.rejectStation(req.params.id, req.user.id);
      const ws = req.app.get('ws');
      if (ws) ws.notifyManagers('station:rejected', { stationId: station.id, name: station.name });
      res.json(station);
    } catch (err) {
      next(err);
    }
  },

  async disable(req, res, next) {
    try {
      const station = await stationService.disableStation(req.params.id, req.user.id);
      const ws = req.app.get('ws');
      if (ws) ws.notifyManagers('station:disabled', { stationId: station.id, name: station.name });
      res.json(station);
    } catch (err) {
      next(err);
    }
  },

  slotValidation: [
    body('slotNumber').isInt({ min: 1 }),
    body('chargingType').isIn(['level1', 'level2', 'dc_fast']),
    body('connectorType').isIn(['type1', 'type2', 'ccs', 'chademo', 'tesla']),
    body('powerOutputKw').isFloat({ min: 0.1 }),
  ],

  async addSlot(req, res, next) {
    try {
      const slot = await stationService.addSlot(req.params.id, req.user.id, req.body);
      res.status(201).json(slot);
    } catch (err) {
      next(err);
    }
  },

  async updateSlot(req, res, next) {
    try {
      const slot = await stationService.updateSlot(req.params.slotId, req.user.id, req.body);
      res.json(slot);
    } catch (err) {
      next(err);
    }
  },

  async deleteSlot(req, res, next) {
    try {
      await stationService.deleteSlot(req.params.slotId, req.user.id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },

  // GET /stations/:id/predictions — Smart Slot Prediction
  async getPredictions(req, res, next) {
    try {
      const prediction = await predictionService.predictNextAvailable(req.params.id);
      res.json(prediction);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = stationController;

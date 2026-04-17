const EVVehicle = require('../models/EVVehicle');

const evVehicleService = {
  async addVehicle(userId, data) {
    const vehicle = await EVVehicle.create({ userId, ...data });

    // If first vehicle, set as default
    const allVehicles = await EVVehicle.findByUserId(userId);
    if (allVehicles.length === 1) {
      await EVVehicle.setDefault(userId, vehicle.id);
      return EVVehicle.findById(vehicle.id);
    }

    return vehicle;
  },

  async getUserVehicles(userId) {
    return EVVehicle.findByUserId(userId);
  },

  async getVehicle(id) {
    const vehicle = await EVVehicle.findById(id);
    if (!vehicle) {
      const err = new Error('Vehicle not found');
      err.statusCode = 404;
      throw err;
    }
    return vehicle;
  },

  async updateVehicle(id, userId, data) {
    const vehicle = await EVVehicle.findById(id);
    if (!vehicle) {
      const err = new Error('Vehicle not found');
      err.statusCode = 404;
      throw err;
    }
    if (vehicle.user_id !== userId) {
      const err = new Error('Not authorized');
      err.statusCode = 403;
      throw err;
    }
    return EVVehicle.update(id, data);
  },

  async deleteVehicle(id, userId) {
    const vehicle = await EVVehicle.findById(id);
    if (!vehicle) {
      const err = new Error('Vehicle not found');
      err.statusCode = 404;
      throw err;
    }
    if (vehicle.user_id !== userId) {
      const err = new Error('Not authorized');
      err.statusCode = 403;
      throw err;
    }
    return EVVehicle.delete(id);
  },

  async setDefaultVehicle(userId, vehicleId) {
    const vehicle = await EVVehicle.findById(vehicleId);
    if (!vehicle || vehicle.user_id !== userId) {
      const err = new Error('Vehicle not found');
      err.statusCode = 404;
      throw err;
    }
    await EVVehicle.setDefault(userId, vehicleId);
    return EVVehicle.findById(vehicleId);
  },
};

module.exports = evVehicleService;

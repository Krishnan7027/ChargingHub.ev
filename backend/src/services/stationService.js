const Station = require('../models/Station');
const ChargingSlot = require('../models/ChargingSlot');
const { logAudit } = require('../utils/auditLogger');

const stationService = {
  async createStation(managerId, data) {
    const station = await Station.create({ managerId, ...data });

    logAudit({
      userId: managerId,
      action: 'station.create',
      entityType: 'station',
      entityId: station.id,
      details: { name: station.name, city: station.city },
    });

    return station;
  },

  async getStationDetails(stationId) {
    const station = await Station.findById(stationId);
    if (!station) {
      const err = new Error('Station not found');
      err.statusCode = 404;
      throw err;
    }

    const slots = await ChargingSlot.findByStation(stationId);
    return { ...station, slots };
  },

  async getNearbyStations({ latitude, longitude, radiusKm, page, limit }) {
    return Station.findNearby({ latitude, longitude, radiusKm, page, limit });
  },

  async searchStations(params) {
    return Station.search(params);
  },

  async getManagerStations(managerId, params) {
    return Station.findByManager(managerId, params);
  },

  async updateStation(stationId, managerId, data) {
    const station = await Station.findById(stationId);
    if (!station) {
      const err = new Error('Station not found');
      err.statusCode = 404;
      throw err;
    }
    if (station.manager_id !== managerId) {
      const err = new Error('Not authorized to update this station');
      err.statusCode = 403;
      throw err;
    }

    const updated = await Station.update(stationId, data);

    logAudit({
      userId: managerId,
      action: 'station.update',
      entityType: 'station',
      entityId: stationId,
      details: { fields: Object.keys(data) },
    });

    return updated;
  },

  async approveStation(stationId, adminId) {
    const station = await Station.findById(stationId);
    if (!station) {
      const err = new Error('Station not found');
      err.statusCode = 404;
      throw err;
    }
    if (station.status !== 'pending') {
      const err = new Error(`Station is already ${station.status}`);
      err.statusCode = 400;
      throw err;
    }

    const updated = await Station.updateStatus(stationId, 'approved');

    logAudit({
      userId: adminId,
      action: 'station.approve',
      entityType: 'station',
      entityId: stationId,
      details: { name: station.name },
    });

    return updated;
  },

  async rejectStation(stationId, adminId) {
    const station = await Station.findById(stationId);
    if (!station) {
      const err = new Error('Station not found');
      err.statusCode = 404;
      throw err;
    }

    const updated = await Station.updateStatus(stationId, 'rejected');

    logAudit({
      userId: adminId,
      action: 'station.reject',
      entityType: 'station',
      entityId: stationId,
      details: { name: station.name },
    });

    return updated;
  },

  async disableStation(stationId, adminId) {
    const station = await Station.findById(stationId);
    if (!station) {
      const err = new Error('Station not found');
      err.statusCode = 404;
      throw err;
    }

    const updated = await Station.updateStatus(stationId, 'disabled');

    logAudit({
      userId: adminId,
      action: 'station.disable',
      entityType: 'station',
      entityId: stationId,
      details: { name: station.name },
    });

    return updated;
  },

  async addSlot(stationId, managerId, slotData) {
    const station = await Station.findById(stationId);
    if (!station) {
      const err = new Error('Station not found');
      err.statusCode = 404;
      throw err;
    }
    if (station.manager_id !== managerId) {
      const err = new Error('Not authorized');
      err.statusCode = 403;
      throw err;
    }

    const slot = await ChargingSlot.create({ stationId, ...slotData });

    logAudit({
      userId: managerId,
      action: 'slot.create',
      entityType: 'charging_slot',
      entityId: slot.id,
      details: { stationId, slotNumber: slot.slot_number },
    });

    return slot;
  },

  async updateSlot(slotId, managerId, data) {
    const slot = await ChargingSlot.findById(slotId);
    if (!slot) {
      const err = new Error('Slot not found');
      err.statusCode = 404;
      throw err;
    }

    const station = await Station.findById(slot.station_id);
    if (station.manager_id !== managerId) {
      const err = new Error('Not authorized');
      err.statusCode = 403;
      throw err;
    }
    return ChargingSlot.update(slotId, data);
  },

  async deleteSlot(slotId, managerId) {
    const slot = await ChargingSlot.findById(slotId);
    if (!slot) {
      const err = new Error('Slot not found');
      err.statusCode = 404;
      throw err;
    }

    const station = await Station.findById(slot.station_id);
    if (station.manager_id !== managerId) {
      const err = new Error('Not authorized');
      err.statusCode = 403;
      throw err;
    }

    if (slot.status === 'occupied' || slot.status === 'reserved') {
      const err = new Error('Cannot delete a slot that is currently in use');
      err.statusCode = 400;
      throw err;
    }

    await ChargingSlot.delete(slotId);

    logAudit({
      userId: managerId,
      action: 'slot.delete',
      entityType: 'charging_slot',
      entityId: slotId,
      details: { stationId: slot.station_id },
    });
  },
};

module.exports = stationService;

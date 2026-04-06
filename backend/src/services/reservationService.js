const Reservation = require('../models/Reservation');
const ChargingSlot = require('../models/ChargingSlot');
const Station = require('../models/Station');
const db = require('../config/database');
const { logAudit } = require('../utils/auditLogger');
const { publish, EVENTS } = require('../events/eventBus');

const reservationService = {
  async createReservation(userId, { slotId, stationId, scheduledStart, scheduledEnd, vehicleInfo, notes }) {
    // Validate time window before acquiring locks
    const start = new Date(scheduledStart);
    const end = new Date(scheduledEnd);
    if (end <= start) {
      const err = new Error('End time must be after start time');
      err.statusCode = 400;
      throw err;
    }
    if (start < new Date()) {
      const err = new Error('Cannot reserve in the past');
      err.statusCode = 400;
      throw err;
    }

    const station = await Station.findById(stationId);
    if (!station || station.status !== 'approved') {
      const err = new Error('Station is not available for reservations');
      err.statusCode = 400;
      throw err;
    }

    // Use a transaction with row-level locking to prevent double-booking
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Lock the slot row with FOR UPDATE to serialize concurrent bookings
      const slot = await ChargingSlot.findByIdForUpdate(slotId, client);
      if (!slot) {
        const err = new Error('Charging slot not found');
        err.statusCode = 404;
        throw err;
      }

      if (slot.status !== 'available') {
        const err = new Error(`Slot is currently ${slot.status}`);
        err.statusCode = 409;
        throw err;
      }

      const hasConflict = await Reservation.checkConflict(slotId, scheduledStart, scheduledEnd, null, client);
      if (hasConflict) {
        const err = new Error('Time slot is already reserved');
        err.statusCode = 409;
        throw err;
      }

      const reservation = await Reservation.create({
        userId,
        slotId,
        stationId,
        scheduledStart,
        scheduledEnd,
        vehicleInfo,
        notes,
      }, client);

      // AVAILABLE → RESERVED: stamp reserved_by + reserved_at on the slot
      const locked = await ChargingSlot.reserveSlot(slotId, userId, client);
      if (!locked) {
        // Another transaction beat us (shouldn't happen with FOR UPDATE, but defense-in-depth)
        const err = new Error('Slot was taken by another user');
        err.statusCode = 409;
        throw err;
      }

      await client.query('COMMIT');

      logAudit({
        userId,
        action: 'reservation.create',
        entityType: 'reservation',
        entityId: reservation.id,
        details: { stationId, slotId, scheduledStart, scheduledEnd },
      });

      const enriched = await Reservation.findById(reservation.id);

      // Publish domain event (subscribers handle WS notifications, cache invalidation)
      publish(EVENTS.RESERVATION_CREATED, {
        reservationId: enriched.id,
        userId,
        stationId: enriched.station_id,
        slotId: enriched.slot_id,
      }, {
        actorId: userId,
        entityType: 'reservation',
        entityId: enriched.id,
      }).catch(() => {});

      return enriched;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async getUserReservations(userId, params) {
    return Reservation.findByUser(userId, params);
  },

  async getStationReservations(stationId, managerId, params) {
    const station = await Station.findById(stationId);
    if (!station) {
      const err = new Error('Station not found');
      err.statusCode = 404;
      throw err;
    }
    if (station.manager_id !== managerId) {
      const err = new Error('Not authorized to view these reservations');
      err.statusCode = 403;
      throw err;
    }
    return Reservation.findByStation(stationId, params);
  },

  async cancelReservation(reservationId, userId) {
    const reservation = await Reservation.findById(reservationId);
    if (!reservation) {
      const err = new Error('Reservation not found');
      err.statusCode = 404;
      throw err;
    }
    if (reservation.user_id !== userId) {
      const err = new Error('Not authorized to cancel this reservation');
      err.statusCode = 403;
      throw err;
    }
    if (!['pending', 'confirmed'].includes(reservation.status)) {
      const err = new Error(`Cannot cancel a reservation with status "${reservation.status}"`);
      err.statusCode = 400;
      throw err;
    }

    const updated = await Reservation.updateStatus(reservationId, 'cancelled');
    await ChargingSlot.updateStatus(reservation.slot_id, 'available');

    logAudit({
      userId,
      action: 'reservation.cancel',
      entityType: 'reservation',
      entityId: reservationId,
    });

    // Publish domain event (subscribers handle cache invalidation, queue processing)
    publish(EVENTS.RESERVATION_CANCELLED, {
      reservationId: updated.id,
      userId,
      stationId: reservation.station_id,
      slotId: reservation.slot_id,
    }, {
      actorId: userId,
      entityType: 'reservation',
      entityId: reservationId,
    }).catch(() => {});

    return updated;
  },

  async getReservationDetails(reservationId, userId, userRole) {
    const reservation = await Reservation.findById(reservationId);
    if (!reservation) {
      const err = new Error('Reservation not found');
      err.statusCode = 404;
      throw err;
    }

    // Admins can see all
    if (userRole === 'admin') return reservation;
    // Owner can see their own
    if (reservation.user_id === userId) return reservation;
    // Station manager can see their station's reservations
    const station = await Station.findById(reservation.station_id);
    if (station && station.manager_id === userId) return reservation;

    const err = new Error('Not authorized');
    err.statusCode = 403;
    throw err;
  },
};

module.exports = reservationService;

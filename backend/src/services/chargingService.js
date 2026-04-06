const ChargingSession = require('../models/ChargingSession');
const ChargingSlot = require('../models/ChargingSlot');
const Reservation = require('../models/Reservation');
const predictionService = require('./predictionService');
const db = require('../config/database');
const { logAudit } = require('../utils/auditLogger');
const { publish, EVENTS } = require('../events/eventBus');

const chargingService = {
  /**
   * Start a new charging session for a slot.
   * Optionally tied to an existing reservation.
   * Uses a transaction with row-level locking to prevent double-session creation.
   */
  async startSession({ reservationId, slotId, userId, startPercentage, targetPercentage }) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Lock the slot row to prevent concurrent session starts
      const slot = await ChargingSlot.findByIdForUpdate(slotId, client);
      if (!slot) {
        const err = new Error('Slot not found');
        err.statusCode = 404;
        throw err;
      }

      if (slot.status !== 'available' && slot.status !== 'reserved') {
        const err = new Error(`Slot is currently ${slot.status}`);
        err.statusCode = 409;
        throw err;
      }

      // RESERVED → OCCUPIED: only the user who reserved can start a session
      if (slot.status === 'reserved') {
        if (slot.reserved_by && slot.reserved_by !== userId) {
          const err = new Error('Slot is reserved by another user');
          err.statusCode = 403;
          throw err;
        }
      }

      const existingSession = await ChargingSession.findActiveBySlot(slotId, client);
      if (existingSession) {
        const err = new Error('Slot already has an active charging session');
        err.statusCode = 409;
        throw err;
      }

      const session = await ChargingSession.create({
        reservationId,
        slotId,
        userId,
        startPercentage,
        targetPercentage,
      }, client);

      await ChargingSlot.updateStatus(slotId, 'occupied', session.id, client);

      if (reservationId) {
        await Reservation.updateStatus(reservationId, 'active', client);
      }

      await client.query('COMMIT');

      logAudit({
        userId,
        action: 'charging.start',
        entityType: 'charging_session',
        entityId: session.id,
        details: { slotId, startPercentage, targetPercentage },
      });

      const enriched = await ChargingSession.findById(session.id);

      // Publish domain event (subscribers handle WS notifications, cache invalidation)
      publish(EVENTS.CHARGING_STARTED, {
        sessionId: enriched.id,
        userId,
        stationId: enriched.station_id,
        slotId: enriched.slot_id,
      }, {
        actorId: userId,
        entityType: 'charging_session',
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

  /**
   * Update the live progress of a charging session (called by manager / charger hardware).
   */
  async updateProgress(sessionId, { currentPercentage, energyDeliveredKwh, averagePowerKw, cost }) {
    const session = await ChargingSession.findById(sessionId);
    if (!session) {
      const err = new Error('Session not found');
      err.statusCode = 404;
      throw err;
    }

    if (session.status !== 'charging') {
      const err = new Error('Session is not actively charging');
      err.statusCode = 400;
      throw err;
    }

    const updated = await ChargingSession.updateProgress({
      id: sessionId,
      currentPercentage,
      energyDeliveredKwh,
      averagePowerKw,
      cost,
    });

    // Re-fetch with enriched ETA
    return ChargingSession.findById(sessionId);
  },

  /**
   * Mark a session as complete. Frees the slot and records usage history.
   */
  async completeSession(sessionId) {
    const session = await ChargingSession.findById(sessionId);
    if (!session) {
      const err = new Error('Session not found');
      err.statusCode = 404;
      throw err;
    }

    if (session.status !== 'charging') {
      const err = new Error('Session is not actively charging');
      err.statusCode = 400;
      throw err;
    }

    const completed = await ChargingSession.complete(sessionId);
    await ChargingSlot.updateStatus(session.slot_id, 'available', null);

    if (session.reservation_id) {
      await Reservation.updateStatus(session.reservation_id, 'completed');
    }

    // Record usage for smart predictions
    if (session.started_at) {
      const durationMin = (Date.now() - new Date(session.started_at).getTime()) / 60_000;
      try {
        await predictionService.recordUsage(
          session.slot_id,
          session.station_id,
          durationMin,
          parseFloat(session.energy_delivered_kwh || 0)
        );
      } catch (err) {
        console.error('Failed to record usage history:', err.message);
      }
    }

    logAudit({
      userId: session.user_id,
      action: 'charging.complete',
      entityType: 'charging_session',
      entityId: sessionId,
      details: {
        energyDeliveredKwh: completed.energy_delivered_kwh,
        cost: completed.cost,
      },
    });

    // Fire-and-forget: auto-record carbon footprint for completed session
    try {
      const carbonService = require('./carbonFootprintService');
      carbonService.recordSessionCarbon(sessionId).catch(() => {});
    } catch { /* service may not exist yet */ }

    // Publish domain event (subscribers handle WS notifications, cache invalidation,
    // queue assignment, and notification enqueuing)
    publish(EVENTS.CHARGING_COMPLETED, {
      sessionId: completed.id,
      userId: session.user_id,
      stationId: session.station_id,
      slotId: session.slot_id,
      energyDeliveredKwh: completed.energy_delivered_kwh,
      cost: completed.cost,
    }, {
      actorId: session.user_id,
      entityType: 'charging_session',
      entityId: completed.id,
    }).catch(() => {});

    return completed;
  },

  async getActiveSessionsForUser(userId) {
    return ChargingSession.findActiveByUser(userId);
  },

  async getSessionDetails(sessionId, userId, role) {
    const session = await ChargingSession.findById(sessionId);
    if (!session) {
      const err = new Error('Session not found');
      err.statusCode = 404;
      throw err;
    }
    if (session.user_id !== userId && role !== 'admin') {
      const err = new Error('Not authorized');
      err.statusCode = 403;
      throw err;
    }
    return session;
  },

  async getStationSessions(stationId, params) {
    return ChargingSession.findByStation(stationId, params);
  },
};

module.exports = chargingService;

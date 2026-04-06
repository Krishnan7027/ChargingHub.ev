const { on, EVENTS } = require('./eventBus');
const { caches } = require('../utils/cache');

/**
 * Register all event subscribers.
 * Called once during server startup, after WebSocket is initialized.
 */
function registerSubscribers(wsHandlers) {
  // ── RESERVATION EVENTS ──────────────────────────────────────

  on(EVENTS.RESERVATION_CREATED, async (event) => {
    const { userId, stationId, slotId, reservationId } = event.payload;
    if (wsHandlers && stationId) {
      wsHandlers.notifyStation(stationId, 'slot:statusChanged', {
        slotId, status: 'reserved', updatedAt: event.timestamp,
      });
    }
    if (wsHandlers && userId) {
      wsHandlers.notifyUser(userId, 'reservation:updated', {
        reservationId, status: 'confirmed', stationId,
      });
    }
    caches.prediction.delete(`prediction:${stationId}`);
    caches.congestion.invalidatePrefix(`congestion:${stationId}`);
  });

  on(EVENTS.RESERVATION_CANCELLED, async (event) => {
    const { stationId, slotId, userId, reservationId } = event.payload;
    // Notify station subscribers about freed slot
    if (wsHandlers && stationId) {
      wsHandlers.notifyStation(stationId, 'slot:statusChanged', {
        slotId, status: 'available', updatedAt: event.timestamp,
      });
    }
    if (wsHandlers && userId) {
      if (typeof wsHandlers.notifyReservationUpdate === 'function') {
        wsHandlers.notifyReservationUpdate(userId, stationId, {
          id: reservationId, status: 'cancelled', stationId,
        });
      }
    }
    // Trigger queue processing — a slot just freed up
    try {
      const { queueAssignmentQueue } = require('../jobs/queues');
      await queueAssignmentQueue.add('process-after-cancel', { stationId }, { delay: 2000 });
    } catch (err) {
      console.error('[subscriber] Failed to enqueue queue assignment:', err.message);
    }
    caches.prediction.delete(`prediction:${stationId}`);
    caches.congestion.invalidatePrefix(`congestion:${stationId}`);
  });

  on(EVENTS.RESERVATION_EXPIRED, async (event) => {
    const { stationId, userId, reservationId } = event.payload;
    if (wsHandlers && userId) {
      wsHandlers.notifyUser(userId, 'reservation:updated', {
        reservationId, status: 'expired',
      });
    }
    try {
      const { queueAssignmentQueue } = require('../jobs/queues');
      await queueAssignmentQueue.add('process-after-expiry', { stationId }, { delay: 1000 });
    } catch (err) {
      console.error('[subscriber] Failed to enqueue queue assignment:', err.message);
    }
  });

  // ── CHARGING EVENTS ─────────────────────────────────────────

  on(EVENTS.CHARGING_STARTED, async (event) => {
    const { userId, stationId, sessionId, slotId } = event.payload;
    if (wsHandlers && stationId) {
      wsHandlers.notifyStation(stationId, 'slot:statusChanged', {
        slotId, status: 'occupied', sessionId,
        updatedAt: event.timestamp,
      });
    }
    if (wsHandlers && userId) {
      wsHandlers.notifyUser(userId, 'charging:update', {
        sessionId, status: 'charging', message: 'Charging session started',
      });
    }
    caches.prediction.delete(`prediction:${stationId}`);
    caches.grid.delete(`grid:${stationId}`);
  });

  on(EVENTS.CHARGING_COMPLETED, async (event) => {
    const { userId, stationId, sessionId, slotId, energyDeliveredKwh, cost } = event.payload;
    if (wsHandlers) {
      if (stationId) {
        wsHandlers.notifyStation(stationId, 'slot:statusChanged', {
          slotId, status: 'available', sessionId: null,
          updatedAt: event.timestamp,
        });
      }
      wsHandlers.notifyUser(userId, 'charging:completed', {
        sessionId, energyDeliveredKwh, cost,
      });
      wsHandlers.notifyAdmins('charging:completed', {
        sessionId, stationId, energyDeliveredKwh, cost,
      });
    }

    // Trigger queue processing — slot freed
    try {
      const { queueAssignmentQueue } = require('../jobs/queues');
      await queueAssignmentQueue.add('process-after-complete', { stationId }, { delay: 1000 });
    } catch (err) {
      console.error('[subscriber] Failed to enqueue queue assignment:', err.message);
    }

    // Send notification
    try {
      const { notificationQueue } = require('../jobs/queues');
      await notificationQueue.add('charging-complete', {
        userId,
        type: 'charging_complete',
        title: 'Charging Complete',
        message: `Session complete. ${energyDeliveredKwh || 0} kWh delivered. Cost: $${cost || 0}.`,
        metadata: { sessionId, stationId },
      });
    } catch (err) {
      console.error('[subscriber] Failed to enqueue notification:', err.message);
    }

    caches.prediction.delete(`prediction:${stationId}`);
    caches.congestion.invalidatePrefix(`congestion:${stationId}`);
    caches.grid.delete(`grid:${stationId}`);
  });

  // ── PAYMENT EVENTS ──────────────────────────────────────────

  on(EVENTS.PAYMENT_COMPLETED, async (event) => {
    const { userId, amount } = event.payload;
    if (wsHandlers && userId) {
      wsHandlers.notifyUser(userId, 'payment:completed', {
        amount, completedAt: event.timestamp,
      });
    }
  });

  on(EVENTS.PAYMENT_FAILED, async (event) => {
    const { userId } = event.payload;
    if (wsHandlers && userId) {
      wsHandlers.notifyUser(userId, 'payment:failed', event.payload);
    }
  });

  // ── PLUG & CHARGE EVENTS ────────────────────────────────────

  on(EVENTS.VEHICLE_PLUGGED, async (event) => {
    const userId = event.actorId;
    const { vehicleId, slotId, sessionId } = event.payload;
    if (wsHandlers && userId) {
      wsHandlers.notifyUser(userId, 'plugcharge:started', {
        vehicleId, slotId, sessionId,
        message: 'Plug & Charge: Charging started automatically.',
      });
    }
    try {
      const { notificationQueue } = require('../jobs/queues');
      await notificationQueue.add('plug-charge-started', {
        userId,
        type: 'plug_charge',
        title: 'Plug & Charge Active',
        message: 'Your vehicle was detected and charging has started automatically.',
        metadata: { vehicleId, slotId, sessionId },
      });
    } catch (err) {
      console.error('[subscriber] Failed to enqueue plug & charge notification:', err.message);
    }
  });

  // ── USER EVENTS ─────────────────────────────────────────────

  on(EVENTS.USER_REGISTERED, async (event) => {
    const { userId } = event.payload;
    try {
      const { notificationQueue } = require('../jobs/queues');
      await notificationQueue.add('welcome', {
        userId,
        type: 'welcome',
        title: 'Welcome to EV Charge Hub!',
        message: 'Start by finding nearby charging stations on the map.',
        metadata: {},
      });
    } catch (err) {
      console.error('[subscriber] Failed to enqueue welcome notification:', err.message);
    }
  });

  console.log('[events] All subscribers registered');
}

module.exports = { registerSubscribers };

const jwt = require('jsonwebtoken');
const env = require('../config/env');

function setupWebSocket(io) {
  // Authentication middleware for socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const decoded = jwt.verify(token, env.jwt.secret);
      socket.user = decoded;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.id} (${socket.user.role})`);

    // Join user-specific room
    socket.join(`user:${socket.user.id}`);

    // Join role-based rooms
    if (socket.user.role === 'manager') {
      socket.join('managers');
    }
    if (socket.user.role === 'admin') {
      socket.join('admins');
    }

    // ── Station subscription ─────────────────────────────────
    socket.on('subscribe:station', (stationId) => {
      socket.join(`station:${stationId}`);
    });

    socket.on('unsubscribe:station', (stationId) => {
      socket.leave(`station:${stationId}`);
    });

    // ── Charging progress (from manager/charger hardware) ────
    socket.on('charging:progress', (data) => {
      if (socket.user.role !== 'manager') return;

      const { sessionId, stationId, slotId, currentPercentage, energyDeliveredKwh, cost } = data;

      // Broadcast to station subscribers
      io.to(`station:${stationId}`).emit('slot:updated', {
        slotId,
        stationId,
        currentPercentage,
        energyDeliveredKwh,
        cost,
        updatedAt: new Date().toISOString(),
      });

      // Notify the specific user who owns the session
      if (data.userId) {
        io.to(`user:${data.userId}`).emit('charging:update', {
          sessionId,
          currentPercentage,
          energyDeliveredKwh,
          cost,
        });
      }
    });

    // ── Slot status change ───────────────────────────────────
    socket.on('slot:statusChange', (data) => {
      if (socket.user.role !== 'manager') return;

      const { stationId, slotId, status } = data;
      io.to(`station:${stationId}`).emit('slot:statusChanged', {
        slotId,
        status,
        updatedAt: new Date().toISOString(),
      });
    });

    // ── Plug & Charge: hardware reports vehicle plugged in ──
    socket.on('vehicle:plugged', async (data) => {
      if (socket.user.role !== 'manager') return;

      const { vehicleId, slotId, currentBatteryPct } = data;
      try {
        const plugChargeService = require('../services/plugChargeService');
        const result = await plugChargeService.handlePlugEvent(
          vehicleId, slotId, currentBatteryPct || 20
        );

        if (result.success) {
          const stationId = result.session?.station_id;

          // Notify station subscribers
          if (stationId) {
            io.to(`station:${stationId}`).emit('slot:statusChanged', {
              slotId,
              status: 'occupied',
              updatedAt: new Date().toISOString(),
            });
          }

          // Notify the vehicle owner
          if (result.vehicle?.userId) {
            io.to(`user:${result.vehicle.userId}`).emit('plugcharge:started', {
              vehicleId,
              slotId,
              sessionId: result.session?.id,
              message: result.message,
            });
          }
        }

        // Acknowledge to the manager/hardware
        socket.emit('vehicle:plugged:ack', result);
      } catch (err) {
        socket.emit('vehicle:plugged:ack', {
          success: false, reason: 'error', message: err.message,
        });
      }
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user.id}`);
    });
  });

  // ── Emit helpers for use from controllers/services ─────────

  return {
    // Core notifications
    notifyUser(userId, event, data) {
      io.to(`user:${userId}`).emit(event, data);
    },

    notifyStation(stationId, event, data) {
      io.to(`station:${stationId}`).emit(event, data);
    },

    notifyAdmins(event, data) {
      io.to('admins').emit(event, data);
    },

    notifyManagers(event, data) {
      io.to('managers').emit(event, data);
    },

    // ── Digital Twin updates ───────────────────────────────
    emitTwinUpdate(stationId, sessionId, twinData) {
      io.to(`station:${stationId}`).emit('twin:updated', {
        sessionId,
        ...twinData,
        updatedAt: new Date().toISOString(),
      });
    },

    // ── Queue / Slot Allocation ────────────────────────────
    emitQueueUpdate(stationId, queueData) {
      io.to(`station:${stationId}`).emit('queue:updated', {
        stationId,
        ...queueData,
        updatedAt: new Date().toISOString(),
      });
    },

    notifyQueueAssignment(userId, assignmentData) {
      io.to(`user:${userId}`).emit('queue:assigned', {
        ...assignmentData,
        assignedAt: new Date().toISOString(),
      });
    },

    // ── Gamification ───────────────────────────────────────
    notifyPointsAwarded(userId, pointsData) {
      io.to(`user:${userId}`).emit('points:awarded', {
        ...pointsData,
        awardedAt: new Date().toISOString(),
      });
    },

    notifyBadgeEarned(userId, badgeData) {
      io.to(`user:${userId}`).emit('badge:earned', {
        ...badgeData,
        earnedAt: new Date().toISOString(),
      });
    },

    notifyLevelUp(userId, levelData) {
      io.to(`user:${userId}`).emit('level:up', {
        ...levelData,
        achievedAt: new Date().toISOString(),
      });
    },

    // ── Range Safety Alerts ────────────────────────────────
    notifyRangeAlert(userId, alertData) {
      io.to(`user:${userId}`).emit('range:alert', {
        ...alertData,
        createdAt: new Date().toISOString(),
      });
    },

    // ── Congestion / Grid alerts ───────────────────────────
    emitCongestionUpdate(stationId, congestionData) {
      io.to(`station:${stationId}`).emit('congestion:updated', {
        stationId,
        ...congestionData,
        updatedAt: new Date().toISOString(),
      });
    },

    emitGridAlert(stationId, gridData) {
      io.to(`station:${stationId}`).emit('grid:alert', {
        stationId,
        ...gridData,
        updatedAt: new Date().toISOString(),
      });
    },

    // ── Reservation events ─────────────────────────────────
    notifyReservationUpdate(userId, stationId, reservationData) {
      io.to(`user:${userId}`).emit('reservation:updated', reservationData);
      io.to(`station:${stationId}`).emit('reservation:changed', reservationData);
    },
  };
}

module.exports = { setupWebSocket };

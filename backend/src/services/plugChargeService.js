const db = require('../config/database');
const chargingService = require('./chargingService');
const { publish, EVENTS } = require('../events/eventBus');

const plugChargeService = {
  async registerVehicle(userId, { vehicleId, vehicleName, connectorType, batteryCapacityKwh, defaultTargetPercentage }) {
    const { rows } = await db.query(
      `INSERT INTO plug_charge_vehicles
         (user_id, vehicle_id, vehicle_name, connector_type, battery_capacity_kwh, default_target_percentage)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (vehicle_id) DO UPDATE SET
         user_id = EXCLUDED.user_id, vehicle_name = EXCLUDED.vehicle_name,
         connector_type = EXCLUDED.connector_type, battery_capacity_kwh = EXCLUDED.battery_capacity_kwh,
         default_target_percentage = EXCLUDED.default_target_percentage,
         is_active = true, updated_at = NOW()
       RETURNING *`,
      [userId, vehicleId, vehicleName || null, connectorType || null,
       batteryCapacityKwh || 60, defaultTargetPercentage || 80]
    );
    return formatVehicle(rows[0]);
  },

  async getUserVehicles(userId) {
    const { rows } = await db.query(
      'SELECT * FROM plug_charge_vehicles WHERE user_id = $1 AND is_active = true ORDER BY created_at DESC',
      [userId]
    );
    return rows.map(formatVehicle);
  },

  async deregisterVehicle(userId, vehicleId) {
    const { rows } = await db.query(
      `UPDATE plug_charge_vehicles SET is_active = false, updated_at = NOW()
       WHERE user_id = $1 AND vehicle_id = $2 AND is_active = true RETURNING *`,
      [userId, vehicleId]
    );
    return rows[0] ? formatVehicle(rows[0]) : null;
  },

  /**
   * Handle a vehicle plug event from station hardware.
   * Looks up the vehicle, authenticates, and auto-starts a charging session.
   */
  async handlePlugEvent(vehicleId, slotId, currentBatteryPct = 20) {
    const { rows: vehicles } = await db.query(
      'SELECT * FROM plug_charge_vehicles WHERE vehicle_id = $1 AND is_active = true',
      [vehicleId]
    );
    if (vehicles.length === 0) {
      return { success: false, reason: 'vehicle_not_registered', message: 'Vehicle not registered for Plug & Charge' };
    }

    const vehicle = vehicles[0];

    const { rows: slots } = await db.query('SELECT * FROM charging_slots WHERE id = $1', [slotId]);
    if (slots.length === 0) {
      return { success: false, reason: 'slot_not_found', message: 'Charging slot not found' };
    }

    const slot = slots[0];
    if (slot.status !== 'available' && slot.status !== 'reserved') {
      return { success: false, reason: 'slot_unavailable', message: `Slot is currently ${slot.status}` };
    }

    // If reserved, check if this user owns the reservation
    if (slot.status === 'reserved') {
      const { rows: reservations } = await db.query(
        `SELECT id FROM reservations WHERE slot_id = $1 AND user_id = $2 AND status IN ('confirmed', 'pending')
         ORDER BY scheduled_start ASC LIMIT 1`,
        [slotId, vehicle.user_id]
      );
      if (reservations.length === 0) {
        return { success: false, reason: 'slot_reserved_by_other', message: 'Slot is reserved by another user' };
      }
      try {
        const session = await chargingService.startSession({
          reservationId: reservations[0].id, slotId, userId: vehicle.user_id,
          startPercentage: currentBatteryPct,
          targetPercentage: Number(vehicle.default_target_percentage) || 80,
        });
        publish(EVENTS.VEHICLE_PLUGGED, {
          vehicleId, slotId, sessionId: session?.id,
        }, {
          actorId: vehicle.user_id,
          entityType: 'charging_session',
          entityId: session?.id,
        }).catch(() => {});
        return { success: true, autoStarted: true, session, vehicle: formatVehicle(vehicle),
          reservationId: reservations[0].id, message: 'Plug & Charge: Session auto-started with reservation' };
      } catch (err) {
        return { success: false, reason: 'session_start_failed', message: err.message };
      }
    }

    // Slot available — auto-start
    try {
      const session = await chargingService.startSession({
        reservationId: null, slotId, userId: vehicle.user_id,
        startPercentage: currentBatteryPct,
        targetPercentage: Number(vehicle.default_target_percentage) || 80,
      });
      publish(EVENTS.VEHICLE_PLUGGED, {
        vehicleId, slotId, sessionId: session?.id,
      }, {
        actorId: vehicle.user_id,
        entityType: 'charging_session',
        entityId: session?.id,
      }).catch(() => {});
      return { success: true, autoStarted: true, session, vehicle: formatVehicle(vehicle),
        message: 'Plug & Charge: Session auto-started' };
    } catch (err) {
      return { success: false, reason: 'session_start_failed', message: err.message };
    }
  },
};

function formatVehicle(row) {
  return {
    id: row.id, userId: row.user_id, vehicleId: row.vehicle_id, vehicleName: row.vehicle_name,
    connectorType: row.connector_type, batteryCapacityKwh: Number(row.battery_capacity_kwh),
    defaultTargetPercentage: Number(row.default_target_percentage), isActive: row.is_active,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

module.exports = plugChargeService;

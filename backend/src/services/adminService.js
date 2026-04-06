const User = require('../models/User');
const Station = require('../models/Station');
const db = require('../config/database');
const { logAudit } = require('../utils/auditLogger');
const { NotFoundError, BadRequestError } = require('../utils/errors');

const adminService = {
  /**
   * List all users with optional filters.
   */
  async getUsers(filters) {
    return User.findAll(filters);
  },

  /**
   * Toggle a user's active status (enable/disable).
   * Admin accounts cannot be disabled.
   */
  async toggleUserStatus(userId, adminId, ipAddress) {
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    if (user.role === 'admin') {
      throw new BadRequestError('Cannot disable admin accounts');
    }

    const newStatus = !user.is_active;
    const updated = await User.update(userId, { is_active: newStatus });

    logAudit({
      userId: adminId,
      action: newStatus ? 'user.enable' : 'user.disable',
      entityType: 'user',
      entityId: userId,
      details: { targetEmail: user.email, targetRole: user.role },
      ipAddress,
    });

    return updated;
  },

  /**
   * Delete a user account. Admin accounts cannot be deleted.
   */
  async deleteUser(userId, adminId, ipAddress) {
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User');
    }
    if (user.role === 'admin') {
      throw new BadRequestError('Cannot delete admin accounts');
    }

    await User.delete(userId);

    logAudit({
      userId: adminId,
      action: 'user.delete',
      entityType: 'user',
      entityId: userId,
      details: { targetEmail: user.email },
      ipAddress,
    });
  },

  /**
   * Update a user's role. Only customer and manager roles are allowed.
   * Admin role cannot be changed.
   */
  async updateUserRole(userId, newRole, adminId, ipAddress) {
    if (!['customer', 'manager'].includes(newRole)) {
      throw new BadRequestError('Role must be customer or manager');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User');
    }
    if (user.role === 'admin') {
      throw new BadRequestError('Cannot change admin role');
    }

    const updated = await User.updateRole(userId, newRole);

    logAudit({
      userId: adminId,
      action: 'user.changeRole',
      entityType: 'user',
      entityId: userId,
      details: { oldRole: user.role, newRole },
      ipAddress,
    });

    return updated;
  },

  /**
   * Get all stations (admin view).
   */
  async getAllStations(filters) {
    return Station.findAll(filters);
  },

  /**
   * Get aggregated platform statistics across users, stations, slots,
   * reservations, and charging sessions.
   */
  async getPlatformStats() {
    const { rows } = await db.query(`
      WITH user_stats AS (
        SELECT role, COUNT(*) AS cnt FROM users GROUP BY role
      ),
      station_stats AS (
        SELECT status, COUNT(*) AS cnt FROM stations GROUP BY status
      ),
      slot_stats AS (
        SELECT status, COUNT(*) AS cnt FROM charging_slots GROUP BY status
      ),
      reservation_stats AS (
        SELECT status, COUNT(*) AS cnt FROM reservations GROUP BY status
      ),
      session_stats AS (
        SELECT status, COUNT(*) AS cnt,
          COALESCE(SUM(energy_delivered_kwh), 0) AS total_kwh,
          COALESCE(SUM(cost), 0) AS total_revenue
        FROM charging_sessions GROUP BY status
      )
      SELECT
        (SELECT COALESCE(SUM(cnt), 0) FROM user_stats) AS total_users,
        (SELECT COALESCE(cnt, 0) FROM user_stats WHERE role = 'customer') AS total_customers,
        (SELECT COALESCE(cnt, 0) FROM user_stats WHERE role = 'manager') AS total_managers,
        (SELECT COALESCE(SUM(cnt), 0) FROM station_stats) AS total_stations,
        (SELECT COALESCE(cnt, 0) FROM station_stats WHERE status = 'approved') AS approved_stations,
        (SELECT COALESCE(cnt, 0) FROM station_stats WHERE status = 'pending') AS pending_stations,
        (SELECT COALESCE(cnt, 0) FROM station_stats WHERE status = 'rejected') AS rejected_stations,
        (SELECT COALESCE(cnt, 0) FROM station_stats WHERE status = 'disabled') AS disabled_stations,
        (SELECT COALESCE(SUM(cnt), 0) FROM slot_stats) AS total_slots,
        (SELECT COALESCE(cnt, 0) FROM slot_stats WHERE status = 'available') AS available_slots,
        (SELECT COALESCE(cnt, 0) FROM slot_stats WHERE status = 'occupied') AS occupied_slots,
        (SELECT COALESCE(SUM(cnt), 0) FROM reservation_stats) AS total_reservations,
        (SELECT COALESCE(cnt, 0) FROM reservation_stats WHERE status = 'active') AS active_reservations,
        (SELECT COALESCE(cnt, 0) FROM reservation_stats WHERE status = 'confirmed') AS confirmed_reservations,
        (SELECT COALESCE(SUM(cnt), 0) FROM session_stats) AS total_sessions,
        (SELECT COALESCE(cnt, 0) FROM session_stats WHERE status = 'charging') AS active_sessions,
        (SELECT COALESCE(total_kwh, 0) FROM session_stats WHERE status = 'completed') AS total_energy_kwh,
        (SELECT COALESCE(total_revenue, 0) FROM session_stats WHERE status = 'completed') AS total_revenue
    `);
    return rows[0];
  },

  /**
   * Retrieve paginated audit logs with optional action and userId filters.
   */
  async getAuditLogs({ page = 1, limit = 50, action, userId } = {}) {
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const conditions = [];
    const values = [];
    let idx = 1;

    if (action) {
      conditions.push(`al.action = $${idx}`);
      values.push(action);
      idx++;
    }
    if (userId) {
      conditions.push(`al.user_id = $${idx}`);
      values.push(userId);
      idx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    values.push(parseInt(limit, 10), offset);

    const { rows } = await db.query(
      `SELECT al.*, u.full_name AS user_name, u.email AS user_email
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       ${where}
       ORDER BY al.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      values
    );
    return rows;
  },
};

module.exports = adminService;

const adminService = require('../services/adminService');

const adminController = {
  async getUsers(req, res, next) {
    try {
      const result = await adminService.getUsers(req.query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async toggleUserStatus(req, res, next) {
    try {
      const updated = await adminService.toggleUserStatus(req.params.id, req.user.id, req.ip);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },

  async deleteUser(req, res, next) {
    try {
      await adminService.deleteUser(req.params.id, req.user.id, req.ip);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },

  async updateUserRole(req, res, next) {
    try {
      const updated = await adminService.updateUserRole(req.params.id, req.body.role, req.user.id, req.ip);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },

  async getAllStations(req, res, next) {
    try {
      const result = await adminService.getAllStations(req.query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async getPlatformStats(req, res, next) {
    try {
      const stats = await adminService.getPlatformStats();
      res.json(stats);
    } catch (err) {
      next(err);
    }
  },

  async getAuditLogs(req, res, next) {
    try {
      const logs = await adminService.getAuditLogs(req.query);
      res.json(logs);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = adminController;

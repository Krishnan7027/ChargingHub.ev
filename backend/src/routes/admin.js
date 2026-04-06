const { Router } = require('express');
const adminController = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();

// All admin routes require admin role
router.use(authenticate, authorize('admin'));

// Platform overview
router.get('/stats', adminController.getPlatformStats);
router.get('/audit-logs', adminController.getAuditLogs);

// User management
router.get('/users', adminController.getUsers);
router.patch('/users/:id/toggle-status', adminController.toggleUserStatus);
router.patch('/users/:id/role', adminController.updateUserRole);
router.delete('/users/:id', adminController.deleteUser);

// Station management
router.get('/stations', adminController.getAllStations);

module.exports = router;

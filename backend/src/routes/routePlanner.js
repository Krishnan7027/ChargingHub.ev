const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const ctrl = require('../controllers/routePlanningController');

// Public: plan a route (no auth needed to try)
router.post('/plan', ctrl.planRouteValidation, validate, ctrl.planRoute);

// Authenticated: save & retrieve plans
router.post('/save', authenticate, ctrl.savePlan);
router.get('/my-plans', authenticate, ctrl.getMyPlans);

module.exports = router;

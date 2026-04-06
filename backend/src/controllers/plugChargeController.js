const plugChargeService = require('../services/plugChargeService');

async function registerVehicle(req, res, next) {
  try {
    const vehicle = await plugChargeService.registerVehicle(req.user.id, req.body);
    res.status(201).json(vehicle);
  } catch (err) { next(err); }
}

async function getUserVehicles(req, res, next) {
  try {
    const vehicles = await plugChargeService.getUserVehicles(req.user.id);
    res.json(vehicles);
  } catch (err) { next(err); }
}

async function deregisterVehicle(req, res, next) {
  try {
    const result = await plugChargeService.deregisterVehicle(req.user.id, req.params.vehicleId);
    if (!result) return res.status(404).json({ error: 'Vehicle not found or already deregistered' });
    res.json({ message: 'Vehicle deregistered', vehicle: result });
  } catch (err) { next(err); }
}

async function simulatePlugEvent(req, res, next) {
  try {
    const result = await plugChargeService.handlePlugEvent(
      req.body.vehicleId, req.body.slotId, req.body.currentBatteryPct || 20
    );
    res.status(result.success ? 200 : 400).json(result);
  } catch (err) { next(err); }
}

module.exports = { registerVehicle, getUserVehicles, deregisterVehicle, simulatePlugEvent };

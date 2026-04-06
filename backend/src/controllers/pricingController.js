const { body, query } = require('express-validator');
const pricingService = require('../services/dynamicPricingService');

const ruleValidation = [
  body('name').trim().notEmpty(),
  body('pricePerKwh').isFloat({ min: 0 }),
  body('dayOfWeek').optional().isArray(),
  body('startTime').optional().matches(/^\d{2}:\d{2}$/),
  body('endTime').optional().matches(/^\d{2}:\d{2}$/),
  body('priority').optional().isInt({ min: 0 }),
];

async function getSchedule(req, res, next) {
  try {
    const rules = await pricingService.getPricingSchedule(req.params.stationId);
    res.json({ rules });
  } catch (err) {
    next(err);
  }
}

async function getCurrentPrice(req, res, next) {
  try {
    const price = await pricingService.getEffectivePrice(req.params.stationId);
    res.json(price);
  } catch (err) {
    next(err);
  }
}

async function estimateCost(req, res, next) {
  try {
    const { energyKwh } = req.query;
    const result = await pricingService.estimateCost(
      req.params.stationId,
      parseFloat(energyKwh) || 30,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function createRule(req, res, next) {
  try {
    const rule = await pricingService.createRule(req.params.stationId, req.body);
    res.status(201).json(rule);
  } catch (err) {
    next(err);
  }
}

async function updateRule(req, res, next) {
  try {
    const rule = await pricingService.updateRule(req.params.ruleId, req.body);
    res.json(rule);
  } catch (err) {
    next(err);
  }
}

async function deleteRule(req, res, next) {
  try {
    await pricingService.deleteRule(req.params.ruleId);
    res.json({ message: 'Pricing rule deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { ruleValidation, getSchedule, getCurrentPrice, estimateCost, createRule, updateRule, deleteRule };

'use strict';

const { body } = require('express-validator');
const ingestionService = require('../services/stationIngestionService');

const ingestRegionValidation = [
  body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required'),
  body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required'),
  body('radiusKm').optional().isFloat({ min: 5, max: 250 }),
  body('maxResults').optional().isInt({ min: 1, max: 500 }),
  body('countryCode').optional().isString().isLength({ min: 2, max: 2 }),
];

async function ingestRegion(req, res, next) {
  try {
    const stats = await ingestionService.ingestRegion({
      managerId: req.user.id,
      latitude: req.body.latitude,
      longitude: req.body.longitude,
      radiusKm: req.body.radiusKm || 100,
      maxResults: req.body.maxResults || 200,
      countryCode: req.body.countryCode,
    });
    res.json({ message: 'Ingestion complete', ...stats });
  } catch (err) {
    next(err);
  }
}

async function ingestIndianStations(req, res, next) {
  try {
    const stats = await ingestionService.ingestIndianStations(req.user.id);
    res.json({ message: 'Indian station ingestion complete', ...stats });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  ingestRegionValidation,
  ingestRegion,
  ingestIndianStations,
};

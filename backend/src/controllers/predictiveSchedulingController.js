const schedulingService = require('../services/predictiveSchedulingService');
const reservationService = require('../services/reservationService');
const { body, query: queryValidator } = require('express-validator');

// ── Validation ───────────────────────────────────────────────────
const findScheduleValidation = [
  body('date').isDate().withMessage('date is required (YYYY-MM-DD)'),
  body('durationMin').optional().isInt({ min: 15, max: 480 }),
  body('flexibilityHours').optional().isInt({ min: 1, max: 12 }),
];

// ── Find optimal schedule ────────────────────────────────────────
async function findOptimalSchedule(req, res, next) {
  try {
    const {
      stationId, date, durationMin, flexibilityHours,
      preferredStartHour, latitude, longitude, radiusKm,
    } = req.body;

    const result = await schedulingService.findOptimalSchedule(req.user.id, {
      stationId,
      date,
      durationMin: durationMin ? Number(durationMin) : undefined,
      flexibilityHours: flexibilityHours ? Number(flexibilityHours) : undefined,
      preferredStartHour: preferredStartHour != null ? Number(preferredStartHour) : undefined,
      latitude: latitude ? Number(latitude) : undefined,
      longitude: longitude ? Number(longitude) : undefined,
      radiusKm: radiusKm ? Number(radiusKm) : undefined,
    });

    res.json(result);
  } catch (err) { next(err); }
}

// ── Quick recommend (find best slot near me right now) ───────────
async function quickRecommend(req, res, next) {
  try {
    const { latitude, longitude, durationMin } = req.query;
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'latitude and longitude are required' });
    }
    const result = await schedulingService.quickRecommend(req.user.id, {
      latitude: Number(latitude),
      longitude: Number(longitude),
      durationMin: durationMin ? Number(durationMin) : undefined,
    });
    res.json(result);
  } catch (err) { next(err); }
}

// ── Accept recommendation (convert to reservation) ───────────────
async function acceptRecommendation(req, res, next) {
  try {
    const { recId } = req.params;
    const recData = await schedulingService.acceptRecommendation(recId, req.user.id);

    if (!recData.slotId) {
      return res.status(409).json({
        error: 'No specific slot was recommended. Please book manually.',
        recommendation: recData,
      });
    }

    // Create the reservation
    const reservation = await reservationService.createReservation(req.user.id, {
      slotId: recData.slotId,
      stationId: recData.stationId,
      scheduledStart: recData.scheduledStart,
      scheduledEnd: recData.scheduledEnd,
      notes: `Auto-booked from schedule recommendation ${recData.recommendationId}`,
    });

    res.json({
      reservation,
      message: 'Reservation created from schedule recommendation',
    });
  } catch (err) { next(err); }
}

// ── Get my recommendations ───────────────────────────────────────
async function getMyRecommendations(req, res, next) {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const recs = await schedulingService.getMyRecommendations(req.user.id, { limit });
    res.json({ recommendations: recs });
  } catch (err) { next(err); }
}

// ── Preferences ──────────────────────────────────────────────────
async function getPreferences(req, res, next) {
  try {
    const prefs = await schedulingService.getPreferences(req.user.id);
    res.json(prefs);
  } catch (err) { next(err); }
}

async function updatePreferences(req, res, next) {
  try {
    const prefs = await schedulingService.updatePreferences(req.user.id, req.body);
    res.json(prefs);
  } catch (err) { next(err); }
}

module.exports = {
  findScheduleValidation,
  findOptimalSchedule,
  quickRecommend,
  acceptRecommendation,
  getMyRecommendations,
  getPreferences,
  updatePreferences,
};

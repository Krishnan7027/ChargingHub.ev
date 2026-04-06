/**
 * Operating Hours utilities.
 *
 * Structures:
 *   ALWAYS_OPEN:  { type: "ALWAYS_OPEN", schedule: null }
 *   SCHEDULED:    { type: "SCHEDULED", schedule: { mon: { open: "09:00", close: "21:00" }, ... } }
 */

const VALID_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const JS_DAY_MAP = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const DEFAULT_HOURS = { type: 'ALWAYS_OPEN', schedule: null };

/**
 * Check if a station is open at a given time.
 *
 * @param {object} operatingHours - The operating_hours JSONB from the DB
 * @param {Date} [now] - Defaults to current time
 * @returns {boolean}
 */
function isStationOpenNow(operatingHours, now = new Date()) {
  if (!operatingHours || operatingHours.type === 'ALWAYS_OPEN') {
    return true;
  }

  if (operatingHours.type !== 'SCHEDULED' || !operatingHours.schedule) {
    return true; // fallback: treat as always open if data is malformed
  }

  const dayKey = JS_DAY_MAP[now.getDay()];
  const daySchedule = operatingHours.schedule[dayKey];

  if (!daySchedule) {
    return false; // station closed on this day
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [openH, openM] = daySchedule.open.split(':').map(Number);
  const [closeH, closeM] = daySchedule.close.split(':').map(Number);
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  // Handle overnight schedules (e.g., open: "22:00", close: "06:00")
  if (closeMinutes <= openMinutes) {
    return currentMinutes >= openMinutes || currentMinutes < closeMinutes;
  }

  return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
}

/**
 * Validate operating_hours input structure.
 * Returns { valid: true } or { valid: false, error: "message" }.
 */
function validateOperatingHours(input) {
  if (!input || typeof input !== 'object') {
    return { valid: false, error: 'operating_hours must be an object' };
  }

  if (!input.type || !['ALWAYS_OPEN', 'SCHEDULED'].includes(input.type)) {
    return { valid: false, error: 'operating_hours.type must be ALWAYS_OPEN or SCHEDULED' };
  }

  if (input.type === 'ALWAYS_OPEN') {
    return { valid: true };
  }

  // SCHEDULED validation
  if (!input.schedule || typeof input.schedule !== 'object') {
    return { valid: false, error: 'SCHEDULED type requires a schedule object' };
  }

  const days = Object.keys(input.schedule);
  if (days.length === 0) {
    return { valid: false, error: 'Schedule must include at least one day' };
  }

  for (const day of days) {
    if (!VALID_DAYS.includes(day)) {
      return { valid: false, error: `Invalid day: "${day}". Must be one of: ${VALID_DAYS.join(', ')}` };
    }
    const slot = input.schedule[day];
    if (!slot || typeof slot !== 'object') {
      return { valid: false, error: `Schedule for ${day} must be an object with open and close` };
    }
    if (!slot.open || !TIME_RE.test(slot.open)) {
      return { valid: false, error: `Invalid open time for ${day}: "${slot.open}". Use HH:mm format` };
    }
    if (!slot.close || !TIME_RE.test(slot.close)) {
      return { valid: false, error: `Invalid close time for ${day}: "${slot.close}". Use HH:mm format` };
    }
  }

  return { valid: true };
}

/**
 * Normalize operating_hours before DB insert.
 * Missing or null → ALWAYS_OPEN.
 * Strips unknown keys from schedule.
 */
function normalizeOperatingHours(input) {
  if (!input || !input.type) {
    return DEFAULT_HOURS;
  }

  if (input.type === 'ALWAYS_OPEN') {
    return { type: 'ALWAYS_OPEN', schedule: null };
  }

  if (input.type === 'SCHEDULED' && input.schedule) {
    const cleaned = {};
    for (const day of VALID_DAYS) {
      if (input.schedule[day]) {
        cleaned[day] = {
          open: input.schedule[day].open,
          close: input.schedule[day].close,
        };
      }
    }
    return { type: 'SCHEDULED', schedule: cleaned };
  }

  return DEFAULT_HOURS;
}

module.exports = {
  isStationOpenNow,
  validateOperatingHours,
  normalizeOperatingHours,
  DEFAULT_HOURS,
  VALID_DAYS,
};

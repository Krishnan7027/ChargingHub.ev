const db = require('../config/database');

/**
 * Write an entry to the audit_logs table.
 *
 * @param {object}  opts
 * @param {string}  opts.userId      - acting user (nullable for system actions)
 * @param {string}  opts.action      - e.g. 'station.approve', 'user.disable'
 * @param {string}  opts.entityType  - e.g. 'station', 'user', 'reservation'
 * @param {string}  opts.entityId    - UUID of affected entity
 * @param {object}  opts.details     - arbitrary JSON context
 * @param {string}  opts.ipAddress   - request IP (optional)
 */
async function logAudit({ userId = null, action, entityType, entityId, details = {}, ipAddress = null }) {
  try {
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, action, entityType, entityId, JSON.stringify(details), ipAddress]
    );
  } catch (err) {
    // Audit logging must never crash the main flow
    console.error('Audit log write failed:', err.message);
  }
}

/**
 * Express middleware that attaches a convenience audit helper to req.
 * Usage inside controllers:  req.audit('station.approve', 'station', id, { reason })
 */
function auditMiddleware(req, res, next) {
  req.audit = (action, entityType, entityId, details = {}) => {
    const userId = req.user?.id ?? null;
    const ipAddress = req.ip;
    // fire-and-forget
    logAudit({ userId, action, entityType, entityId, details, ipAddress });
  };
  next();
}

module.exports = { logAudit, auditMiddleware };

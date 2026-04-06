const db = require('../config/database');
const { publish, EVENTS } = require('../events/eventBus');

const paymentService = {
  async createPayment({ userId, reservationId = null, sessionId = null, amount, currency = 'INR', paymentMethod = 'card' }) {
    const { rows } = await db.query(
      `INSERT INTO payments (user_id, reservation_id, session_id, amount, currency, payment_method, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING *`,
      [userId, reservationId, sessionId, amount, currency, paymentMethod]
    );
    const payment = formatPayment(rows[0]);

    publish(EVENTS.PAYMENT_CREATED, payment, {
      actorId: userId, entityType: 'payment', entityId: payment.id,
    }).catch(() => {});

    return payment;
  },

  async processPayment(paymentId, userId, role) {
    const payment = await this.getPayment(paymentId);
    if (!payment) { const err = new Error('Payment not found'); err.statusCode = 404; throw err; }
    if (payment.userId !== userId && role !== 'admin') { const err = new Error('Not authorized'); err.statusCode = 403; throw err; }
    if (payment.status !== 'pending') { const err = new Error(`Payment is already ${payment.status}`); err.statusCode = 400; throw err; }

    await db.query(`UPDATE payments SET status = 'processing', updated_at = NOW() WHERE id = $1`, [paymentId]);

    const { paymentQueue } = require('../jobs/queues');
    await paymentQueue.add('process-payment', { paymentId, action: 'process' }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });

    return { ...payment, status: 'processing' };
  },

  async refundPayment(paymentId, userId, role) {
    const payment = await this.getPayment(paymentId);
    if (!payment) { const err = new Error('Payment not found'); err.statusCode = 404; throw err; }
    if (payment.userId !== userId && role !== 'admin') { const err = new Error('Not authorized'); err.statusCode = 403; throw err; }
    if (payment.status !== 'completed') { const err = new Error(`Cannot refund ${payment.status} payment`); err.statusCode = 400; throw err; }

    const { paymentQueue } = require('../jobs/queues');
    await paymentQueue.add('refund-payment', { paymentId, action: 'refund' }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });

    const result = { ...payment, status: 'refunding' };

    publish(EVENTS.PAYMENT_REFUNDED, result, {
      actorId: userId, entityType: 'payment', entityId: paymentId,
    }).catch(() => {});

    return result;
  },

  async getPayment(paymentId, userId = null, role = null) {
    const { rows } = await db.query('SELECT * FROM payments WHERE id = $1', [paymentId]);
    const payment = rows[0] ? formatPayment(rows[0]) : null;
    if (payment && userId && payment.userId !== userId && role !== 'admin') {
      const err = new Error('Not authorized');
      err.statusCode = 403;
      throw err;
    }
    return payment;
  },

  async getUserPayments(userId, { status, limit = 20, offset = 0 } = {}) {
    let sql = 'SELECT * FROM payments WHERE user_id = $1';
    const params = [userId];
    if (status) { params.push(status); sql += ` AND status = $${params.length}`; }
    sql += ' ORDER BY created_at DESC';
    params.push(limit); sql += ` LIMIT $${params.length}`;
    params.push(offset); sql += ` OFFSET $${params.length}`;
    const { rows } = await db.query(sql, params);
    return rows.map(formatPayment);
  },

  async estimateCost(stationId, batteryPct, targetPct, batteryCapacityKwh = 60) {
    const { rows } = await db.query('SELECT pricing_per_kwh FROM stations WHERE id = $1', [stationId]);
    if (rows.length === 0) return null;
    const pricePerKwh = Number(rows[0].pricing_per_kwh) || 0.30;
    const energyNeeded = ((targetPct - batteryPct) / 100) * batteryCapacityKwh;
    const actualEnergy = energyNeeded / 0.9;
    return {
      estimatedEnergy: Math.round(actualEnergy * 10) / 10,
      pricePerKwh,
      estimatedCost: Math.round(actualEnergy * pricePerKwh * 100) / 100,
      currency: 'INR',
    };
  },
};

function formatPayment(row) {
  return {
    id: row.id, userId: row.user_id, reservationId: row.reservation_id,
    sessionId: row.session_id, amount: Number(row.amount), currency: row.currency,
    status: row.status, paymentMethod: row.payment_method, provider: row.provider,
    providerPaymentId: row.provider_payment_id, providerRefundId: row.provider_refund_id,
    metadata: row.metadata, paidAt: row.paid_at, refundedAt: row.refunded_at,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

module.exports = paymentService;

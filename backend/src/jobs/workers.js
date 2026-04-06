const { Worker } = require('bullmq');
const { redisConfig } = require('../config/redis');
const db = require('../config/database');
const Reservation = require('../models/Reservation');

const workers = [];

function startWorkers(wsHandlers) {
  const connection = redisConfig;

  // ── 1. Notification Worker ─────────────────────────────────
  const notificationWorker = new Worker('notifications', async (job) => {
    const { userId, type, title, message, metadata } = job.data;
    await db.query(
      `INSERT INTO notifications (user_id, type, title, message, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, type, title, message, JSON.stringify(metadata || {})]
    );
    if (wsHandlers) {
      wsHandlers.notifyUser(userId, 'notification', {
        type, title, message, metadata, createdAt: new Date().toISOString(),
      });
    }
  }, { connection, concurrency: 5 });
  workers.push(notificationWorker);

  // ── 2. Reservation Expiry Worker ───────────────────────────
  const expiryWorker = new Worker('reservation-expiry', async () => {
    const expired = await Reservation.expireOldReservations();
    if (expired > 0) {
      console.log(`[worker:expiry] Expired ${expired} stale reservation(s)`);
    }
    return { expired };
  }, { connection, concurrency: 1 });
  workers.push(expiryWorker);

  // ── 3. Prediction Update Worker ────────────────────────────
  const predictionWorker = new Worker('prediction-updates', async () => {
    const { caches } = require('../utils/cache');
    caches.prediction.prune();
    return { pruned: true };
  }, { connection, concurrency: 1 });
  workers.push(predictionWorker);

  // ── 4. Queue Assignment Worker ─────────────────────────────
  const queueWorker = new Worker('queue-assignment', async (job) => {
    const { stationId } = job.data;
    const slotAllocationService = require('../services/slotAllocationService');

    const result = await slotAllocationService.processQueue(stationId);

    if (result && wsHandlers) {
      wsHandlers.notifyQueueAssignment(result.userId, {
        stationId: result.stationId,
        assignedSlot: result.assignedSlot,
      });

      const queue = await slotAllocationService.getStationQueue(stationId);
      wsHandlers.emitQueueUpdate(stationId, { queue, totalWaiting: queue.length });

      const { notificationQueue } = require('./queues');
      await notificationQueue.add('queue-assigned', {
        userId: result.userId,
        type: 'queue_assignment',
        title: 'Slot Available!',
        message: `Slot #${result.assignedSlot.slotNumber} has been assigned to you. Start charging within 10 minutes.`,
        metadata: { stationId, slotId: result.assignedSlot.slotId },
      });
    }

    return result ? { assigned: true, userId: result.userId } : { assigned: false };
  }, { connection, concurrency: 3 });
  workers.push(queueWorker);

  // ── 5. Payment Worker ──────────────────────────────────────
  const paymentWorker = new Worker('payments', async (job) => {
    const { paymentId, action } = job.data;

    if (action === 'process') {
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
      const success = Math.random() < 0.95;

      if (success) {
        await db.query(
          `UPDATE payments SET status = 'completed', paid_at = NOW(),
           provider_payment_id = $2, updated_at = NOW()
           WHERE id = $1`,
          [paymentId, 'mock_pay_' + Date.now()]
        );
        return { status: 'completed' };
      } else {
        await db.query(
          `UPDATE payments SET status = 'failed', updated_at = NOW(),
           metadata = jsonb_set(COALESCE(metadata, '{}'), '{error}', '"Payment declined"')
           WHERE id = $1`,
          [paymentId]
        );
        return { status: 'failed' };
      }
    }

    if (action === 'refund') {
      await new Promise(resolve => setTimeout(resolve, 300));
      await db.query(
        `UPDATE payments SET status = 'refunded', refunded_at = NOW(),
         provider_refund_id = $2, updated_at = NOW()
         WHERE id = $1`,
        [paymentId, 'mock_ref_' + Date.now()]
      );
      return { status: 'refunded' };
    }
  }, { connection, concurrency: 3 });
  workers.push(paymentWorker);

  // Error logging for all workers
  for (const worker of workers) {
    worker.on('failed', (job, err) => {
      console.error(`[worker:${worker.name}] Job ${job?.id} failed:`, err.message);
    });
  }

  console.log(`[jobs] ${workers.length} workers started`);
}

async function stopWorkers() {
  await Promise.allSettled(workers.map(w => w.close()));
  workers.length = 0;
  console.log('[jobs] All workers stopped');
}

module.exports = { startWorkers, stopWorkers };

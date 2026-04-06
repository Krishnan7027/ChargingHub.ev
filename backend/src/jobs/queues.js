const { Queue } = require('bullmq');
const { redisConfig } = require('../config/redis');

const defaultOpts = { connection: redisConfig };

const notificationQueue = new Queue('notifications', defaultOpts);
const reservationExpiryQueue = new Queue('reservation-expiry', defaultOpts);
const predictionUpdateQueue = new Queue('prediction-updates', defaultOpts);
const queueAssignmentQueue = new Queue('queue-assignment', defaultOpts);
const paymentQueue = new Queue('payments', defaultOpts);

async function setupRepeatable() {
  await reservationExpiryQueue.upsertJobScheduler('expire-stale', { every: 60000 }, {
    name: 'expire-stale-reservations',
  });

  await predictionUpdateQueue.upsertJobScheduler('refresh-predictions', { every: 300000 }, {
    name: 'refresh-station-predictions',
  });

  console.log('[jobs] Repeatable jobs scheduled');
}

async function closeQueues() {
  await Promise.allSettled([
    notificationQueue.close(),
    reservationExpiryQueue.close(),
    predictionUpdateQueue.close(),
    queueAssignmentQueue.close(),
    paymentQueue.close(),
  ]);
}

module.exports = {
  notificationQueue,
  reservationExpiryQueue,
  predictionUpdateQueue,
  queueAssignmentQueue,
  paymentQueue,
  setupRepeatable,
  closeQueues,
};

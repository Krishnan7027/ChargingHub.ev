---
name: Job Queue
description: Implements BullMQ background workers with retries, failure handling, and job scheduling for the EV platform.
---

# Job Queue Skill

You implement background job processing using BullMQ (Redis-backed) for the EV Charge Hub platform.

## Architecture
- Queue definitions: `backend/src/jobs/queues.js`
- Workers: `backend/src/jobs/workers/`
- Started in: `backend/src/server.js`

## Existing Queues & Workers
| Queue | Worker | Purpose |
|-------|--------|---------|
| `notifications` | `notificationWorker.js` | Push notifications, in-app alerts |
| `reservation-expiry` | `reservationExpiryWorker.js` | Expire unconfirmed reservations |
| `prediction-update` | `predictionUpdateWorker.js` | Refresh prediction cache |
| `queue-assignment` | `queueAssignmentWorker.js` | Auto-assign slots from queue |
| `payment-processing` | `paymentWorker.js` | Async payment lifecycle |

## Creating a New Worker

```js
const { Worker } = require('bullmq');
const { redisConnection } = require('../config/redis');

const worker = new Worker('queue-name', async (job) => {
  const { param1, param2 } = job.data;
  // Process job...
}, {
  connection: redisConnection,
  concurrency: 5,
  limiter: { max: 10, duration: 1000 },
});

worker.on('completed', (job) => { /* log success */ });
worker.on('failed', (job, err) => { /* log + alert */ });
```

## Enqueuing Jobs

```js
const { queues } = require('../jobs/queues');

// Immediate
await queues.notifications.add('send-notification', { userId, message, type });

// Delayed
await queues.reservationExpiry.add('check-expiry', { reservationId }, {
  delay: 15 * 60 * 1000, // 15 minutes
});

// Recurring
await queues.predictionUpdate.add('refresh', {}, {
  repeat: { every: 5 * 60 * 1000 }, // every 5 min
});
```

## Job Options
- `attempts: 3` - Retry on failure
- `backoff: { type: 'exponential', delay: 1000 }` - Backoff strategy
- `delay: 60000` - Delay before first attempt
- `removeOnComplete: 100` - Keep last 100 completed
- `removeOnFail: 200` - Keep last 200 failed

## Rules
1. Workers must be idempotent (safe to retry)
2. Use `job.data` for all parameters (serializable JSON only)
3. Keep job processing under 30 seconds
4. Log job start, completion, and failure
5. Use `concurrency` to control parallelism

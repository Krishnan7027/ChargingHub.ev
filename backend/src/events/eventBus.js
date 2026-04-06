const { getPublisher, getSubscriber } = require('../config/redis');
const db = require('../config/database');

const CHANNEL_PREFIX = 'ev:events:';
const handlers = new Map();

/**
 * Publish a domain event.
 * Persists to event_logs AND publishes to Redis for cross-process subscribers.
 */
async function publish(eventType, payload = {}, options = {}) {
  const { actorId = null, entityType = null, entityId = null } = options;

  const event = {
    id: require('crypto').randomUUID(),
    type: eventType,
    payload,
    actorId,
    entityType,
    entityId,
    timestamp: new Date().toISOString(),
  };

  // Persist to event_logs (fire-and-forget)
  try {
    await db.query(
      `INSERT INTO event_logs (event_type, entity_type, entity_id, actor_id, payload)
       VALUES ($1, $2, $3, $4, $5)`,
      [eventType, entityType, entityId, actorId, JSON.stringify(payload)]
    );
  } catch (err) {
    console.error(`[eventBus] Failed to persist event ${eventType}:`, err.message);
  }

  // Publish to Redis channel
  try {
    const publisher = getPublisher();
    await publisher.publish(CHANNEL_PREFIX + eventType, JSON.stringify(event));
  } catch (err) {
    console.error(`[eventBus] Failed to publish event ${eventType}:`, err.message);
  }

  // Call local in-process handlers
  const localHandlers = handlers.get(eventType) || [];
  for (const handler of localHandlers) {
    try {
      await handler(event);
    } catch (err) {
      console.error(`[eventBus] Handler error for ${eventType}:`, err.message);
    }
  }

  return event;
}

/**
 * Subscribe to a domain event (in-process).
 */
function on(eventType, handler) {
  if (!handlers.has(eventType)) {
    handlers.set(eventType, []);
  }
  handlers.get(eventType).push(handler);
}

/**
 * Subscribe to Redis channel events (cross-process).
 */
async function subscribeRedis(eventType, handler) {
  const subscriber = getSubscriber();
  const channel = CHANNEL_PREFIX + eventType;

  await subscriber.subscribe(channel);
  subscriber.on('message', (ch, message) => {
    if (ch === channel) {
      try {
        handler(JSON.parse(message));
      } catch (err) {
        console.error(`[eventBus] Redis handler error for ${eventType}:`, err.message);
      }
    }
  });
}

const EVENTS = {
  RESERVATION_CREATED: 'reservation.created',
  RESERVATION_CANCELLED: 'reservation.cancelled',
  RESERVATION_EXPIRED: 'reservation.expired',
  CHARGING_STARTED: 'charging.started',
  CHARGING_PROGRESS: 'charging.progress',
  CHARGING_COMPLETED: 'charging.completed',
  SLOT_UPDATED: 'slot.updated',
  SLOT_FREED: 'slot.freed',
  PAYMENT_CREATED: 'payment.created',
  PAYMENT_COMPLETED: 'payment.completed',
  PAYMENT_FAILED: 'payment.failed',
  PAYMENT_REFUNDED: 'payment.refunded',
  QUEUE_JOINED: 'queue.joined',
  QUEUE_ASSIGNED: 'queue.assigned',
  QUEUE_LEFT: 'queue.left',
  VEHICLE_PLUGGED: 'vehicle.plugged',
  VEHICLE_UNPLUGGED: 'vehicle.unplugged',
  USER_REGISTERED: 'user.registered',
};

module.exports = { publish, on, subscribeRedis, EVENTS };

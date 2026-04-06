---
name: Event-Driven Architecture
description: Implements Redis Pub/Sub event system, service decoupling, and event flow design for the EV platform.
---

# Event-Driven Architecture Skill

You design and implement event-driven patterns for the EV Charge Hub platform.

## Event System Components
- **EventBus**: `backend/src/events/eventBus.js` - Redis Pub/Sub wrapper
- **Subscribers**: `backend/src/events/subscribers.js` - Event handlers
- **Publishers**: Services call `eventBus.publish(event, data)` after state changes

## Event Naming Convention
`domain.action` in lowercase:
- `reservation.created`, `reservation.cancelled`
- `charging.started`, `charging.completed`, `charging.progress`
- `slot.updated`, `slot.statusChanged`
- `payment.completed`, `payment.failed`
- `queue.assigned`, `queue.expired`

## Publishing Pattern (in Services)
```js
const eventBus = require('../events/eventBus');

async createReservation(userId, data) {
  const reservation = await Reservation.create({ ... });
  await eventBus.publish('reservation.created', {
    reservationId: reservation.id,
    userId,
    stationId: data.stationId,
    slotId: data.slotId,
  });
  return reservation;
}
```

## Subscriber Pattern
```js
eventBus.subscribe('reservation.created', async (data) => {
  // Side effects: notifications, cache invalidation, stats
  await notificationService.send(data.userId, 'Reservation confirmed');
  cache.invalidatePrefix(`station:${data.stationId}`);
});
```

## Rules
1. Services publish events AFTER the primary action succeeds
2. Subscribers handle side effects (notifications, cache, analytics)
3. Subscriber failures must NOT break the primary action (use try/catch)
4. Events carry minimal data (IDs), subscribers fetch what they need
5. Use BullMQ for heavy/slow side effects (email, external APIs)

## Current Event Flow
```
Service Action -> eventBus.publish() -> Redis Pub/Sub -> Subscribers
                                                        |-> Socket.io broadcast
                                                        |-> Cache invalidation
                                                        |-> BullMQ job enqueue
                                                        |-> Audit logging
```

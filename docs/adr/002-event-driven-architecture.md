# ADR-002: Event-Driven Architecture

## Status: Accepted

## Context
Side effects after mutations (notifications, cache invalidation, analytics) were being mixed into service logic, causing coupling.

## Decision
- Domain events published via `eventBus.publish()` after service mutations
- Events persisted to `event_logs` table for audit/replay
- Events broadcast via Redis Pub/Sub for cross-process subscribers
- Local in-process handlers for same-process subscribers
- Subscribers handle: WebSocket broadcasts, job enqueue, cache invalidation

## Consequences
- Services stay focused on business logic
- Side effects are decoupled and independently testable
- Event log provides audit trail
- Graceful degradation: app works without Redis (no events/cache, but core logic intact)

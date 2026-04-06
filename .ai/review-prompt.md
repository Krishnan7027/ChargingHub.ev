# EV Charge Hub - Full Codebase Review

**Date:** 2026-04-02
**Reviewed against:** `/docs/spec.md`, `/docs/architecture.md`, `/docs/rules.md`

---

## CRITICAL ISSUES (Fix Immediately)

### 1. Race Condition — No Transaction in Reservation/Session Creation
- **Files:** `services/reservationService.js:7-69`, `services/chargingService.js:12-55`
- **Issue:** Check-then-act across 4 separate queries with no transaction. Two concurrent requests can pass conflict checks and double-book the same slot.
- **Fix:** Wrap in a DB transaction with `SELECT ... FOR UPDATE` on the slot row.

### 2. Expired Reservations Permanently Lock Slots
- **File:** `models/Reservation.js:125-131`
- **Issue:** Expiry sets reservation to `'expired'` but never resets `charging_slots.status` back to `'available'`. Slots stay locked as `'reserved'` forever.
- **Fix:** Join to `charging_slots` in the expiry query and reset slot status, or add a second update in the expiry handler.

### 3. All Event Publishing in Controllers, Not Services
- **Files:** `chargingController.js`, `reservationController.js`, `paymentController.js`, `routes/plugCharge.js`
- **Issue:** Zero services publish events. Per architecture rules, services must call `eventBus.publish()` after mutations. Current pattern means any code path calling a service directly (workers, other services, tests) skips events entirely.
- **Fix:** Move all `eventBus.publish()` calls from controllers into services.

### 4. adminController — Entire Controller Bypasses Service Layer
- **File:** `controllers/adminController.js`
- **Issue:** Directly imports `db` and models. Contains raw SQL (40-line CTE query, DELETE, UPDATE). No `adminService` exists.
- **Fix:** Create `adminService.js`, move all logic there. Move raw SQL to model methods.

### 5. Hardcoded JWT Secret Fallback
- **File:** `config/env.js:14`
- **Issue:** `JWT_SECRET || 'dev-secret-change-in-production'` — if env var missing in production, anyone can forge tokens.
- **Fix:** Throw startup error in production if `JWT_SECRET` is not set.

### 6. Unauthenticated Demo Mode Toggle
- **File:** `app.js:190-202`
- **Issue:** `POST /api/demo/start` and `/stop` have no auth. Anyone can toggle demo mode on production.
- **Fix:** Gate behind `authenticate` + `authorize('admin')`, or disable in production.

---

## HIGH ISSUES

### 7. IDOR — Charging Session Accessible to Any User
- **File:** `services/chargingService.js:144-152`
- **Issue:** `getSessionDetails` returns full session (cost, energy, user info) without ownership check.
- **Fix:** Verify `session.user_id === requestingUserId` or requester is admin/manager.

### 8. IDOR — Payment Processing Without Ownership
- **File:** `services/paymentService.js:14-28`
- **Issue:** `processPayment` has no ownership check. Any user can process another user's payment.
- **Fix:** Pass `userId`, verify `payment.userId === userId`.

### 9. Any User Can Start Session on Another's Reserved Slot
- **File:** `services/chargingService.js:20-24`
- **Issue:** When slot is `'reserved'`, no check that `userId === reservation.user_id`.
- **Fix:** Look up reservation for the slot and verify ownership.

### 10. No Stale Session Cleanup
- **File:** `services/chargingService.js`
- **Issue:** No timeout or scheduler for stuck `'charging'` sessions. Slot stays `'occupied'` forever if `completeSession` is never called (power failure, network loss).
- **Fix:** Add a scheduler (like reservation expiry) to fail sessions older than a threshold.

### 11. `User.findByEmail` Returns `password_hash` via `SELECT *`
- **File:** `models/User.js:19-20`
- **Issue:** Fragile — any caller forgetting to strip the hash leaks it. `findById` correctly excludes it.
- **Fix:** Split into `findByEmail` (no hash) and `findByEmailForAuth` (with hash).

### 12. PostgreSQL Error Details Leaked to Clients
- **File:** `middleware/errorHandler.js:12-16`
- **Issue:** `err.detail` from constraint violations exposes table/column names.
- **Fix:** Remove `detail` from production responses.

### 13. No JWT Token Revocation
- **File:** `middleware/auth.js:12-15`
- **Issue:** Disabled users and changed roles keep valid tokens until expiry (7 days).
- **Fix:** Check `is_active` and role on each request (lightweight DB or Redis lookup).

### 14. Station Queries Scan Entire `charging_slots` Table
- **File:** `models/Station.js:23-28`
- **Issue:** Subquery `SELECT ... FROM charging_slots GROUP BY station_id` aggregates ALL slots, then joins to one station. Repeated in 5 methods.
- **Fix:** Use `LATERAL` subquery or correlated subquery filtered by `station_id`.

### 15. SQL Injection Risk in `demandForecastService`
- **File:** `services/demandForecastService.js:84-109, 136`
- **Issue:** Uses string interpolation (`'${stationId}'`) in SQL VALUES clause and `query.replace('$1', ...)`. Violates parameterized-SQL rule.
- **Fix:** Use parameterized batch insert.

---

## MEDIUM ISSUES

### 16. Duplicate WebSocket Notifications
- **Files:** Controllers (chargingController, reservationController) AND `events/subscribers.js`
- **Issue:** Both controllers and event subscribers send WS notifications for the same events, causing duplicate messages to clients.
- **Fix:** Remove WS logic from controllers; let subscribers handle all side effects.

### 17. Duplicate Reservation Expiry (Scheduler + BullMQ)
- **Files:** `utils/scheduler.js:14-31`, `jobs/workers.js:28-34`
- **Issue:** Both `setInterval` and BullMQ run the same expiry logic every 60s.
- **Fix:** Remove the `setInterval` scheduler; use BullMQ only.

### 18. Cache Key Mismatches — Caches Never Invalidated
- **Files:** `controllers/congestionController.js:9`, `controllers/smartPredictionController.js:6` vs `events/subscribers.js:23-24`
- **Issue:** Controllers cache under `congestion:${id}` and `prediction:${id}`, but subscribers invalidate prefix `station:${id}`. Keys never match, so caches serve stale data indefinitely.
- **Fix:** Standardize cache key prefixes.

### 19. Cache Missing on Slowest Endpoints
- **Files:** `services/stationService.js:32-38` (nearby), `controllers/reservationController.js:57-64` (my reservations)
- **Issue:** The two slowest endpoints (4.86ms, 4.1ms) have zero caching.
- **Fix:** Add short-TTL caching (15-30s).

### 20. Self-Registration as Manager
- **File:** `services/authService.js:14-15`
- **Issue:** Any user can self-register as `manager`, gaining station management privileges.
- **Fix:** Require admin approval for manager role.

### 21. Inconsistent Error Handling
- **Files:** `rangeSafetyController.js`, `communityReviewController.js`, `gamificationController.js`, `batteryHealthController.js`
- **Issue:** Use `console.error` + `res.status(500).json()` instead of `next(err)`, bypassing centralized error handler.
- **Fix:** Replace with `next(err)` pattern.

### 22. Missing Validation on Station/Slot Updates
- **File:** `routes/stations.js:21, 25`
- **Issue:** PUT routes have no validation middleware. Raw `req.body` passed through.
- **Fix:** Add validation arrays like `createValidation`.

### 23. No Duplicate Payment Prevention
- **File:** `services/paymentService.js:4-12`
- **Issue:** No idempotency check. Multiple payments can be created for the same session.
- **Fix:** Check for existing non-failed payment before creating.

### 24. Cancelled Reservation Does Not Trigger Refund
- **File:** `services/reservationService.js:91-120`
- **Issue:** Cancellation changes reservation status but doesn't check for associated payment or initiate refund.
- **Fix:** Look up associated payment and auto-initiate refund on cancel.

### 25. N+1 Write Pattern in Congestion Predictions
- **File:** `services/congestionPredictionService.js:144-162`
- **Issue:** Loop inserts up to 24 predictions one-at-a-time.
- **Fix:** Batch into a single multi-row INSERT.

### 26. Sequential Queries That Should Be Parallel
- **Files:** `services/predictionService.js:53-220` (6 sequential), `services/reservationService.js:7-69` (5 sequential), `services/stationService.js:20-29` (2 sequential)
- **Issue:** Independent queries run sequentially instead of with `Promise.all()`.
- **Fix:** Parallelize independent reads.

### 27. Frontend React Query Missing `staleTime`
- **Files:** `hooks/useStations.ts:139-145`, `hooks/useAdmin.ts:6-12`, `hooks/useIntelligent.ts:81-104`
- **Issue:** Hooks with `refetchInterval` but no `staleTime` cause unnecessary refetches on every mount.
- **Fix:** Add `staleTime` matching half the refetch interval.

### 28. Socket.io Memory Leak on Reconnect
- **Files:** `frontend/src/lib/socket.ts:16-27`, `frontend/src/hooks/useSocket.ts:11-16`
- **Issue:** Reconnection creates new socket without cleaning up old instance. `useSocket` has no cleanup on unmount.
- **Fix:** Disconnect old socket before creating new. Add cleanup in useEffect.

---

## LOW ISSUES

### 29. 8 of 17 Events Dead/Orphaned
- **File:** `events/eventBus.js:85-104`
- **Issue:** `CHARGING_PROGRESS`, `SLOT_UPDATED`, `SLOT_FREED`, `QUEUE_JOINED`, `QUEUE_ASSIGNED`, `QUEUE_LEFT`, `VEHICLE_UNPLUGGED` are defined but never published. `PAYMENT_CREATED` and `PAYMENT_REFUNDED` are published but have no subscribers.

### 30. Routes With Inline Handlers (No Controller)
- **Files:** `routes/predictions.js:6-36`, `routes/plugCharge.js:17-63`
- **Issue:** Route files contain full handler logic, bypassing controller layer.

### 31. 3 Services With No Frontend Consumer
- **Files:** `mobilityAnalyticsService.js` (439 lines), `infrastructurePlanningService.js`, `dynamicPricingService.js`
- **Issue:** Full backend implementation but no frontend page or component calls these APIs.

### 32. Country Default Mismatch
- **File:** `models/Station.js:11`
- **Issue:** Defaults country to `'US'` but CLAUDE.md specifies India as default.

### 33. Direct Cache Access in Controllers
- **Files:** `congestionController.js`, `demandForecastController.js`, `gridLoadController.js`, `smartPredictionController.js`, `chargingController.js`, `reservationController.js`
- **Issue:** Controllers directly use `caches.*` methods. Caching should be encapsulated in services.

### 34. JSON Body Limit Too Large
- **File:** `app.js:17`
- **Issue:** `10mb` limit is excessive for this API. DoS risk via large payloads.
- **Fix:** Reduce to `256kb` or `1mb`.

### 35. Health Check Exposes Infrastructure Details
- **File:** `app.js:71-187`
- **Issue:** `/api/health/deep` is unauthenticated and exposes DB pool sizes, Redis status, queue depths, memory usage.
- **Fix:** Require admin auth for `/api/health/deep`.

---

## UNRELATED MODIFICATIONS

None detected. All current changes are aligned with the project scope.

---

## PRIORITY REMEDIATION ORDER

| Phase | Items | Effort |
|-------|-------|--------|
| **Phase 1 — Critical** | #1 (race condition), #2 (slot lock), #3 (events in services), #4 (admin service), #5 (JWT secret), #6 (demo auth) | 1-2 days |
| **Phase 2 — High** | #7-#8 (IDOR), #9 (reserved slot hijack), #10 (stale sessions), #11 (password hash), #12 (error details), #13 (token revocation), #14 (slot subquery), #15 (SQL injection) | 1-2 days |
| **Phase 3 — Medium** | #16-#28 (caching, validation, performance, frontend) | 2-3 days |
| **Phase 4 — Low** | #29-#35 (cleanup, dead code, minor fixes) | 1 day |

---

## POSITIVE FINDINGS

- Parameterized SQL is used consistently across all models (except #15)
- Helmet, CORS, rate limiting properly configured
- bcrypt with 12 rounds for password hashing
- Audit logging is thorough
- Event-driven architecture is well-designed (implementation just needs to follow it)
- TypeScript types are comprehensive and accurate
- Mobile-first responsive design in frontend components
- Graceful shutdown with proper cleanup
- Demo simulator enables showcasing without manual data setup

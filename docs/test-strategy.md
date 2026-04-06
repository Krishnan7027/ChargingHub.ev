# EV Charge Hub - Test Strategy

## 1. Current State

- **Test infrastructure**: Jest + Supertest configured in `package.json`
- **Benchmark suite**: Autocannon-based (`backend/benchmarks/run-benchmarks.js`)
- **Coverage**: Minimal — no formal unit/integration tests written yet

## 2. Testing Layers

### 2.1 Unit Tests (Priority: High)

**Target**: Services (business logic)

| Service | Critical Paths |
|---------|---------------|
| `authService` | Registration validation, login, token generation |
| `reservationService` | Slot conflict detection, expiry logic, status transitions |
| `chargingService` | Session start/stop, progress calculation, cost computation |
| `stationService` | Nearby search, approval workflow, authorization |
| `paymentService` | Payment creation, status transitions, refund logic |
| `dynamicPricingService` | Rule evaluation, time-based pricing |
| `slotAllocationService` | Slot ranking, queue management |
| `gamificationService` | Points calculation, badge evaluation, level progression |

**Approach**: Mock models (DB layer), test service logic in isolation.

### 2.2 Integration Tests (Priority: High)

**Target**: Routes (end-to-end request flow)

| Flow | Steps |
|------|-------|
| Auth flow | Register → Login → Access protected route |
| Booking flow | Search stations → Get details → Reserve slot → Start session → Complete |
| Admin flow | Login as admin → Approve station → View analytics |
| Payment flow | Create payment → Process → Verify status |

**Approach**: Real PostgreSQL (test database), Supertest for HTTP assertions.

### 2.3 Performance Tests (Priority: Done)

- Autocannon benchmarks in `backend/benchmarks/`
- 43 endpoints tested
- Results in `backend/benchmarks/results.json`

### 2.4 E2E Tests (Priority: Low — Future)

- Playwright for frontend flows
- Critical paths: Login → Find station → Reserve → Charge

## 3. Test Database

```bash
createdb ev_charging_test
# Run migrations against test DB
DATABASE_URL=postgres://localhost:5432/ev_charging_test npm run migrate
```

## 4. Test File Convention

```
backend/
  src/
    services/__tests__/     # Unit tests for services
    routes/__tests__/       # Integration tests for routes
    models/__tests__/       # Model query tests (optional)
  tests/
    fixtures/               # Shared test data
    helpers/                # Test utilities
```

## 5. Coverage Targets

| Layer | Target |
|-------|--------|
| Services | 80% |
| Routes (integration) | 70% |
| Models | 50% |
| Overall | 70% |

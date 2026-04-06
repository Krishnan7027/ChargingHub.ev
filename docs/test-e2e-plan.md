# E2E Test Plan — EV Charge Hub

## Test Credentials (from seed data)

| Role | Email | Password |
|------|-------|----------|
| Customer | customer@evcharge.com | password123 |
| Manager | manager1@evcharge.com | password123 |
| Admin | admin@evcharge.com | admin123 |

## Test Categories

### 1. Smoke Tests (P0 — must pass on every PR)

| ID | Test | Type |
|----|------|------|
| S01 | Homepage loads | UI |
| S02 | Login page renders | UI |
| S03 | API health check returns 200 | API |
| S04 | Customer can login and reach dashboard | UI+API |
| S05 | Station map page loads | UI |

### 2. Auth Flow (P0)

| ID | Test | Type |
|----|------|------|
| A01 | Login with valid customer credentials → redirects to /customer | UI |
| A02 | Login with valid manager credentials → redirects to /manager | UI |
| A03 | Login with valid admin credentials → redirects to /admin | UI |
| A04 | Login with invalid password → shows error message | UI |
| A05 | Login with non-existent email → shows error message | UI |
| A06 | Register new customer → auto-login → redirect | UI |
| A07 | Access /admin without auth → redirect to login | UI |
| A08 | Access /manager without customer role → forbidden | API |
| A09 | JWT token persists across page navigation | UI |
| A10 | Logout clears token and redirects | UI |

### 3. Booking System — Critical Path (P0)

| ID | Test | Type |
|----|------|------|
| B01 | Customer creates reservation on available slot → status confirmed | API |
| B02 | Customer cannot reserve an already-reserved slot → 409 | API |
| B03 | Customer cancels own reservation → slot freed | API |
| B04 | Customer cannot cancel another user's reservation → 403 | API |
| B05 | Reservation auto-expires after TTL → slot returns to available | API |
| B06 | Start charging session on own reserved slot → success | API |
| B07 | Start charging session on another user's reserved slot → 403 | API |
| B08 | Complete charging session → slot freed | API |
| B09 | Double-booking same slot (sequential) → second request gets 409 | API |

### 4. Parallel Race Condition Tests (P0)

| ID | Test | Type |
|----|------|------|
| R01 | 5 concurrent reservation attempts on same slot → exactly 1 succeeds | API |
| R02 | 5 concurrent session starts on same slot → exactly 1 succeeds | API |
| R03 | Reserve + start session concurrently on same slot → no double-occupy | API |

### 5. Admin Flow (P1)

| ID | Test | Type |
|----|------|------|
| D01 | Admin sees platform stats dashboard | UI |
| D02 | Admin views user list | API |
| D03 | Admin toggles user active status | API |
| D04 | Admin updates user role | API |
| D05 | Admin approves pending station | API |
| D06 | Customer cannot access admin endpoints → 403 | API |

### 6. Station Management (P1)

| ID | Test | Type |
|----|------|------|
| M01 | Manager creates station → status pending | API |
| M02 | Manager adds slot to own station | API |
| M03 | Manager cannot manage another manager's station → 403 | API |
| M04 | Search stations by city → returns results | API |
| M05 | Nearby stations query → sorted by distance | API |
| M06 | Station details include slot list | API |

### 7. Security Tests (P1)

| ID | Test | Type |
|----|------|------|
| X01 | Access protected endpoint without token → 401 | API |
| X02 | Access endpoint with expired/invalid token → 401 | API |
| X03 | Customer accesses another customer's session → 403 | API |
| X04 | Customer accesses another customer's payment → 403 | API |
| X05 | Customer calls admin-only endpoint → 403 | API |
| X06 | Demo toggle without admin auth → 401 | API |

### 8. Payments (P2)

| ID | Test | Type |
|----|------|------|
| P01 | Create payment for session → status pending | API |
| P02 | Process own payment → status processing | API |
| P03 | Cannot process another user's payment → 403 | API |
| P04 | Get own payment history | API |

### 9. Edge Cases (P2)

| ID | Test | Type |
|----|------|------|
| E01 | Reserve slot in the past → 400 | API |
| E02 | Reserve with end time before start → 400 | API |
| E03 | Start session on maintenance slot → 409 | API |
| E04 | Complete already-completed session → 400 | API |
| E05 | Register with duplicate email → 409 | API |

## Execution Strategy

- **CI**: Run smoke + P0 tests on every PR (~2 min)
- **Nightly**: Run full suite including P1 + P2 (~5 min)
- **Parallel**: API tests run 4 workers, UI tests run 2 workers
- **Retries**: 1 retry on failure for UI tests, 0 for API tests

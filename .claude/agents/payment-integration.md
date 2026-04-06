---
name: Payment Integration
description: Designs and implements payment service with Razorpay/Stripe integration, async processing, and refund handling for the EV platform.
---

# Payment Integration Skill

You implement payment features for the EV Charge Hub platform.

## Architecture
- Service: `backend/src/services/paymentService.js`
- Controller: `backend/src/controllers/paymentController.js`
- Routes: `backend/src/routes/payments.js`
- Model: `backend/src/models/Payment.js`
- Worker: `backend/src/jobs/workers/paymentWorker.js`
- Table: `payments` (PostgreSQL)

## Payment Lifecycle
```
estimate -> create (pending) -> process (processing) -> complete (completed)
                                                     -> fail (failed)
completed -> refund (refunded)
```

## Payment Table Schema
| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | Primary key |
| user_id | UUID | FK to users |
| reservation_id | UUID | FK to reservations (nullable) |
| session_id | UUID | FK to charging_sessions (nullable) |
| amount | DECIMAL(10,2) | Payment amount |
| currency | VARCHAR(3) | ISO 4217 (INR, USD, etc.) |
| status | payment_status ENUM | pending/processing/completed/failed/refunded |
| payment_method | VARCHAR | card/upi/wallet |
| provider | VARCHAR | razorpay/stripe/mock |
| provider_payment_id | VARCHAR | External payment ID |
| metadata | JSONB | Provider-specific data |

## API Endpoints
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/payments/estimate` | Cost estimate for a charge |
| POST | `/api/payments` | Create payment |
| GET | `/api/payments/my` | User's payment history |
| GET | `/api/payments/:id` | Payment detail |
| POST | `/api/payments/:id/refund` | Initiate refund |

## Provider Abstraction
```js
// paymentService.js
async processPayment(paymentId) {
  const provider = this.getProvider(); // razorpay/stripe/mock based on env
  const result = await provider.charge(amount, currency, metadata);
  // Update payment record with provider response
}
```

## Async Processing via BullMQ
- Payment creation enqueues a `payment-processing` job
- Worker processes payment with provider
- On success: update status, emit `payment.completed` event
- On failure: retry 3x with exponential backoff, then mark failed

## Currency Integration
- Payment amount stored in the station's configured currency
- `currency` field on payment record (not hardcoded)
- Frontend displays using `formatCurrency(payment.amount, country)`

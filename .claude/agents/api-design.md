---
name: API Design
description: Designs REST APIs with validation, error handling, pagination, and backward compatibility for the EV platform.
---

# API Design Skill

You design and implement REST APIs for the EV Charge Hub platform.

## API Standards

### URL Patterns
- Resource-based: `/api/stations`, `/api/stations/:id`
- Nested for ownership: `/api/stations/:id/slots`
- Action verbs for non-CRUD: `/api/reservations/:id/cancel`, `/api/stations/:id/approve`
- Query params for filtering: `?status=active&page=1&limit=20`

### HTTP Methods
- `GET` - Read (never mutate state)
- `POST` - Create new resource
- `PUT` - Full update
- `PATCH` - Partial update or action
- `DELETE` - Remove resource

### Response Format
Success: `{ ...resource }` or `{ items: [...], total: N, page: N, limit: N }`
Error: `{ error: "message", details: [{ field: "name", message: "required" }] }`

### Status Codes
- 200: Success
- 201: Created
- 400: Bad request / validation error
- 401: Unauthenticated
- 403: Forbidden (wrong role)
- 404: Not found
- 409: Conflict (duplicate, double-booking)
- 500: Server error (never expose internals)

### Validation (express-validator)
- Validate ALL mutation endpoints
- Check types, ranges, formats
- Custom validators for UUIDs, dates, enums
- Always call `validate` middleware after validators

### Authentication & Authorization
- `authenticate` middleware verifies JWT
- `authorize('admin', 'manager')` checks role
- Owner checks happen in service layer (e.g., manager can only edit own stations)

### Pagination
- Default: `page=1, limit=20`
- Max limit: 100
- Return: `{ items, total, page, limit, totalPages }`

### Route Registration
1. Define in `backend/src/routes/featureName.js`
2. Register in `backend/src/app.js`: `app.use('/api/featureName', featureRoutes)`

## Existing API Groups
- `/api/auth` - Authentication (register, login, profile)
- `/api/stations` - Station CRUD, nearby search, approval
- `/api/reservations` - Booking lifecycle
- `/api/charging` - Session management
- `/api/admin` - Platform administration
- `/api/intelligent` - Predictions, demand, pricing, recommendations
- `/api/energy` - Digital twin, congestion, grid, carbon
- `/api/mobility` - Heatmaps, behavior, trends, infrastructure
- `/api/reviews` - Community reviews and reliability
- `/api/rewards` - Gamification and points
- `/api/payments` - Payment lifecycle
- `/api/queue` - Smart queue management
- `/api/plug-charge` - Plug & Charge automation
- `/api/demo` - Demo mode control

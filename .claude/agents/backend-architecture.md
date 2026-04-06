---
name: Backend Architecture
description: Enforces Controller -> Service -> Model pattern, clean separation of concerns, and EV platform backend standards.
---

# Backend Architecture Skill

You enforce the EV Charge Hub backend architecture standards.

## Pattern: Controller -> Service -> Model

```
HTTP Request -> Route -> Middleware (auth/validate) -> Controller -> Service -> Model -> PostgreSQL
```

### Controller Rules
- Parse request params, body, query
- Call service method with extracted data
- Return `res.status().json()` response
- NEVER contain business logic, SQL, or direct model calls
- NEVER catch errors (let errorHandler middleware handle them)
- Always pass `req.user.id` for authenticated operations

### Service Rules
- Contain ALL business logic
- Call model methods for data access
- Throw typed errors: `AppError`, `NotFoundError`, `ConflictError`, `ForbiddenError`, `BadRequestError`
- Emit events via `eventBus.publish()` after state changes
- Can call other services for cross-domain orchestration

### Model Rules
- Pure SQL data access via `db.query()`
- Always use parameterized queries (`$1, $2, ...`)
- Return plain objects (no ORM magic)
- Static methods only (e.g., `Station.findById(id)`)
- Handle SQL-level concerns (joins, aggregations)

## File Locations
- Controllers: `backend/src/controllers/`
- Services: `backend/src/services/`
- Models: `backend/src/models/`
- Routes: `backend/src/routes/`
- Middleware: `backend/src/middleware/`

## Creating a New Feature
1. Add model methods in `backend/src/models/`
2. Add service with business logic in `backend/src/services/`
3. Add controller (thin HTTP handler) in `backend/src/controllers/`
4. Add route with middleware in `backend/src/routes/`
5. Register route in `backend/src/app.js`
6. Add migration if new tables needed in `backend/src/migrations/`

## Example Usage
"Create a new fleet management feature" -> Agent reads existing patterns, creates Model + Service + Controller + Route following the exact same structure as stationService/stationController.

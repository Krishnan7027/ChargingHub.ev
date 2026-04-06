# ADR-001: Controller → Service → Model Pattern

## Status: Accepted

## Context
Need a clear separation of concerns for a growing backend with 20+ feature modules.

## Decision
- **Controllers**: Thin HTTP handlers — parse request, call service, return response
- **Services**: All business logic, validation, orchestration, event publishing
- **Models**: SQL query execution only (parameterized queries)
- No separate repository layer — models serve as repositories

## Consequences
- Clear responsibility boundaries
- Services are testable (mock models)
- Models are reusable across services
- Trade-off: No repository abstraction makes DB-switching harder (acceptable for PostgreSQL-committed project)

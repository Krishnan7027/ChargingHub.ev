# EV Charge Hub - Development Rules

## 1. Architecture Rules (MANDATORY)

1. **Controller → Service → Model**: Controllers are thin HTTP handlers only. ALL business logic goes in services. Models handle SQL queries only.
2. **Parameterized SQL only**: Use `$1, $2` — NEVER string interpolation in queries. No exceptions.
3. **Events after state changes**: Call `eventBus.publish()` after mutations. Subscribers handle side effects (notifications, cache invalidation, analytics).
4. **Currency via helper**: Use `formatCurrency(amount, country)` — NEVER hardcode `$`, `₹`, or any currency symbol. All DB prices stored in INR.
5. **Map coordinates via config**: Use `country.defaultCenter` from `countries.ts` — NEVER hardcode lat/lng.
6. **Mobile-first UI**: All components must use Tailwind responsive prefixes (`sm:`, `md:`, `lg:`). Test at 375px minimum.

## 2. Auth & RBAC

- Roles: `customer`, `manager`, `admin` (lowercase strings from JWT)
- Middleware: `authenticate` (required), `authorize(...roles)` (role check), `optionalAuth` (public with optional user)
- Route protection: `/admin/*` = admin, `/manager/*` = manager, customer features = customer
- Role logic: Use `frontend/src/lib/roles.ts` helpers — never inline role checks

## 3. Coding Standards

### Backend (Node.js)
- **Module system**: CommonJS (`require`/`module.exports`)
- **Async**: `async/await` with try-catch
- **Naming**: camelCase (variables/functions), PascalCase (classes)
- **Files**: `.js` extension
- **Error responses**: `{ error: "message" }` format, proper HTTP status codes
- **Validation**: express-validator arrays in controllers, `validate` middleware in routes
- **Error throwing**: Use `AppError` classes from `src/utils/errors.js` in services

### Frontend (Next.js)
- **Language**: TypeScript strict
- **Module system**: ES modules
- **Components**: Functional, one export per file
- **Server state**: React Query (never local state for API data)
- **Naming**: PascalCase (components), camelCase (hooks/utils), UPPER_SNAKE (constants)
- **Files**: `.ts`/`.tsx`
- **Styling**: Tailwind CSS, responsive-first

### Import Order
1. Node builtins
2. External packages
3. Internal modules (absolute paths)
4. Relative imports

## 4. API Conventions

- RESTful routes: `/api/stations`, `/api/charging/sessions`, `/api/reservations`
- Pagination: `?page=1&limit=20`
- Search: Query params on GET
- Error format: `{ error: "message" }` with 400/401/403/404/500
- Created resources: Return 201
- Validation errors: `{ error: "Validation failed", details: [...] }`

## 5. Database Conventions

- All PKs: UUID via `uuid_generate_v4()`
- Timestamps: `created_at`, `updated_at` with TIMESTAMPTZ, auto-updated via trigger
- Status fields: PostgreSQL enum types
- Flexible data: JSONB columns
- Geospatial: `earthdistance` extension with `ll_to_earth()`
- Indexes: On all foreign keys, status columns, and search fields

## 6. Anti-Patterns (FORBIDDEN)

1. SQL injection via template literals
2. Hardcoded currency symbols in UI
3. Hardcoded lat/lng coordinates in components
4. Missing auth on non-public routes
5. Business logic in controllers
6. Direct Redis/DB calls in controllers
7. Missing event publishing after mutations
8. Non-responsive UI (must work at 375px, 768px, 1024px+)
9. Forgetting error handling in services (must throw AppError)
10. Stale `.next` cache (clear before restart after frontend changes)

## 7. File Naming

- Backend controllers: `{domain}Controller.js`
- Backend services: `{domain}Service.js`
- Backend models: `{Entity}.js` (PascalCase)
- Backend routes: `{domain}.js`
- Frontend pages: `page.tsx` (Next.js convention)
- Frontend components: `{ComponentName}.tsx`
- Frontend hooks: `use{Name}.ts`

## 8. Pre-Implementation Checklist

Before implementing any feature:
1. **Identify the layer**: Controller, service, or model change?
2. **Check existing patterns**: Read 1-2 similar files in the same directory
3. **Verify the approach**: SQL injection? Missing auth? Hardcoded values?
4. **Then implement**: Only after confirming approach

## 9. Event Publishing

After any create/update/delete in a service:
```javascript
const eventBus = require('../events/eventBus');
await eventBus.publish(eventBus.EVENTS.EVENT_NAME, payload, {
  actorId: userId,
  entityType: 'entity',
  entityId: id,
});
```

## 10. Testing

- Backend: Jest + Supertest
- Benchmarks: Autocannon via `benchmarks/run-benchmarks.js`
- No formal test suite yet (test infrastructure exists but minimal coverage)

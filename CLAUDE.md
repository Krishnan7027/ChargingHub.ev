# EV Charge Hub - Claude Code Configuration

## Project Overview
EV charging platform with station discovery, reservations, real-time charging sessions, smart queue, predictions, payments, and route planning.

## Tech Stack
- **Backend**: Node.js (Express), PostgreSQL (earthdistance), Redis (cache + pub/sub), BullMQ (jobs), Socket.io
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Leaflet, React Query
- **Default Country**: India (INR currency, map centered on India)

## Architecture Rules (MANDATORY)
1. **Controller -> Service -> Model**: Controllers are thin HTTP handlers only. ALL business logic goes in services. Models handle SQL queries only.
2. **Parameterized SQL only**: Use `$1, $2` — NEVER string interpolation in queries. No exceptions.
3. **Events after state changes**: Call `eventBus.publish()` after mutations, subscribers handle side effects (notifications, cache invalidation, analytics).
4. **Currency**: Use `formatCurrency(amount, country)` from `frontend/src/lib/formatCurrency.ts` — NEVER hardcode `$`, `₹`, or any symbol. All DB prices stored in INR.
5. **Map coordinates**: Use `country.defaultCenter` from `frontend/src/lib/countries.ts` — NEVER hardcode lat/lng.
6. **Mobile-first UI**: All components must use Tailwind responsive prefixes (`sm:`, `md:`, `lg:`). Test at 375px width minimum.

## Auth & RBAC
- **Roles**: `customer`, `manager`, `admin` (lowercase strings from JWT)
- **Auth middleware**: `authenticate` (required), `authorize(...roles)` (role check), `optionalAuth` (public routes with optional user context)
- **Route protection**: `/admin/*` = admin only, `/manager/*` = manager only, customer features = customer only
- **Role logic**: Use `frontend/src/lib/roles.ts` helpers — never inline role checks
- **Test credentials**: customer@evcharge.com/password123, manager1@evcharge.com/password123, admin@evcharge.com/admin123

## Country & Currency System
- Country config: `frontend/src/lib/countries.ts` — defines locale, currency, map center, zoom per country
- Currency formatting: `frontend/src/lib/formatCurrency.ts` — `formatCurrency()`, `formatPricePerKwh()`, `convertFromINR()`
- All prices stored in INR in PostgreSQL, converted at display time
- Default country code: `IN` (India)
- Use `CountryContext` in React components to get active country

## Common Bugs to Avoid
1. **SQL injection**: Never use template literals in SQL. Always `$1, $2` params.
2. **Hardcoded currency symbols**: Always use `formatCurrency()`. Grep for `$` or `₹` in JSX to catch violations.
3. **Hardcoded coordinates**: Never put lat/lng numbers in components. Use country config.
4. **Missing auth on routes**: Every non-public route needs `authenticate` middleware. Admin routes need `authorize('admin')`.
5. **Business logic in controllers**: If a controller has more than request parsing + service call + response, refactor logic to service.
6. **Missing error handling in services**: Services should throw from `backend/src/utils/errors.js` (AppError classes). Controller error handler catches them.
7. **Forgetting event publishing**: After create/update/delete operations in services, publish events for subscribers.
8. **Non-responsive UI**: Every component must work at mobile (375px), tablet (768px), desktop (1024px+).
9. **Direct Redis/DB calls in controllers**: All data access goes through models, all caching goes through services.
10. **Stale `.next` cache**: After frontend changes, clear `.next/` before restarting dev server.

## Coding Standards
- **Backend**: CommonJS (`require`/`module.exports`), Express patterns, async/await with try-catch
- **Frontend**: TypeScript strict, ES modules, functional components, React Query for server state
- **Naming**: camelCase for variables/functions, PascalCase for components/classes, UPPER_SNAKE for constants
- **Files**: Backend `.js`, Frontend `.ts`/`.tsx`. One export per file for components.
- **Imports**: Group — node builtins, external packages, internal modules, relative imports
- **Error responses**: `{ error: "message" }` format from backend, HTTP status codes (400/401/403/404/500)
- **API routes**: RESTful — `/api/stations`, `/api/charging/sessions`, `/api/reservations`

## Pre-Flight Checklist (Run Before Every Session)
Before starting any implementation work, verify:
```bash
# 1. PostgreSQL running
pg_isready -h 127.0.0.1 -p 5432

# 2. Redis running
redis-cli ping

# 3. Backend health
curl -s http://localhost:3001/api/health

# 4. Frontend running
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000

# 5. Environment files exist
test -f backend/.env && echo "backend .env OK" || echo "MISSING backend/.env"
```
If any check fails, fix it before writing code. Use `@run-project` agent to start everything.

## Custom Agents
Specialized agents are available in `.claude/agents/`:
- `run-project` — Starts the full platform locally (use: `@run-project`)
- `ev-platform-engineer` — Full-stack EV platform expert
- `backend-architecture` — Controller/Service/Model patterns
- `database-design` — PostgreSQL schema design
- `api-design` — REST API standards
- `map-ux` — Leaflet/map layout patterns
- `realtime-system` — Socket.io implementation
- `event-driven-arch` — Redis Pub/Sub patterns
- `job-queue` — BullMQ worker patterns
- `ev-domain-logic` — Charging, queue, prediction logic
- `frontend-ux` — Tailwind UI/component patterns
- `country-config` — Country/currency/locale system
- `route-planning` — EV route planning logic
- `payment-integration` — Payment service patterns
- `android-auto-readiness` — Driver-safe UX design

## Key Directories
```
backend/src/controllers/   — HTTP handlers (thin, no business logic)
backend/src/services/      — Business logic (the brain)
backend/src/models/        — SQL data access (parameterized queries only)
backend/src/events/        — EventBus + subscribers (side effects)
backend/src/jobs/          — BullMQ queues + workers
backend/src/websocket/     — Socket.io handlers
backend/src/middleware/    — auth, validation, error handling
backend/src/config/        — env, database, redis config
backend/src/utils/         — errors, cache, scheduler helpers
frontend/src/app/          — Next.js pages (App Router)
frontend/src/components/   — React components
frontend/src/hooks/        — Custom hooks (React Query)
frontend/src/context/      — Auth + Country contexts
frontend/src/lib/          — API client, countries, currency, roles
```

## Running Locally
```bash
# Backend (port 3001)
cd backend && npm install && npm run migrate && npm run seed && npm run dev

# Frontend (port 3000)
cd frontend && npm install && npm run dev
```

## Anti-Wrong-Approach Protocol
Before implementing any feature or fix, Claude MUST:
1. **Identify the layer**: Is this a controller, service, or model change? (Never put logic in wrong layer)
2. **Check existing patterns**: Read 1-2 similar files in the same directory to match conventions
3. **Verify the approach**: List what could go wrong (SQL injection? Missing auth? Hardcoded values?)
4. **Then implement**: Only after confirming the approach is correct

## Prompt Structure for Best Results
When requesting features, use this format:
```
OBJECTIVE: What you want built
CONTEXT: Which existing files/features are related
CONSTRAINTS: What must NOT be done (e.g., "don't change the DB schema")
FILES: Which files to modify or create
OUTPUT: What success looks like (API response format, UI behavior)
```

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.

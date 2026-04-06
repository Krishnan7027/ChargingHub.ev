---
name: Build Feature
description: Structured feature development agent that enforces the anti-wrong-approach protocol. Plans before coding, validates architecture, then implements across all layers.
---

# Build Feature Agent

You implement features for the EV Charge Hub platform. You MUST follow the structured approach below — no shortcuts.

## Phase 1: Understand (DO NOT SKIP)

Before writing ANY code:

1. **Read the request carefully.** Identify: what layer(s) does this touch? (Backend API? Frontend UI? Database? Real-time?)
2. **Find existing patterns.** Read 1-2 similar files in each affected directory to understand conventions.
3. **Identify wrong approaches.** List 2-3 things that would be WRONG:
   - Would putting logic in a controller be wrong here? (Usually yes)
   - Would hardcoding currency/coordinates be wrong? (Always yes)
   - Would skipping auth middleware be wrong? (Check if route needs protection)
   - Would direct DB calls from controller be wrong? (Always yes)
4. **State your approach.** Before implementing, briefly describe:
   - Which files you'll modify/create
   - Which layer handles what
   - What the data flow looks like

## Phase 2: Implement (Layer by Layer)

Follow this order for full-stack features:

### 2a. Database (if needed)
- Add migration in `backend/src/migrations/`
- Use parameterized SQL only
- Run migration to verify

### 2b. Backend Model
- File: `backend/src/models/`
- Pure SQL queries with `$1, $2` params
- Return clean data objects

### 2c. Backend Service
- File: `backend/src/services/`
- ALL business logic here
- Publish events after state changes: `eventBus.publish('entity.action', data)`
- Throw AppError for error cases

### 2d. Backend Controller
- File: `backend/src/controllers/`
- THIN: parse request -> call service -> send response
- No business logic, no direct DB calls

### 2e. Backend Route
- File: `backend/src/routes/`
- Apply `authenticate`, `authorize()` middleware as needed
- Apply `validate()` middleware for input validation

### 2f. Frontend API Hook
- File: `frontend/src/hooks/`
- Use React Query (`useQuery`, `useMutation`)
- Call through `frontend/src/lib/api.ts`

### 2g. Frontend Component
- File: `frontend/src/components/` or `frontend/src/app/`
- TypeScript, functional components
- Mobile-responsive (Tailwind `sm:`, `md:`, `lg:`)
- Use `formatCurrency()` for any money display
- Use `country.defaultCenter` for any map coordinates

## Phase 3: Verify

After implementation:
1. Check that no business logic leaked into controllers
2. Check for hardcoded currency symbols or coordinates
3. Check that auth middleware is applied on protected routes
4. Check that events are published for state changes
5. Test the API endpoint with curl if backend was modified

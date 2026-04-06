# EV Charge Hub - AI Workflow System

Complete workflow system for achieving consistent 8.5-9/10 Claude Code performance.

---

## 1. DAILY WORKFLOW (Step-by-Step)

### Morning Start (Every Session)
```
Step 1: Pre-flight → @preflight
Step 2: Define today's task using Master Prompt Template (below)
Step 3: Use the right agent for the job (see Agent Selection Matrix)
Step 4: Validate output before moving to next task
```

### Per-Task Flow
```
1. WRITE structured prompt (Master Template)
2. Claude runs Anti-Wrong-Approach check (automatic via CLAUDE.md)
3. Implementation happens in correct layer order
4. Verify with curl / visual check
5. Move to next task
```

---

## 2. MASTER PROMPT TEMPLATE

Copy and fill in for every non-trivial request:

```
OBJECTIVE: [One sentence — what you want built/fixed/changed]

CONTEXT: [Which existing features/files are related]
- Related file: backend/src/services/xxxService.js
- Related file: frontend/src/components/Xxx.tsx
- This connects to: [existing feature name]

CONSTRAINTS:
- [ ] Do NOT modify [specific file/table/API]
- [ ] Must use existing [pattern/helper/config]
- [ ] Must work with [role: customer/manager/admin]

FILES TO MODIFY:
- backend/src/services/newService.js (create)
- backend/src/controllers/newController.js (create)
- frontend/src/components/NewComponent.tsx (create)

OUTPUT REQUIRED:
- API: POST /api/xxx returns { id, status, ... }
- UI: New page at /xxx with [description]
- Behavior: When user does X, Y happens

RULES:
- Use formatCurrency() for all money display
- Use country.defaultCenter for map coordinates
- Add authenticate + authorize middleware on protected routes
- Publish events after state changes
```

### Quick Prompt (for small changes)
```
Fix: [what's broken]
File: [exact path]
Expected: [what should happen]
Actual: [what happens now]
```

---

## 3. ANTI-WRONG-APPROACH PROTOCOL

This is EMBEDDED in CLAUDE.md so it runs automatically. But when prompting, you can reinforce it:

```
Before implementing, first:
1. List 2 wrong approaches and why they're wrong
2. Confirm the correct layer (controller/service/model)
3. Then proceed
```

### Common Wrong Approaches This Prevents:

| Wrong Approach | Why It's Wrong | Correct Approach |
|---|---|---|
| Business logic in controller | Violates architecture, untestable | Put in service, controller calls service |
| SQL string interpolation | SQL injection vulnerability | Use $1, $2 parameterized queries |
| Hardcoded `$` or `₹` | Breaks multi-country support | Use `formatCurrency(amount, country)` |
| Hardcoded lat/lng | Breaks multi-country maps | Use `country.defaultCenter` |
| Skip auth middleware | Security vulnerability | Add `authenticate` + `authorize()` |
| Direct DB query in controller | Breaks layer separation | Query in model, called from service |
| No event publishing | Side effects don't trigger | Add `eventBus.publish()` after mutations |

---

## 4. SUB-AGENT SYSTEM

### Agent Selection Matrix

| Task Type | Agent to Use | When |
|---|---|---|
| Start of session | `@preflight` | Every session, always first |
| System is broken | `@fix-system` | Backend/frontend won't start, port conflicts |
| Start full platform | `@run-project` | Need both backend + frontend running |
| Build new feature | `@build-feature` | Any new functionality across layers |
| Fix a bug | `@debug` | Something is broken, need investigation |
| Clean up code | `@refactor` | Code works but violates patterns |
| Backend patterns | `@backend-architecture` | Need help with controller/service/model split |
| Database work | `@database-design` | Schema changes, migrations, indexes |
| API design | `@api-design` | New endpoints, request/response format |
| Map/geo features | `@map-ux` | Leaflet, map interactions, geolocation |
| Real-time updates | `@realtime-system` | Socket.io, live data, WebSocket events |
| Event system | `@event-driven-arch` | Redis pub/sub, event subscribers |
| Background jobs | `@job-queue` | BullMQ workers, scheduled tasks |
| EV domain logic | `@ev-domain-logic` | Charging sessions, queue, predictions |
| UI components | `@frontend-ux` | Tailwind, responsive layouts, components |
| Country/currency | `@country-config` | Multi-country, locale, currency display |
| Route planning | `@route-planning` | EV route calculation, charging stops |
| Payments | `@payment-integration` | Payment flow, Razorpay/Stripe |
| Android Auto | `@android-auto-readiness` | Driver-safe UX, minimal interactions |

### Parallel Agent Patterns

**Full-stack feature (3 agents in parallel):**
```
You: "Build [feature]. Run these in parallel:
1. Backend agent: Create service + model + controller + route
2. Frontend agent: Create component + hook + page
3. Database agent: Create migration if needed"
```

**Debug + Fix (2 agents):**
```
You: "The charging session page is broken.
1. @debug to investigate the API
2. @debug to investigate the frontend component"
```

**Review + Refactor (sequential):**
```
You: "Review backend/src/services/chargingService.js for architecture violations, then @refactor to fix them"
```

---

## 5. SLASH COMMAND REFERENCE

| Command | Usage | What It Does |
|---|---|---|
| `@preflight` | Start of session | Checks PostgreSQL, Redis, backend, frontend, env |
| `@fix-system` | When things break | Diagnoses and repairs all services |
| `@run-project` | Need platform running | Starts backend + frontend with verification |
| `@build-feature` | New functionality | Structured feature dev with anti-wrong-approach |
| `@debug` | Bug investigation | Hypothesis-driven debugging |
| `@refactor` | Code cleanup | Architecture-preserving refactoring |

---

## 6. PERFORMANCE IMPROVEMENT BREAKDOWN

### Prompt Engineering: 5 → 8.5+

**Before (score: 5):**
```
"Add a payment feature"
```
- Ambiguous, no constraints, no file guidance
- Claude guesses architecture, often wrong

**After (score: 8.5+):**
```
OBJECTIVE: Add payment initiation for charging sessions
CONTEXT: Existing chargingService.js handles sessions, paymentService.js exists but incomplete
CONSTRAINTS: Must use Razorpay API, must publish payment.initiated event
FILES: backend/src/services/paymentService.js, backend/src/controllers/paymentController.js
OUTPUT: POST /api/payments/initiate returns { orderId, amount, currency }
RULES: Use formatCurrency(), add authenticate middleware, parameterized SQL
```

**Why it works:** Eliminates ambiguity. Claude knows exactly what layer, what files, what patterns. No guessing.

### Session Efficiency: 5 → 8+

**Before (score: 5):**
- Start coding immediately
- Discover PostgreSQL is down 10 minutes in
- Restart, lose context
- ~21% sessions wasted

**After (score: 8+):**
- `@preflight` catches issues in 30 seconds
- Environment verified before first line of code
- `@fix-system` auto-repairs common failures
- Session waste drops to <5%

**Why it works:** Front-loading environment validation eliminates the #1 cause of wasted sessions.

### Tool Usage: 7 → 9

**Before (score: 7):**
- Using agents but not strategically
- Manually writing similar prompts each time
- Not leveraging parallel execution

**After (score: 9):**
- Agent selection matrix tells you exactly which agent to use
- Master prompt template eliminates repeated prompt writing
- Parallel agent patterns let you build backend + frontend simultaneously
- Anti-wrong-approach catches mistakes before they happen

**Why it works:** Systematic agent selection + parallel execution + structured prompts = maximum throughput with minimum rework.

### Advanced Features: 4 → 8+

**Before (score: 4):**
- Basic agent usage
- No CLAUDE.md system (now you have one)
- No pre-flight checks
- No structured workflow

**After (score: 8+):**
- Full CLAUDE.md with architecture rules, RBAC, common bugs
- 6 specialized workflow agents (preflight, fix-system, build-feature, debug, refactor + existing run-project)
- Anti-wrong-approach protocol embedded in CLAUDE.md
- Master prompt template for consistency
- Parallel agent execution patterns
- Daily workflow system

**Why it works:** Moving from ad-hoc usage to a systematic workflow multiplies effectiveness at every step.

---

## 7. WORKFLOW CHAINING PATTERNS

### Pattern A: New Feature (End-to-End)
```
Session Start:
  @preflight
  ↓ (all green)
  @build-feature with Master Prompt Template
  ↓ (implementation done)
  Manual verification (curl + browser)
  ↓ (looks good)
  Done
```

### Pattern B: Bug Fix
```
Session Start:
  @preflight
  ↓ (all green)
  @debug with symptom description
  ↓ (root cause identified)
  Apply fix (often manual, sometimes @build-feature)
  ↓ (fix applied)
  Verify fix resolves symptom
  ↓ (confirmed)
  Done
```

### Pattern C: System Recovery
```
Session Start:
  @preflight
  ↓ (FAILURES detected)
  @fix-system
  ↓ (services repaired)
  @preflight (re-verify)
  ↓ (all green)
  Continue to actual work
```

### Pattern D: Code Quality Pass
```
  @refactor on target file/directory
  ↓ (violations identified + fixed)
  Manual review of changes
  ↓ (approved)
  Done
```

# EV Charge Hub - Architecture

## 1. System Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 14)                 │
│  App Router │ TypeScript │ Tailwind │ React Query │ Leaflet │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTP + WebSocket
┌───────────────────────┴─────────────────────────────────┐
│                   Backend (Express.js)                    │
│  Routes → Controllers → Services → Models → PostgreSQL   │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │ EventBus │  │ BullMQ   │  │ Socket.io│               │
│  │(Redis P/S)│  │(Workers) │  │(Real-time)│              │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘               │
│       └──────────────┴─────────────┘                     │
└──────────────────────────────────────────────────────────┘
         │                    │                │
    ┌────┴────┐         ┌────┴────┐      ┌────┴────┐
    │PostgreSQL│         │  Redis  │      │ Clients │
    │(primary) │         │(cache/  │      │(browser)│
    │          │         │ pub/sub/│      │         │
    │          │         │ queues) │      │         │
    └──────────┘         └─────────┘      └─────────┘
```

## 2. Backend Layers (MANDATORY)

### 2.1 Layer Responsibilities

| Layer | Location | Responsibility | Rules |
|-------|----------|----------------|-------|
| **Routes** | `src/routes/` | URL → controller mapping, middleware wiring | No logic, no data access |
| **Controllers** | `src/controllers/` | Request parsing, validation rules, response formatting | Thin: parse → call service → respond |
| **Services** | `src/services/` | ALL business logic, orchestration, event publishing | May call multiple models, must throw AppErrors |
| **Models** | `src/models/` | SQL queries only (parameterized) | No business logic, no event publishing |

### 2.2 Cross-Cutting Concerns

| Concern | Location | Mechanism |
|---------|----------|-----------|
| **Auth** | `src/middleware/auth.js` | JWT verify → `req.user`, `authenticate`, `authorize(...roles)`, `optionalAuth` |
| **Validation** | `src/middleware/validate.js` | express-validator, called after validation arrays in controllers |
| **Error Handling** | `src/middleware/errorHandler.js` | Catches thrown errors, maps to HTTP status codes |
| **Audit Logging** | `src/utils/auditLogger.js` | `logAudit()` called from services after mutations |
| **Caching** | `src/utils/cache.js` | Redis-backed cache helper, used in services |
| **Scheduling** | `src/utils/scheduler.js` | setInterval-based schedulers (reservation expiry, analytics, cleanup) |

## 3. Data Flow

### 3.1 Standard Request Flow
```
HTTP Request
  → Route (middleware: auth, validate)
    → Controller (parse params, call service)
      → Service (business logic, validation, orchestration)
        → Model (parameterized SQL → PostgreSQL)
      ← Service (optionally: publish event, audit log)
    ← Controller (format response)
  ← HTTP Response
```

### 3.2 Event-Driven Flow
```
Service mutation (e.g., session started)
  → eventBus.publish('charging.started', payload)
    → Persisted to event_logs table
    → Published to Redis channel
    → Local in-process handlers called
      → Subscriber: WebSocket broadcast
      → Subscriber: BullMQ job enqueue
      → Subscriber: Cache invalidation
```

### 3.3 Real-Time Flow
```
Socket.io connection (browser)
  → Join room (e.g., station:{id}, user:{id})
  → Event subscriber broadcasts to room
  → Client receives update (session progress, slot freed, queue update)
```

## 4. Frontend Architecture

### 4.1 Structure

| Layer | Location | Purpose |
|-------|----------|---------|
| **Pages** | `src/app/` | Next.js App Router pages |
| **Components** | `src/components/` | Grouped by domain (stations/, energy/, route/, etc.) |
| **Hooks** | `src/hooks/` | React Query hooks (`useStations`, `useIntelligent`, `useAdmin`, `useSocket`) |
| **Context** | `src/context/` | AuthContext, CountryContext, QueryProvider |
| **Lib** | `src/lib/` | API client (axios), countries config, currency formatting, roles |
| **Types** | `src/types/` | TypeScript interfaces for all domain models |
| **Styles** | `src/styles/` | Global CSS (Tailwind) |

### 4.2 State Management

- **Server state**: React Query (`@tanstack/react-query`) — all API data
- **Auth state**: React Context (`AuthContext`) — JWT + user
- **Country state**: React Context (`CountryContext`) — locale, currency, map center
- **Real-time**: Socket.io client (`useSocket` hook)

### 4.3 API Client

- Axios instance at `src/lib/api.ts`
- Bearer token auto-attached via interceptor
- Base URL: `http://localhost:3001/api`

## 5. Database

- **PostgreSQL** with extensions: `uuid-ossp`, `cube`, `earthdistance`
- **13 migrations** (001–013), sequential SQL files run by `src/migrations/run.js`
- **Seed data** via `src/migrations/seed.js`
- **UUIDs** for all primary keys
- **JSONB** for flexible fields (operating_hours, vehicle_info, metadata)
- **Enums** for status fields (PostgreSQL custom types)
- **earthdistance** for geospatial queries (nearby stations)

## 6. Infrastructure Services

### 6.1 Redis (ioredis)
- **Caching**: Station data, predictions, congestion, grid profiles
- **Pub/Sub**: Event broadcasting across processes
- **BullMQ**: Job queue backing store
- **Graceful degradation**: App runs without Redis (no cache/events/jobs)

### 6.2 BullMQ
- **Queues**: `src/jobs/queues.js` — analytics aggregation, energy cleanup
- **Workers**: `src/jobs/workers.js` — process queued jobs
- **Repeatable**: Scheduled jobs (analytics, cleanup)

### 6.3 Socket.io
- **Rooms**: `station:{id}`, `user:{id}`, `admin`
- **Events**: session progress, slot status, queue updates
- **CORS**: Configured via env

## 7. Security

- **JWT authentication** (jsonwebtoken)
- **Role-based authorization** (customer/manager/admin)
- **Parameterized SQL** (no string interpolation — `$1, $2` only)
- **Rate limiting** (express-rate-limit)
- **Helmet** (security headers)
- **CORS** (configured origins)
- **Input validation** (express-validator)
- **Audit trail** (audit_logs table)

## 8. Module System

- **Backend**: CommonJS (`require`/`module.exports`)
- **Frontend**: ES Modules (TypeScript)

# EV Charge Hub - System Architecture

## 1. High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐    │
│  │  Next.js App  │  │  Mobile Web  │  │  Station Hardware  │    │
│  │  (React/TW)  │  │  (Responsive) │  │  (IoT/Manager App)│    │
│  └──────┬───────┘  └──────┬───────┘  └────────┬───────────┘    │
│         │                 │                    │                │
│         └────────────┬────┘                    │                │
│                      │                         │                │
│              ┌───────▼─────────┐    ┌──────────▼──────────┐    │
│              │  REST API (HTTP) │    │  WebSocket (WS)     │    │
│              │  fetch/axios     │    │  socket.io-client   │    │
│              └───────┬─────────┘    └──────────┬──────────┘    │
└──────────────────────┼─────────────────────────┼────────────────┘
                       │                         │
          ┌────────────▼─────────────────────────▼────────────────┐
          │                   API GATEWAY LAYER                    │
          │  ┌──────────┐ ┌───────────┐ ┌──────────┐             │
          │  │  Helmet   │ │   CORS    │ │Rate Limit│             │
          │  │(Security) │ │           │ │          │             │
          │  └──────────┘ └───────────┘ └──────────┘             │
          └──────────────────────┬────────────────────────────────┘
                                │
          ┌─────────────────────▼─────────────────────────────────┐
          │                 APPLICATION LAYER                      │
          │                                                       │
          │  ┌─────────────────┐  ┌──────────────────────┐       │
          │  │   Express.js    │  │    Socket.io Server   │       │
          │  │   REST Server   │  │    (Real-time)        │       │
          │  └────────┬────────┘  └──────────┬───────────┘       │
          │           │                      │                    │
          │  ┌────────▼──────────────────────▼───────────┐       │
          │  │              MIDDLEWARE LAYER               │       │
          │  │  Auth (JWT) │ Validation │ Error Handler   │       │
          │  └────────────────────┬──────────────────────┘       │
          │                       │                               │
          │  ┌────────────────────▼──────────────────────┐       │
          │  │              CONTROLLERS                    │       │
          │  │  Auth │ Station │ Reservation │ Charging    │       │
          │  │  Admin │ Prediction                         │       │
          │  └────────────────────┬──────────────────────┘       │
          │                       │                               │
          │  ┌────────────────────▼──────────────────────┐       │
          │  │              SERVICES                       │       │
          │  │  authService │ stationService               │       │
          │  │  reservationService │ chargingService        │       │
          │  │  predictionService (Smart Slot AI)           │       │
          │  └────────────────────┬──────────────────────┘       │
          │                       │                               │
          │  ┌────────────────────▼──────────────────────┐       │
          │  │              MODELS (Data Access)           │       │
          │  │  User │ Station │ ChargingSlot              │       │
          │  │  Reservation │ ChargingSession              │       │
          │  └────────────────────┬──────────────────────┘       │
          └───────────────────────┼───────────────────────────────┘
                                  │
          ┌───────────────────────▼───────────────────────────────┐
          │                  DATA LAYER                            │
          │  ┌──────────────────────────────────────────┐         │
          │  │           PostgreSQL Database             │         │
          │  │  Users │ Stations │ Slots │ Reservations  │         │
          │  │  Sessions │ History │ Reviews │ Audit Logs │         │
          │  │  + PostGIS (earthdistance) for geo queries │         │
          │  └──────────────────────────────────────────┘         │
          └───────────────────────────────────────────────────────┘
```

## 2. Project Folder Structure

```
ev-charging-prototype/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.js          # PostgreSQL connection pool
│   │   │   └── env.js               # Environment configuration
│   │   ├── controllers/
│   │   │   ├── authController.js     # Register, login, profile
│   │   │   ├── stationController.js  # CRUD stations & slots
│   │   │   ├── reservationController.js
│   │   │   ├── chargingController.js # Session management
│   │   │   └── adminController.js    # Admin operations
│   │   ├── middleware/
│   │   │   ├── auth.js               # JWT auth & role authorization
│   │   │   ├── validate.js           # Request validation
│   │   │   └── errorHandler.js       # Global error handler
│   │   ├── models/
│   │   │   ├── User.js
│   │   │   ├── Station.js            # Includes geo queries
│   │   │   ├── ChargingSlot.js
│   │   │   ├── Reservation.js
│   │   │   └── ChargingSession.js
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── stations.js
│   │   │   ├── reservations.js
│   │   │   ├── charging.js
│   │   │   ├── admin.js
│   │   │   └── predictions.js
│   │   ├── services/
│   │   │   ├── authService.js
│   │   │   ├── stationService.js
│   │   │   ├── reservationService.js
│   │   │   ├── chargingService.js
│   │   │   └── predictionService.js  # Smart Slot Prediction
│   │   ├── websocket/
│   │   │   └── socketHandler.js      # Real-time events
│   │   ├── migrations/
│   │   │   ├── 001_initial_schema.sql
│   │   │   ├── run.js                # Migration runner
│   │   │   └── seed.js               # Sample data
│   │   ├── app.js                    # Express app config
│   │   └── server.js                 # HTTP + WebSocket entry
│   ├── tests/
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx            # Root layout with AuthProvider
│   │   │   ├── page.tsx              # Landing page
│   │   │   ├── map/page.tsx          # Map view + station discovery
│   │   │   ├── stations/[id]/page.tsx # Station detail + reservation
│   │   │   ├── reservations/page.tsx  # Reservation history
│   │   │   ├── (auth)/
│   │   │   │   ├── login/page.tsx
│   │   │   │   └── register/page.tsx
│   │   │   └── (dashboard)/
│   │   │       ├── customer/page.tsx  # Customer dashboard
│   │   │       ├── manager/page.tsx   # Station manager dashboard
│   │   │       └── admin/page.tsx     # Admin dashboard
│   │   ├── components/
│   │   │   ├── layout/Navbar.tsx
│   │   │   ├── map/StationMap.tsx     # Leaflet/OpenStreetMap
│   │   │   └── stations/
│   │   │       ├── StationCard.tsx
│   │   │       ├── SlotGrid.tsx
│   │   │       └── PredictionBanner.tsx
│   │   ├── context/AuthContext.tsx
│   │   ├── hooks/
│   │   │   ├── useGeolocation.ts
│   │   │   └── useSocket.ts
│   │   ├── lib/
│   │   │   ├── api.ts                # API client
│   │   │   └── socket.ts             # WebSocket client
│   │   ├── types/index.ts
│   │   └── styles/globals.css
│   ├── package.json
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── next.config.js
├── ARCHITECTURE.md
└── .gitignore
```

## 3. Backend Architecture

### Pattern: Controller → Service → Model

```
Request → Route → Middleware → Controller → Service → Model → Database
                 (auth/validate)   (HTTP)    (logic)   (SQL)
```

- **Controllers** handle HTTP request/response, input validation rules, and delegating to services
- **Services** contain business logic, authorization checks, cross-model orchestration
- **Models** are the data access layer with raw SQL queries via `pg`

### Middleware Pipeline

1. `helmet()` - Security headers
2. `cors()` - Cross-origin configuration
3. `express.json()` - Body parsing
4. `morgan()` - Request logging
5. `rateLimit()` - Request throttling
6. `authenticate` - JWT verification (per-route)
7. `authorize(roles)` - Role-based access (per-route)
8. `validate` - express-validator result check (per-route)
9. `errorHandler` - Global catch-all error handler

## 4. Database Schema Design

### Entity Relationship Diagram

```
users 1──N stations          (manager owns stations)
users 1──N reservations      (customer makes reservations)
users 1──N charging_sessions (customer has sessions)
stations 1──N charging_slots (station has slots)
stations 1──N reservations   (station receives reservations)
charging_slots 1──N reservations
charging_slots 1──1 charging_sessions (current session)
reservations 1──0..1 charging_sessions
stations 1──N slot_usage_history (for predictions)
users 1──N reviews
stations 1──N reviews
users 1──N notifications
users 1──N audit_logs
```

### Key Design Decisions

- **UUIDs** for all primary keys (prevents enumeration attacks, safe for distributed systems)
- **ENUM types** for status fields (database-level validation)
- **JSONB** for flexible fields (operating_hours, vehicle_info, metadata)
- **earthdistance extension** for efficient geospatial queries
- **Composite unique indexes** to prevent double-booking and duplicate reviews
- **Triggers** for automatic `updated_at` timestamp management

## 5. SQL Tables Summary

| Table | Purpose | Key Indexes |
|---|---|---|
| `users` | All platform users (customers, managers, admins) | email, role |
| `stations` | Charging station locations and details | manager_id, status, geospatial |
| `charging_slots` | Individual charging connectors at stations | station_id, status |
| `reservations` | Time-slot bookings by customers | user_id, slot_id, schedule range |
| `charging_sessions` | Active/completed charging records | slot_id, user_id, status |
| `slot_usage_history` | Aggregated usage data for predictions | slot_id, day+hour composite |
| `reviews` | Station ratings and comments | station_id, unique(user,station) |
| `notifications` | User notifications | user_id, read status |
| `audit_logs` | Admin activity tracking | user_id, action, entity |

## 6. API Architecture Overview

### Authentication
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Create account |
| POST | `/api/auth/login` | Public | Authenticate |
| GET | `/api/auth/profile` | Auth | Get current user |

### Stations
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/stations/nearby?lat=&lng=` | Public | Find nearby stations |
| GET | `/api/stations/search?query=` | Public | Search stations |
| GET | `/api/stations/:id` | Public | Station details + slots |
| POST | `/api/stations` | Manager | Create station |
| PUT | `/api/stations/:id` | Manager | Update own station |
| POST | `/api/stations/:id/slots` | Manager | Add charging slot |
| PATCH | `/api/stations/:id/approve` | Admin | Approve station |
| PATCH | `/api/stations/:id/reject` | Admin | Reject station |
| PATCH | `/api/stations/:id/disable` | Admin | Disable station |

### Reservations
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/reservations` | Auth | Create reservation |
| GET | `/api/reservations/my` | Auth | User's reservations |
| GET | `/api/reservations/:id` | Auth | Reservation details |
| PATCH | `/api/reservations/:id/cancel` | Auth | Cancel reservation |
| GET | `/api/reservations/station/:id` | Manager | Station reservations |

### Charging Sessions
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/charging/start` | Auth | Start charging session |
| PATCH | `/api/charging/:id/progress` | Manager | Update progress |
| PATCH | `/api/charging/:id/complete` | Manager | Complete session |
| GET | `/api/charging/active` | Auth | User's active sessions |

### Smart Predictions
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/predictions/stations/:id/next-available` | Public | Predict next available slot |

### Admin
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/admin/stats` | Admin | Platform statistics |
| GET | `/api/admin/users` | Admin | List all users |
| PATCH | `/api/admin/users/:id/toggle-status` | Admin | Enable/disable user |
| GET | `/api/admin/stations` | Admin | All stations with filters |

### WebSocket Events

| Event | Direction | Description |
|---|---|---|
| `subscribe:station` | Client → Server | Watch station updates |
| `charging:progress` | Client → Server | Manager sends progress |
| `slot:updated` | Server → Client | Slot data changed |
| `slot:statusChanged` | Server → Client | Slot availability changed |
| `charging:update` | Server → Client | Session progress for user |

## 7. Scalability Considerations

### Database
- **Connection pooling** (max 20 connections with `pg` Pool)
- **PostGIS/earthdistance** for O(log n) geospatial queries instead of O(n) Haversine in app code
- **Composite indexes** on high-frequency query patterns (slot+schedule, station+status)
- **JSONB** for flexible schema evolution without migrations
- Future: Read replicas for search-heavy queries, partitioning on `charging_sessions` by date

### Application
- **Stateless API servers** - JWT auth enables horizontal scaling behind a load balancer
- **Service layer separation** enables extracting services to microservices later
- **Socket.io rooms** for targeted broadcasting (per-station, per-user) instead of global broadcast
- Future: Redis adapter for Socket.io to share state across multiple Node processes

### Frontend
- **Next.js SSR/SSG** for initial page loads, client-side navigation after
- **Dynamic imports** for Leaflet (heavy library loaded only on map pages)
- **Geolocation caching** (maximumAge: 5 minutes) to reduce GPS calls

### Prediction System
- **Pre-aggregated history** in `slot_usage_history` table avoids expensive real-time analytics
- **Incremental averaging** (running average update formula) keeps aggregation O(1) per session
- **Multi-source prediction** (active sessions, reservations, historical) with automatic fallback

## 8. Security Considerations

### Authentication & Authorization
- **bcryptjs** with cost factor 12 for password hashing
- **JWT** tokens with configurable expiry
- **Role-based access control** at route and service levels
- Password hash never included in API responses

### API Security
- **Helmet.js** sets security headers (CSP, HSTS, X-Frame-Options, etc.)
- **CORS** restricted to specific frontend origin
- **Rate limiting** globally (100 req/15min) and stricter for auth endpoints (20 req/15min)
- **Input validation** with express-validator on all mutation endpoints
- **Parameterized SQL queries** everywhere (no string interpolation) - prevents SQL injection

### Data Protection
- **UUID primary keys** prevent ID enumeration attacks
- **Owner checks** in services (managers can only modify their own stations)
- **Audit logging** for admin actions
- **Reservation conflict detection** with database-level checks

### WebSocket Security
- **JWT authentication** on WebSocket connections
- **Role checks** before processing manager-only events
- **Room-based broadcasting** limits data exposure to subscribed clients

### Infrastructure (Production Recommendations)
- HTTPS/TLS termination at load balancer
- Environment variables for all secrets (never committed)
- Database connection over SSL in production
- Regular dependency audits (`npm audit`)

# EV Charge Hub - Product Specification

## 1. Product Overview

EV Charge Hub is a full-stack EV charging platform enabling station discovery, slot reservations, real-time charging sessions, smart queue management, predictive intelligence, payments, route planning, gamification, and community reviews. Default market: India (INR).

## 2. User Roles

| Role | Description |
|------|-------------|
| `customer` | Discovers stations, reserves slots, charges vehicles, earns rewards |
| `manager` | Creates/manages stations, configures pricing/slots/operating hours |
| `admin` | Platform oversight, approvals, analytics, infrastructure planning |

## 3. Feature Modules

### 3.1 Core Platform

| Module | Description | Status |
|--------|-------------|--------|
| **Auth** | Register, login (JWT), profile management | Done |
| **Stations** | CRUD, nearby search (earthdistance), approval workflow | Done |
| **Slots** | Per-station charging slots with type/connector/power metadata | Done |
| **Reservations** | Time-slot booking with auto-expiry scheduler | Done |
| **Charging Sessions** | Start/stop/progress tracking, cost calculation | Done |
| **Payments** | Payment records, provider-agnostic (Razorpay/Stripe ready) | Done |
| **Admin** | Platform stats, user/station management, audit logs | Done |

### 3.2 Intelligence Layer (`/api/intelligent/...`)

| Module | Description | Status |
|--------|-------------|--------|
| **Smart Predictions** | Slot availability prediction (multi-source: progress, reservation, historical) | Done |
| **Demand Forecasting** | Hourly/daily demand patterns per station | Done |
| **Recommendations** | Multi-factor station scoring (distance, speed, wait, rating, reliability) | Done |
| **Dynamic Pricing** | Time-of-day pricing rules per station | Done |
| **Analytics** | Platform/station-level metrics, trends, peak hours | Done |
| **Battery Digital Twin** | Per-session battery simulation (SoC, thermal, degradation) | Done |
| **Congestion Prediction** | Station congestion forecasting with confidence scores | Done |
| **Grid Load Balancing** | Station power allocation, load status monitoring | Done |
| **Carbon Footprint** | Per-session/user/station/platform carbon tracking | Done |
| **Energy Optimization** | Load shifting, demand redirect, schedule optimization recommendations | Done |
| **Slot Allocation** | Autonomous slot ranking + virtual queue system | Done |
| **Mobility Analytics** | Heatmaps, charging behavior, city trends, infrastructure gap analysis | Done |
| **Battery Health** | User battery degradation tracking, health recommendations | Done |
| **Predictive Scheduling** | AI-suggested optimal charging times based on congestion data | Done |
| **Range Safety** | Vehicle range estimation, trip safety checks, low-battery alerts | Done |
| **Community Reviews** | Multi-dimension ratings, reliability scores, helpfulness voting | Done |
| **Gamification** | Points wallet, badges, levels, streaks, rewards catalog, leaderboard | Done |

### 3.3 Supporting Features

| Module | Description | Status |
|--------|-------------|--------|
| **Route Planning** | Multi-stop route with charging stops, battery-aware ETA | Done |
| **Plug & Charge** | Auto-start sessions on vehicle plug event | Done |
| **Real-time Updates** | WebSocket (Socket.io) for session progress, slot status, queue updates | Done |
| **Event System** | Redis Pub/Sub + in-process event bus, persisted to `event_logs` | Done |
| **Background Jobs** | BullMQ workers for analytics aggregation, energy cleanup | Done |
| **Demo Simulator** | Auto-generates charging activity for demo/dev mode | Done |
| **Operating Hours** | Per-station scheduled hours with day-of-week granularity | Done |

## 4. Data Model (Core Entities)

```
users ──< stations ──< charging_slots ──< charging_sessions
                  │                  └──< reservations
                  └──< reviews
```

- **users**: UUID PK, email, password_hash, role enum, active/verified flags
- **stations**: UUID PK, manager FK, geo (lat/lng + earthdistance), status enum, operating_hours JSONB, amenities array, pricing_per_kwh
- **charging_slots**: UUID PK, station FK, slot_number, type/connector enums, power_output_kw, status enum
- **reservations**: UUID PK, user/slot/station FKs, scheduled_start/end, status enum
- **charging_sessions**: UUID PK, slot/user FKs, SoC tracking, energy/cost, status enum
- **Additional tables**: notifications, audit_logs, event_logs, slot_usage_history, payments, pricing_rules, carbon_records, energy_recommendations, slot_allocation_queue, heatmap_data, behavior_stats, city_ev_trends, infra_recommendations, battery_health_profiles, scheduling_preferences, vehicle_range_profiles, range_alerts, community_reviews, reliability_scores, points_wallets, points_transactions, badges, user_badges, rewards, reward_redemptions

## 5. API Surface

| Route Group | Base Path | Auth |
|-------------|-----------|------|
| Auth | `/api/auth` | Public (login/register), Protected (profile) |
| Stations | `/api/stations` | Public (search/nearby/details), Manager (CRUD), Admin (approve/reject) |
| Reservations | `/api/reservations` | Customer |
| Charging | `/api/charging` | Customer |
| Payments | `/api/payments` | Customer |
| Predictions | `/api/predictions` | Public |
| Route Planner | `/api/route-planner` | Public |
| Plug & Charge | `/api/plug-charge` | Customer |
| Intelligent | `/api/intelligent/*` | Mixed (see routes) |
| Admin | `/api/admin` | Admin only |

## 6. Non-Functional Requirements

- **Performance**: Sub-10ms p99 for DB-hitting endpoints under load (verified by benchmarks)
- **Real-time**: WebSocket for live session/slot/queue updates
- **Resilience**: Graceful degradation if Redis unavailable
- **Security**: JWT auth, role-based access, parameterized SQL, rate limiting, helmet, CORS
- **Scalability**: Event-driven architecture, BullMQ for async work, Redis caching
- **Observability**: Audit logs, event logs, structured console logging
- **Demo Mode**: Self-running demo simulator for showcasing

## 7. Default Configuration

- **Country**: India (`IN`)
- **Currency**: INR (stored in DB, converted at display time)
- **Map Center**: India coordinates via `countries.ts`
- **Backend Port**: 3001
- **Frontend Port**: 3000

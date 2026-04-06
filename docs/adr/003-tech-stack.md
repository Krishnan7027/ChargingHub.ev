# ADR-003: Technology Stack

## Status: Accepted

## Decision

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Backend runtime | Node.js (Express) | Fast prototyping, large ecosystem |
| Frontend | Next.js 14 (App Router) | SSR/SSG, file-based routing, React ecosystem |
| Language (FE) | TypeScript | Type safety, IDE support |
| Language (BE) | JavaScript (CommonJS) | Simplicity for prototype, no build step |
| Database | PostgreSQL + earthdistance | Geospatial queries, JSONB, robust SQL |
| Cache/Pub-Sub | Redis (ioredis) | Fast caching, native pub/sub, BullMQ backing |
| Job Queue | BullMQ | Redis-backed, reliable, repeatable jobs |
| Real-time | Socket.io | WebSocket with fallback, room-based broadcasting |
| Maps | Leaflet + OpenStreetMap | Free, no API key required |
| Styling | Tailwind CSS | Utility-first, responsive-first |
| API State | React Query | Server state management, caching, refetching |
| Auth | JWT (jsonwebtoken) | Stateless, simple, well-understood |

## Consequences
- No TypeScript on backend means less type safety (acceptable for prototype)
- CommonJS limits ESM interop (no dynamic imports needed currently)
- PostgreSQL earthdistance is simpler than PostGIS but less powerful (sufficient for station search)

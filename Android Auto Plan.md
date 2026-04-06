# EV Charge Hub — Android Auto Roadmap

## Executive Summary

Transform the existing EV Charging web platform into an Android Auto-ready system that drivers can safely use while operating their EV. This roadmap covers 8 phases across 16 weeks, from web hardening through Android Auto certification.

---

## Current State Assessment

| Area | Status | Readiness |
|------|--------|-----------|
| Backend API (Node.js/Express) | Production-grade with Redis, BullMQ, event bus | High |
| Real-time (Socket.io) | Working with room-based broadcasting | High |
| Station Discovery | Geo queries with earthdistance | High |
| Route Planning | Basic with charging stops | Medium |
| Prediction Engine | Multi-factor with ETA-based predictions | High |
| Smart Queue | Working with auto-assignment | High |
| Payment System | Mock provider, async via BullMQ | Medium |
| Mobile App | None — web only | Not Started |
| Android Auto | None | Not Started |
| Voice Interface | None | Not Started |

---

## PHASE 1: FOUNDATION (Web App Hardening)
**Timeline: Weeks 1–2 | Goal: Rock-solid backend for mobile clients**

### 1.1 API Performance Optimization
- **Title:** Add Redis caching layer to high-frequency endpoints
- **Description:** Replace in-memory TTLCache with Redis for `/stations/nearby`, `/predictions`, and `/stations/:id`. This enables cache sharing across multiple Node processes and persists across restarts.
- **Priority:** High
- **Dependencies:** Redis (already installed)
- **Effort:** Medium
- **Outcome:** P95 latency for station queries drops from ~120ms to ~15ms for cache hits

### 1.2 API Response Compression & Pagination
- **Title:** Add gzip compression and strict pagination to all list endpoints
- **Description:** Enable `compression` middleware. Enforce `limit/offset` on all list endpoints. Add `ETag` headers for conditional requests. Mobile clients on cellular need minimal payload sizes.
- **Priority:** High
- **Dependencies:** None
- **Effort:** Small
- **Outcome:** 60-70% reduction in response payload sizes

### 1.3 API Versioning
- **Title:** Introduce `/api/v1/` prefix for all endpoints
- **Description:** Mobile apps can't force-update like web apps. Version the API so breaking changes don't crash older app versions. Keep `/api/` as alias to v1 for backward compatibility.
- **Priority:** High
- **Dependencies:** None
- **Effort:** Small
- **Outcome:** Safe to evolve API without breaking deployed mobile clients

### 1.4 Offline-Friendly Data Contract
- **Title:** Design API responses for offline cacheability
- **Description:** Add `Cache-Control` headers, `last_updated` timestamps on all station/slot responses. Create a `/stations/bulk` endpoint that returns all stations within a bounding box in a single call (for offline map pre-loading).
- **Priority:** Medium
- **Dependencies:** 1.1
- **Effort:** Medium
- **Outcome:** Mobile app can cache station data and show stale-but-useful results when offline

### 1.5 WebSocket Reconnection Hardening
- **Title:** Add heartbeat, exponential backoff, and session resumption to Socket.io
- **Description:** Mobile connections drop frequently (tunnels, cell handoffs). Implement server-side session persistence so reconnected clients get missed events. Add a `/events/since?timestamp=` REST fallback for clients that can't maintain WebSocket.
- **Priority:** High
- **Dependencies:** Redis (for session store)
- **Effort:** Medium
- **Outcome:** Zero missed real-time updates even on flaky mobile networks

### 1.6 Health Check & Monitoring Enhancement
- **Title:** Add `/api/health/deep` with dependency checks and latency metrics
- **Description:** Check PostgreSQL, Redis, BullMQ queue depths, and Socket.io connection count. This becomes the mobile app's "is the service healthy" check before showing degraded UX.
- **Priority:** Medium
- **Dependencies:** None
- **Effort:** Small
- **Outcome:** Mobile app can detect degraded backend and switch to offline mode proactively

---

## PHASE 2: SMART EV FEATURES
**Timeline: Weeks 2–4 | Goal: Intelligence layer that powers driving-mode recommendations**

### 2.1 Enhanced Prediction Engine
- **Title:** Add traffic-aware and weather-aware prediction modifiers
- **Description:** Extend `predictForArrival()` to accept traffic delay estimates and weather conditions. Rain/cold increases charging time ~10-15%. Rush hour affects station congestion. Feed these factors into confidence scoring.
- **Priority:** High
- **Dependencies:** Phase 1.1 (Redis cache for prediction results)
- **Effort:** Medium
- **Outcome:** Predictions account for real-world conditions, not just historical patterns

### 2.2 AI Station Recommendation v2
- **Title:** Build personalized recommendation engine using user charging history
- **Description:** Track user's preferred connector types, power levels, price sensitivity, and typical charge targets. Score stations not just by distance/availability but by personal fit. Store preferences in `scheduling_preferences` table.
- **Priority:** High
- **Dependencies:** Existing recommendation service
- **Effort:** Large
- **Outcome:** "Find me a charger" returns the station the user would actually choose, not just the nearest

### 2.3 Battery-Aware Route Intelligence
- **Title:** Create endpoint that accepts current battery %, destination, and vehicle profile to return optimal route with charging stops
- **Description:** Extend route planning service to factor in: real-time station availability at predicted arrival time, charging speed vs queue wait tradeoff, user's time vs cost preferences. Return a ranked list of route options (fastest, cheapest, fewest stops).
- **Priority:** High
- **Dependencies:** 2.1, existing route planner
- **Effort:** Large
- **Outcome:** Driver gets "Start driving, stop at Station X in 45 min, arrive at destination with 25% battery" guidance

### 2.4 Proactive Alerts System
- **Title:** Push-triggered alerts for low battery + nearby stations, reservation reminders, queue assignments
- **Description:** Create an alert evaluation service that runs every 30s for active users. Checks: battery level (from connected vehicle or user input) vs distance to nearest station, upcoming reservation start times, queue position changes. Delivers via WebSocket + push notification.
- **Priority:** Medium
- **Dependencies:** 2.1, Phase 3 (push notifications)
- **Effort:** Medium
- **Outcome:** Driver gets "Battery at 15% — Station 2km ahead has a free DC fast charger" without asking

### 2.5 Station Availability Confidence Scores
- **Title:** Add real-time confidence indicators to availability data
- **Description:** A station showing "2 available" from 30s-old data is different from real-time confirmed data. Add `data_freshness_seconds` and `confidence` fields to all station responses. Mobile app displays "Available (live)" vs "Likely available (2 min ago)".
- **Priority:** Medium
- **Dependencies:** 1.5 (WebSocket hardening)
- **Effort:** Small
- **Outcome:** Driver trusts the data and doesn't arrive at a "available" station that's actually full

---

## PHASE 3: MOBILE APP LAYER
**Timeline: Weeks 4–7 | Goal: Native Android app that shares backend with web**

### 3.1 React Native Project Setup
- **Title:** Initialize React Native project with Expo (managed workflow) targeting Android
- **Description:** Use Expo SDK 51+ for managed workflow. Configure: React Navigation, React Query (reuse query hooks pattern from web), Axios with same interceptor setup, Socket.io client. Mono-repo structure alongside existing frontend.
- **Priority:** High
- **Dependencies:** Phase 1 (stable API)
- **Effort:** Medium
- **Outcome:** Buildable Android APK with navigation skeleton and API connectivity

### 3.2 Authentication & Token Management
- **Title:** Implement secure token storage and biometric unlock
- **Description:** Store JWT in Android Keystore (via `expo-secure-store`). Implement token refresh flow. Add fingerprint/face unlock for app resume. Auto-login on app start if token valid.
- **Priority:** High
- **Dependencies:** 3.1
- **Effort:** Medium
- **Outcome:** User logs in once, stays authenticated across app restarts

### 3.3 Location Service Integration
- **Title:** Implement continuous background location tracking with battery optimization
- **Description:** Use `expo-location` with foreground service for navigation mode, significant-change monitoring for background. Geofence nearby stations (500m radius) for arrival detection. Request location permissions with clear explanation UI.
- **Priority:** High
- **Dependencies:** 3.1
- **Effort:** Medium
- **Outcome:** App always knows user's position, triggers actions on arrival at station

### 3.4 Push Notification System
- **Title:** Implement Firebase Cloud Messaging for real-time alerts
- **Description:** Register FCM token on login, store server-side. BullMQ notification worker sends to FCM in addition to WebSocket. Handle notification tap → deep link to relevant screen (station detail, reservation, charging session).
- **Priority:** High
- **Dependencies:** 3.1, BullMQ notification worker (already exists)
- **Effort:** Medium
- **Outcome:** Alerts reach driver even when app is backgrounded or screen off

### 3.5 Offline Data Layer
- **Title:** Implement local SQLite cache for stations, reservations, and user preferences
- **Description:** On app start and periodically, sync station data for user's region (50km radius). Cache last 20 reservations, active sessions, vehicle profiles. Show cached data with "offline" indicator when no network. Queue mutations (cancel reservation) for retry when online.
- **Priority:** Medium
- **Dependencies:** 3.1, 1.4 (offline-friendly API)
- **Effort:** Large
- **Outcome:** App is functional in tunnels, parking garages, and spotty rural coverage

### 3.6 Map Screen (Native)
- **Title:** Build native map view with station markers, user location, and route display
- **Description:** Use `react-native-maps` (Google Maps provider). Port station marker logic from web Leaflet. Show user location with accuracy circle. Cluster markers at low zoom. Tap marker → station detail bottom sheet.
- **Priority:** High
- **Dependencies:** 3.3
- **Effort:** Medium
- **Outcome:** Native-feeling map that matches web functionality but with native performance

### 3.7 Core Screens Implementation
- **Title:** Build station detail, reservation flow, charging session, and profile screens
- **Description:** Reuse API hooks and business logic from web. Native UI with React Native Paper or custom components. Screens: Station List, Station Detail (slots + prediction + reserve), My Reservations, Active Charging, Profile + Vehicles.
- **Priority:** High
- **Dependencies:** 3.6
- **Effort:** Large
- **Outcome:** Feature-complete mobile app matching web capabilities

---

## PHASE 4: DRIVER-SAFE UX DESIGN
**Timeline: Weeks 6–8 (overlaps with Phase 3) | Goal: UX that passes Android Auto safety review**

### 4.1 Driving Mode Design System
- **Title:** Create a constrained UI component library for driving contexts
- **Description:** Design rules: minimum touch target 76dp, maximum 6 items in any list, no text input while moving, high contrast (day/night), maximum 2 levels of navigation depth. Create reusable components: LargeListItem, ActionButton, StatusCard, SimpleBanner.
- **Priority:** High
- **Dependencies:** None (design work)
- **Effort:** Medium
- **Outcome:** Component library that enforces safety constraints at the component level

### 4.2 Voice Command Architecture
- **Title:** Design voice intent system for hands-free station discovery and navigation
- **Description:** Define voice intents: "Find nearest charger", "Find fast charger", "Navigate to [station name]", "How far to nearest charger?", "Start charging", "Check my reservation". Map each intent to an API call + UI response + optional navigation trigger. Use Android's built-in speech recognition.
- **Priority:** High
- **Dependencies:** 4.1
- **Effort:** Large
- **Outcome:** Driver can accomplish all core tasks without touching the screen

### 4.3 Contextual Auto-Actions
- **Title:** Implement automatic actions based on driving context
- **Description:** When battery < 20% and driving: auto-show nearest charger banner. When approaching reserved station (geofence): auto-show "Arriving at [station]" with slot info. When charging complete: auto-show "Charging done, ready to go" with cost summary. All dismissable with single tap or voice "OK".
- **Priority:** Medium
- **Dependencies:** 3.3 (location), 3.4 (notifications), 2.4 (alerts)
- **Effort:** Medium
- **Outcome:** The app anticipates the driver's needs instead of requiring them to ask

### 4.4 Night Mode & Glare Optimization
- **Title:** Implement auto-switching dark theme optimized for in-car displays
- **Description:** Detect ambient light or time-of-day. Night mode: true black backgrounds (#000), high-contrast text, reduced blue light. Day mode: anti-glare high-contrast. Avoid pure white backgrounds that blind drivers at night.
- **Priority:** Medium
- **Dependencies:** 4.1
- **Effort:** Small
- **Outcome:** Screen readable in all lighting conditions without causing driver distraction

### 4.5 Motion-Locked UI States
- **Title:** Detect vehicle motion and restrict UI interactions accordingly
- **Description:** When speed > 5 km/h: disable text input, limit list scrolling to 6 items, hide complex screens (reviews, analytics, settings), show only: map, nearest stations, active session, navigation trigger. When stopped: unlock full UI. Use accelerometer + GPS speed for detection.
- **Priority:** High
- **Dependencies:** 3.3 (location for speed)
- **Effort:** Medium
- **Outcome:** Impossible for driver to engage in dangerous multi-step interactions while moving

---

## PHASE 5: ANDROID AUTO INTEGRATION
**Timeline: Weeks 8–11 | Goal: Working Android Auto app with Google certification**

### 5.1 Android Auto Module Setup
- **Title:** Create native Android module using Car App Library (Jetpack)
- **Description:** Android Auto does NOT support React Native directly. Create a native Kotlin module that implements `CarAppService` and `Session`. Communicates with React Native via bridge for shared data (auth token, cached stations, user preferences). Uses Car App Library templates only — no custom rendering.
- **Priority:** High
- **Dependencies:** Phase 3 (mobile app), Phase 4 (UX design)
- **Effort:** Large
- **Outcome:** Android Auto recognizes and launches the EV Charge Hub app

### 5.2 Place List Template — Nearby Stations
- **Title:** Implement nearby stations screen using Android Auto's `PlaceListMapTemplate`
- **Description:** Shows map with station markers + scrollable list of up to 6 nearest stations. Each row: station name, distance, available slots count, open/closed status. Tap → navigation trigger or station detail. Data from `/stations/nearby` API with device GPS coordinates.
- **Priority:** High
- **Dependencies:** 5.1
- **Effort:** Medium
- **Outcome:** Driver sees nearest chargers on the car's head unit immediately on launch

### 5.3 Station Detail Template
- **Title:** Implement station detail using `PaneTemplate`
- **Description:** Show: station name, address, available slots (count + status), pricing, operating hours, prediction ("available in ~10 min"). Two action buttons max: "Navigate" (launches Google Maps/Waze) and "Reserve" (one-tap if logged in). No scrolling, no complex interactions.
- **Priority:** High
- **Dependencies:** 5.2
- **Effort:** Medium
- **Outcome:** Driver can view station info and start navigation in 2 taps

### 5.4 Navigation Integration
- **Title:** Implement one-tap navigation launch to selected station
- **Description:** Use `CarContext.startCarApp()` with navigation intent to launch Google Maps/Waze with station coordinates pre-filled. Pass `google.navigation:q=lat,lng` URI. Offer "Navigate" as primary action on every station card.
- **Priority:** High
- **Dependencies:** 5.3
- **Effort:** Small
- **Outcome:** Single tap from station list → turn-by-turn navigation begins

### 5.5 Active Session Screen
- **Title:** Show active charging session status on Android Auto
- **Description:** Use `MessageTemplate` or `PaneTemplate` to display: current battery %, energy delivered, estimated time remaining, cost so far. Auto-refresh every 30s via API poll (WebSocket not reliable on Auto). Show "Charging Complete" notification when done.
- **Priority:** Medium
- **Dependencies:** 5.1
- **Effort:** Medium
- **Outcome:** Driver can glance at charging progress without picking up phone

### 5.6 Voice Action Handler
- **Title:** Implement voice intent handling for Android Auto
- **Description:** Register app as handler for: "Find EV charger", "Navigate to nearest charger", "Check charging status". Map Android Auto voice intents to app screens. Use `CarToast` for simple voice responses ("Nearest charger is 2km away at Downtown Hub").
- **Priority:** Medium
- **Dependencies:** 5.2, 5.5
- **Effort:** Medium
- **Outcome:** "Hey Google, find EV charger" opens the app's station list on car display

### 5.7 Android Auto Compliance Review
- **Title:** Audit and fix all Android Auto design guidelines violations
- **Description:** Checklist: max 6 list items per screen, no text input, no video/animation, proper day/night theming, touch targets ≥ 76dp, no custom drawing outside templates, app responds within 500ms. Test on Android Auto Desktop Head Unit (DHU) emulator.
- **Priority:** High
- **Dependencies:** 5.2–5.6
- **Effort:** Medium
- **Outcome:** App passes Google's Android Auto app review on first submission

---

## PHASE 6: ROUTE INTELLIGENCE SYSTEM
**Timeline: Weeks 10–13 (overlaps with Phase 5) | Goal: Smart routing that plans charging stops**

### 6.1 Maps API Integration Layer
- **Title:** Create abstraction layer for routing (Google Maps Directions API)
- **Description:** Build a `routingService` that wraps Google Maps Directions API. Accepts: origin, destination, waypoints, departure time. Returns: route polyline, step-by-step directions, duration (with traffic), distance. Abstract provider so we can swap to Mapbox/HERE later.
- **Priority:** High
- **Dependencies:** Google Maps API key
- **Effort:** Medium
- **Outcome:** Real distance/duration data instead of straight-line estimates

### 6.2 Charging Stop Optimizer
- **Title:** Build algorithm that inserts optimal charging stops into any route
- **Description:** Given: route, current battery %, vehicle range, charging preferences. Algorithm: simulate drive along route, when battery would drop below 15%, find best station within 5km of route. "Best" = weighted score of: detour distance, charging speed, predicted availability at arrival time, price. Return: modified route with charging waypoints.
- **Priority:** High
- **Dependencies:** 6.1, 2.3 (battery-aware routing)
- **Effort:** Large
- **Outcome:** "Drive to LA" automatically includes "Stop at Bakersfield SuperCharger at 2:30 PM, charge 25 min"

### 6.3 Traffic-Aware ETA with Charging Time
- **Title:** Calculate total trip time including charging stops, traffic, and predicted wait times
- **Description:** Combine: Google Maps traffic-aware ETA for each leg + predicted charging time at each stop (from battery curve) + predicted queue wait (from prediction engine). Display: "Total trip: 4h 20min (3h 15min driving + 45min charging + 20min waiting)".
- **Priority:** High
- **Dependencies:** 6.1, 6.2
- **Effort:** Medium
- **Outcome:** Driver has realistic total trip time, not just driving time

### 6.4 Alternative Route Comparison
- **Title:** Show 2-3 route options with different charging strategies
- **Description:** Generate routes: (A) Fastest — fewest stops, fast chargers, may cost more. (B) Cheapest — more stops at cheaper stations. (C) Safest — most buffer battery, closest station spacing. Display comparison table on pre-trip screen.
- **Priority:** Medium
- **Dependencies:** 6.2
- **Effort:** Medium
- **Outcome:** Driver chooses route based on their priorities (time vs money vs safety)

### 6.5 Live Route Recalculation
- **Title:** Monitor driving progress and recalculate route when conditions change
- **Description:** Every 5 minutes during active trip: check if battery consumption matches prediction, check if next planned station still has availability, check for traffic changes. If deviation > threshold: push notification "Route updated — new charging stop suggested at [station]". Require driver confirmation (single tap or voice).
- **Priority:** Medium
- **Dependencies:** 6.2, 3.3 (background location), 3.4 (push)
- **Effort:** Large
- **Outcome:** Route adapts to reality instead of becoming outdated mid-trip

---

## PHASE 7: SAFETY & REAL-TIME SYSTEMS
**Timeline: Weeks 12–14 | Goal: Bulletproof reliability under real driving conditions**

### 7.1 Network Resilience Layer
- **Title:** Implement request queuing, retry, and graceful degradation for all API calls
- **Description:** Mobile wrapper around Axios that: queues failed requests, retries with exponential backoff (max 3), falls back to cached data with "Offline" badge, queues write operations (reserve, cancel) for retry. Show connection status indicator (green/yellow/red) in app header.
- **Priority:** High
- **Dependencies:** 3.5 (offline cache)
- **Effort:** Medium
- **Outcome:** App never crashes or shows empty screens due to network issues

### 7.2 GPS Accuracy Handling
- **Title:** Implement GPS accuracy filtering and fallback strategies
- **Description:** Reject positions with accuracy > 100m for navigation decisions. Use Kalman filter to smooth GPS jitter. When GPS unavailable (tunnel, garage): use last known position + dead reckoning from accelerometer. Show "GPS searching" indicator. Don't trigger geofence actions on low-accuracy positions.
- **Priority:** High
- **Dependencies:** 3.3 (location service)
- **Effort:** Medium
- **Outcome:** No false arrivals, no wrong "nearest station" due to GPS bounce

### 7.3 Real-Time Availability Freshness
- **Title:** Implement data freshness tracking and stale data warnings
- **Description:** Every station response includes `last_updated` timestamp. Mobile app shows: green dot (< 30s), yellow dot (30s–5min), red dot (> 5min), grey dot (offline/cached). Auto-refresh visible stations every 15s via WebSocket. If data > 5min stale, show "Availability may have changed" warning before allowing reservation.
- **Priority:** High
- **Dependencies:** 1.5 (WebSocket hardening)
- **Effort:** Small
- **Outcome:** Driver never makes decisions based on silently stale data

### 7.4 Emergency Fallback Stations
- **Title:** Pre-compute and cache "emergency nearest station" for any position on common routes
- **Description:** For the user's saved routes and frequently traveled corridors: pre-compute the nearest station every 5km along the route. Cache this on-device. If battery critical and network down: show cached emergency stations without needing API call.
- **Priority:** Medium
- **Dependencies:** 3.5, 6.2
- **Effort:** Medium
- **Outcome:** Even with zero network, a critical-battery driver can find the nearest charger

### 7.5 Driving State Safety Enforcement
- **Title:** Implement comprehensive motion detection and UI locking system
- **Description:** Combine GPS speed + accelerometer + OBD-II (if available via Bluetooth) to determine: parked, slow-moving (parking lot), driving. State machine: PARKED → full UI, SLOW → simplified UI (larger buttons, no keyboard), DRIVING → locked UI (voice only + glanceable status). Cannot be overridden by user. Log safety violations for analytics.
- **Priority:** High
- **Dependencies:** 3.3, 4.5
- **Effort:** Medium
- **Outcome:** App is provably safe — impossible to text-input while driving

---

## PHASE 8: TESTING & VALIDATION
**Timeline: Weeks 14–16 | Goal: Confidence for production launch and Google review**

### 8.1 Android Auto DHU Testing Suite
- **Title:** Build automated test suite using Android Auto Desktop Head Unit emulator
- **Description:** Test all screens: station list rendering, detail pane, navigation launch, active session, day/night switching. Verify: response times < 500ms, list items ≤ 6, no crashes on data edge cases (0 stations, offline, expired token). Test on DHU with different screen sizes (phone, tablet, car display).
- **Priority:** High
- **Dependencies:** Phase 5 complete
- **Effort:** Medium
- **Outcome:** Automated gate that catches compliance violations before submission

### 8.2 Driving Simulation Test Suite
- **Title:** Create scripted driving scenarios with GPS simulation
- **Description:** Scenarios: (A) Highway drive with planned stops, (B) Urban driving with frequent station switches, (C) Rural drive with sparse coverage, (D) Tunnel/underground with GPS loss, (E) Low battery emergency, (F) Network loss during active navigation. Use mock location provider to replay recorded GPS tracks. Verify app behavior at each scenario checkpoint.
- **Priority:** High
- **Dependencies:** Phases 3-7 complete
- **Effort:** Large
- **Outcome:** Every driving edge case verified before real-world testing

### 8.3 Network Condition Testing
- **Title:** Test app under degraded network conditions
- **Description:** Use Android's network throttling to simulate: 2G (50kbps), 3G (1Mbps), flaky WiFi (50% packet loss), complete offline, offline→online transition. Verify: app doesn't hang, cached data displays, queued mutations execute on reconnection, WebSocket reconnects gracefully.
- **Priority:** High
- **Dependencies:** 7.1 (network resilience)
- **Effort:** Medium
- **Outcome:** App works acceptably at any network quality

### 8.4 Accessibility & Safety Audit
- **Title:** Third-party audit of driving mode UX against automotive safety standards
- **Description:** Engage UX auditor familiar with NHTSA driver distraction guidelines and Android Auto design requirements. Audit: glance time (< 2 seconds per interaction), task completion time (< 12 seconds for any task), touch target sizes, contrast ratios, font sizes at arm's length, voice interaction accuracy.
- **Priority:** High
- **Dependencies:** Phase 4-5 complete
- **Effort:** Small (external vendor)
- **Outcome:** Documented compliance with automotive UX safety standards

### 8.5 Beta Testing Program
- **Title:** Deploy to 20-50 real EV drivers for 2-week field test
- **Description:** Recruit beta testers with: mix of EV types (Tesla, Hyundai, Nissan, etc.), mix of driving patterns (commuters, road trippers), Android Auto compatible vehicles. Instrument app with analytics: screen time, interaction counts while moving, crash reports, feature usage. Weekly feedback surveys.
- **Priority:** High
- **Dependencies:** 8.1-8.3 passing
- **Effort:** Medium
- **Outcome:** Real-world validation and feedback before public launch

### 8.6 Google Play & Android Auto Submission
- **Title:** Prepare and submit app for Google Play Store and Android Auto review
- **Description:** Prepare: store listing (screenshots of Auto UI), privacy policy (location data handling), content rating questionnaire, Android Auto review request form. Address any review feedback within 48 hours. Plan for 1-2 rejection cycles based on typical approval rates.
- **Priority:** High
- **Dependencies:** 8.4, 8.5
- **Effort:** Small
- **Outcome:** App live on Google Play with Android Auto badge

---

## Risks & Challenges

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Android Auto template limitations** — Only 5 template types, max 6 list items, no custom UI | High — Can't build rich features on car display | Design for constraints from day 1. Complex features stay on phone, Auto shows essentials only |
| **Google Auto review rejection** — Strict guidelines, opaque review process | Medium — 1-4 week delays per rejection | Pre-audit with DHU emulator, follow guidelines exactly, budget for 2 rejection cycles |
| **GPS accuracy in urban canyons** — Buildings cause multipath errors, 50-100m drift | Medium — Wrong "nearest station" | Kalman filtering, accuracy threshold gating, map-matched positions on roads |
| **Real-time data freshness** — Station availability changes faster than data propagates | High — Driver arrives at "available" station that's full | Confidence scores, freshness indicators, over-report availability changes |
| **Battery % accuracy** — Different EVs report battery differently, degradation affects range | Medium — Wrong range/route calculations | Calibrate per vehicle profile, add safety margin, learn from actual vs predicted |
| **Background location battery drain** — Continuous GPS kills phone battery | Medium — User disables location | Use significant-change monitoring (not continuous GPS) when not navigating, foreground service only during active trip |
| **Offline mutations** — User reserves a slot offline, slot gets taken before sync | Medium — Conflict on reconnection | Optimistic UI with "Pending confirmation" state, server-side conflict resolution, notification on conflict |

---

## Suggested Tech Stack Additions

| Technology | Purpose | Phase |
|-----------|---------|-------|
| **React Native (Expo)** | Cross-platform mobile app | Phase 3 |
| **Kotlin + Car App Library** | Android Auto native module | Phase 5 |
| **Firebase Cloud Messaging** | Push notifications | Phase 3 |
| **Google Maps Directions API** | Real routing with traffic | Phase 6 |
| **Google Maps SDK (Android)** | Native map rendering | Phase 3 |
| **expo-secure-store** | Encrypted token storage | Phase 3 |
| **expo-location** | Background + foreground GPS | Phase 3 |
| **SQLite (expo-sqlite)** | Offline data cache | Phase 3 |
| **Android Auto DHU** | Testing emulator | Phase 8 |
| **Sentry (React Native)** | Crash reporting + performance | Phase 3 |

---

## Milestone Timeline (16 Weeks)

```
Week  1  2  3  4  5  6  7  8  9  10  11  12  13  14  15  16
      ├──┤                                                      Phase 1: Foundation
         ├─────┤                                                Phase 2: Smart Features
               ├────────────┤                                   Phase 3: Mobile App
                     ├─────┤                                    Phase 4: Driver UX
                           ├────────────┤                       Phase 5: Android Auto
                                 ├────────────┤                 Phase 6: Route Intelligence
                                          ├─────┤              Phase 7: Safety Systems
                                                ├─────────┤    Phase 8: Testing & Launch
```

| Week | Milestone | Deliverable |
|------|-----------|-------------|
| 2 | **API Ready** | Redis caching, versioned API, offline-friendly responses |
| 4 | **Intelligence Ready** | Enhanced predictions, personalized recommendations, battery-aware routing |
| 7 | **Mobile Beta** | React Native app with all core features, push notifications, offline support |
| 8 | **Driver UX Locked** | Motion-locked UI, voice commands designed, night mode |
| 11 | **Android Auto Alpha** | Station list, detail, navigation, active session on car display |
| 13 | **Route Intelligence** | Multi-stop planning, traffic-aware ETA, live recalculation |
| 14 | **Safety Certified** | All safety systems tested, compliance audit passed |
| 16 | **Public Launch** | Google Play + Android Auto approved, 50 beta testers validated |

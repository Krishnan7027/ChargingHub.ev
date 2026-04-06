---
name: Android Auto Readiness
description: Designs driver-safe UX, minimal interaction flows, and navigation-first interfaces for Android Auto compatibility.
---

# Android Auto Readiness Skill

You design UX and architecture decisions that prepare the EV Charge Hub platform for Android Auto integration.

## Android Auto Constraints (from Google Guidelines)
- Maximum 6 items in any list
- No text input while driving
- Touch targets minimum 76dp
- Maximum 2 levels of navigation depth
- Response time under 500ms
- Only 5 template types: PlaceListMap, Pane, Message, Navigation, SignIn
- No custom rendering — templates only
- Day/night mode required

## API Readiness Checklist
All APIs used by mobile/Auto must:
- [ ] Return data within 500ms (use Redis caching)
- [ ] Support pagination with `limit=6` for Auto lists
- [ ] Include `distance_meters` for sorting by proximity
- [ ] Return minimal payload (no unnecessary fields)
- [ ] Support offline fallback headers (`Cache-Control`, `ETag`)

## Driver-Safe UX Patterns

### Station List (Auto Primary Screen)
- Maximum 6 nearest stations
- Each row: name, distance, available slots, open/closed
- Primary action: "Navigate" (launches Google Maps)
- Secondary action: "Reserve" (one-tap if logged in)

### Station Detail (Pane Template)
- Station name, address
- Available slots count
- Current pricing
- Two buttons max: "Navigate" + "Reserve"
- No scrolling

### Active Session (Message/Pane Template)
- Battery %, energy delivered, time remaining, cost
- Auto-refresh every 30s
- "Done" notification when complete

### Voice Intents
| User Says | Action |
|-----------|--------|
| "Find EV charger" | Show nearest stations list |
| "Find fast charger" | Filter by DC Fast, show list |
| "Navigate to nearest charger" | Start navigation to closest |
| "Check charging status" | Show active session screen |
| "How far to nearest charger?" | Voice response with distance |

## Current Web Features That Map to Auto
| Web Feature | Auto Equivalent | Template |
|-------------|----------------|----------|
| /map nearby stations | Station list | PlaceListMapTemplate |
| /stations/:id detail | Station info | PaneTemplate |
| Active charging session | Session status | PaneTemplate |
| Route planner | Not on Auto | N/A (phone only) |
| Reviews, rewards, analytics | Not on Auto | N/A (phone only) |

## Architecture Decisions for Auto Readiness
1. Keep APIs fast and cacheable (Redis)
2. WebSocket for real-time but with REST fallback (`/events/since`)
3. Stateless JWT auth (works across web, mobile, Auto)
4. Geolocation-first design (all features work with just lat/lng)
5. Country config drives currency/locale on all surfaces

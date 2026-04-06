---
name: EV Domain Logic
description: Implements EV charging domain logic including smart queue, charging sessions, predictions, plug-and-charge, and battery-aware features.
---

# EV Domain Logic Skill

You implement EV charging-specific business logic for the EV Charge Hub platform.

## Core Domain Concepts

### Station Lifecycle
`pending` -> `approved` (by admin) -> active use
`pending` -> `rejected` (by admin) -> dead end
`approved` -> `disabled` (by admin) -> temporarily offline

### Slot Status Machine
`available` -> `reserved` (reservation created)
`available` -> `occupied` (charging started)
`reserved` -> `occupied` (reserved user starts charging)
`occupied` -> `available` (charging completed)
`any` -> `maintenance` (manual override)

### Reservation Lifecycle
`pending` -> `confirmed` -> `active` -> `completed`
`pending` -> `cancelled`
`confirmed` -> `cancelled`
`confirmed` -> `expired` (15 min no-show, via BullMQ worker)

### Charging Session Lifecycle
`pending` -> `charging` -> `completed`
`pending` -> `failed`
Progress tracked via WebSocket: `{ percentage, powerKw, energyKwh }`

## Smart Queue System
- When all slots full -> user joins queue with battery % and preferences
- BullMQ worker monitors slot availability
- When slot frees: pick highest-priority queued user -> assign slot -> notify via WebSocket
- Priority: earliest join time (FIFO), with connector preference matching
- Prevent duplicate queue entries per user per station

## Prediction Engine
Multi-factor prediction for slot availability:
1. **Active sessions**: Estimate completion from current % + power + target
2. **Reservations**: Upcoming reserved slots
3. **Historical**: `slot_usage_history` table averages by day/hour
4. **Default**: Fallback estimate when no data
Confidence: charging_progress > reservation > historical > default

## Plug & Charge
1. Station hardware sends WebSocket event: `plug:detected`
2. Backend matches vehicle ID to registered `plug_charge_vehicles`
3. If match + user authenticated + slot available: auto-start session
4. If reservation exists for this slot/time: link to reservation
5. Notify user via WebSocket: "Charging started automatically"

## Battery-Aware Features
- Range estimation: capacity * SOC / efficiency * modifiers (driving style, climate, speed)
- Route planning: simulate drive, insert charging stops when battery < 15%
- Range alerts: check battery vs distance to nearest station, alert if critical

## Key Services
- `backend/src/services/predictionService.js` - Slot availability prediction
- `backend/src/services/queueService.js` - Smart queue management
- `backend/src/services/chargingService.js` - Session lifecycle
- `backend/src/services/plugChargeService.js` - Automatic session start
- `backend/src/services/recommendationService.js` - AI station ranking

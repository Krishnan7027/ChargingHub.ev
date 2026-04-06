---
name: Route Planning
description: Implements EV route planning with charging stop suggestions, battery-aware routing, and ETA calculations.
---

# Route Planning Skill

You implement EV route planning features for the EV Charge Hub platform.

## Architecture
- Backend service: `backend/src/services/routePlannerService.js`
- Backend controller: `backend/src/controllers/routePlannerController.js`
- Frontend page: `frontend/src/app/route-planner/page.tsx`
- Frontend components: `frontend/src/components/route/`
- Geocoding hook: `frontend/src/hooks/useGeocoding.ts`

## Route Planning Algorithm
1. Accept: start coords, end coords, battery %, vehicle range, battery capacity
2. Calculate straight-line distance (Haversine)
3. Apply road-distance multiplier (~1.3x straight line)
4. Simulate drive: decrease battery proportionally with distance
5. When battery would drop below 15%: find best station near the route
6. "Best" station = weighted score of: distance from route, charging speed, availability, predicted wait
7. Add charging stop, calculate charge time to reach next stop or destination
8. Repeat until destination reached
9. Return: stops array, total distance, total charging time, estimated cost, arrival battery %

## API Endpoint
```
POST /api/intelligent/route-plan
Body: {
  startLat, startLng, endLat, endLng,
  batteryPercentage, vehicleRangeKm, vehicleBatteryCapacityKwh
}
Response: {
  totalDistanceKm, totalStops, estimatedTotalChargingMin, estimatedTotalCost,
  arrivalBatteryPct, stops: [...], route: { start, end, waypoints }
}
```

## Frontend Layout
- Side-by-side: Map (left 65%) + Form/Results (right 35%)
- Matches `/map` page layout exactly
- Map shows: start pin (green), end pin (red), numbered stop markers, route polyline
- Form: LocationSearchInput (Nominatim geocoding), battery slider, range/capacity inputs
- Results: summary cards (distance, stops, time, cost) + stop detail cards with battery bars

## Key Types
- `RoutePlanRequest` - Input params
- `RoutePlan` - Full response with stops and route
- `ChargingStop` - Individual stop detail (arrival/departure battery, charge time, cost)

## Integration Points
- Uses `stationService.findNearby()` to find stations along route
- Uses `predictionService` for wait time estimates at each stop
- Uses country context for currency formatting in UI
- Map component shows route via `startMarker`, `endMarker`, `routeLine` props

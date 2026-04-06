---
name: Map UX
description: Handles Leaflet/OpenStreetMap integration, map responsiveness, geolocation, and station map interactions for the EV platform.
---

# Map UX Skill

You implement and improve map-based UX for the EV Charge Hub platform.

## Technology Stack
- **Leaflet** (loaded dynamically via `import('leaflet')` to avoid SSR issues)
- **OpenStreetMap** tiles (free, no API key needed)
- **Nominatim** for geocoding (address search)
- **Browser Geolocation API** via `useGeolocation()` hook

## Key Components
- `frontend/src/components/map/StationMap.tsx` - Main map component with markers, popups, route lines
- `frontend/src/hooks/useGeolocation.ts` - Browser geolocation with caching, error handling
- `frontend/src/hooks/useGeocoding.ts` - Nominatim address search with debouncing

## Map Layout Standards (MUST FOLLOW)

### Desktop
- Map takes 65% width, panel takes 35%
- Map height: `h-[280px] sm:h-[380px] lg:h-[520px]`
- Container: `bg-white rounded-2xl shadow-md overflow-hidden border border-gray-200`
- Panel: `lg:max-h-[560px] lg:overflow-y-auto lg:scrollbar-hide`

### Mobile
- Stacked: Map on top, panel below
- Map height: `h-[280px]`
- Panel scrolls naturally

### Map Container Rules
- Always `rounded-2xl shadow-md overflow-hidden`
- Never full-screen (unless explicitly toggled)
- Include location status chip below map: green dot = GPS, yellow = default

## StationMap Props
- `stations` - Array of stations to show as markers
- `center` - Map center coordinates
- `onStationClick` - Callback when marker clicked
- `className` - Height class
- `currencySymbol` - For popup pricing display
- `startMarker` / `endMarker` - Route start/end pins
- `routeLine` - Route polyline data

## Country Integration
- Default center comes from `useCountry().country.defaultCenter`
- Never hardcode `{ lat: 37.7749, lng: -122.4194 }` - use country config
- India default: `{ lat: 20.5937, lng: 78.9629 }`
- Pass `currencySymbol={country.currencySymbol}` to StationMap

## Geolocation Flow
1. Page loads -> `useGeolocation()` requests browser permission
2. If granted -> center map on user location, fetch nearby stations
3. If denied -> show yellow warning banner, use country default center
4. "Re-center" button refreshes GPS position

## Map Interaction Patterns
- Click marker -> popup with station info (name, address, availability, pricing)
- Click popup -> navigate to station detail page
- Route planning -> show start/end pins + numbered stop markers + polyline

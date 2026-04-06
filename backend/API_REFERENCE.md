# EV Charge Hub — Backend API Reference

## Running Locally

### Prerequisites
- Node.js 18+
- PostgreSQL 14+ (with `cube`, `earthdistance` extensions)

### Setup

```bash
cd backend

# 1. Install dependencies
npm install

# 2. Create your environment file
cp .env.example .env
# Edit .env with your PostgreSQL credentials

# 3. Create the database
createdb ev_charging

# 4. Run migrations
npm run migrate

# 5. Seed sample data
npm run seed

# 6. Start the server
npm run dev          # development (auto-reload)
npm start            # production
```

The server starts at `http://localhost:3001`.

### Seed Credentials
| Role     | Email                  | Password     |
|----------|------------------------|--------------|
| Admin    | admin@evcharge.com     | admin123     |
| Manager  | manager@evcharge.com   | manager123   |
| Customer | customer@evcharge.com  | customer123  |

---

## Authentication

All authenticated endpoints require:
```
Authorization: Bearer <token>
```

---

## Endpoints

### Auth

#### POST /api/auth/register
Register a new user.

**Request:**
```json
{
  "email": "alice@example.com",
  "password": "securepass123",
  "fullName": "Alice Johnson",
  "phone": "+14155551234",
  "role": "customer"
}
```

**Response (201):**
```json
{
  "user": {
    "id": "c7b3d8e0-5e0b-4b0f-8b7a-1e5f2d3a4b5c",
    "email": "alice@example.com",
    "full_name": "Alice Johnson",
    "phone": "+14155551234",
    "role": "customer",
    "is_active": true,
    "created_at": "2026-03-16T10:00:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### POST /api/auth/login
```json
{
  "email": "customer@evcharge.com",
  "password": "customer123"
}
```

**Response (200):**
```json
{
  "user": {
    "id": "a1b2c3d4-...",
    "email": "customer@evcharge.com",
    "full_name": "John EV Owner",
    "role": "customer",
    "is_active": true
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Error (401):**
```json
{
  "error": "Invalid email or password"
}
```

#### GET /api/auth/profile
*Auth required*

**Response (200):**
```json
{
  "id": "a1b2c3d4-...",
  "email": "customer@evcharge.com",
  "full_name": "John EV Owner",
  "phone": "+1234567892",
  "role": "customer",
  "is_active": true,
  "email_verified": true,
  "created_at": "2026-03-16T10:00:00.000Z",
  "updated_at": "2026-03-16T10:00:00.000Z"
}
```

#### PUT /api/auth/profile
*Auth required*
```json
{
  "fullName": "John Updated",
  "phone": "+14155559999"
}
```

#### POST /api/auth/change-password
*Auth required*
```json
{
  "currentPassword": "customer123",
  "newPassword": "newSecure456"
}
```

**Response (200):**
```json
{
  "message": "Password changed successfully"
}
```

---

### Stations

#### GET /api/stations/nearby?latitude=37.7749&longitude=-122.4194&radiusKm=25
*Public*

**Response (200):**
```json
[
  {
    "id": "d4e5f6a7-...",
    "name": "Downtown EV Hub",
    "address": "123 Main St",
    "city": "San Francisco",
    "state": "CA",
    "latitude": 37.7749,
    "longitude": -122.4194,
    "status": "approved",
    "pricing_per_kwh": "0.3500",
    "rating": "4.50",
    "amenities": ["wifi", "restroom", "cafe"],
    "total_slots": "6",
    "available_slots": "4",
    "distance_meters": 152.34
  }
]
```

#### GET /api/stations/search?query=downtown&city=San+Francisco&chargingType=dc_fast
*Public*

**Response (200):**
```json
{
  "stations": [ ... ],
  "total": 15
}
```

#### GET /api/stations/:id
*Public*

**Response (200):**
```json
{
  "id": "d4e5f6a7-...",
  "manager_id": "b2c3d4e5-...",
  "name": "Downtown EV Hub",
  "description": "Fast charging in the heart of downtown",
  "address": "123 Main St",
  "city": "San Francisco",
  "state": "CA",
  "latitude": 37.7749,
  "longitude": -122.4194,
  "status": "approved",
  "operating_hours": { "open": "00:00", "close": "23:59", "timezone": "UTC" },
  "amenities": ["wifi", "restroom", "cafe"],
  "pricing_per_kwh": "0.3500",
  "rating": "4.50",
  "total_slots": "6",
  "available_slots": "4",
  "manager_name": "Station Manager",
  "slots": [
    {
      "id": "e5f6a7b8-...",
      "slot_number": 1,
      "charging_type": "dc_fast",
      "connector_type": "ccs",
      "power_output_kw": "150.00",
      "status": "occupied",
      "active_session": {
        "id": "f6a7b8c9-...",
        "status": "charging",
        "current_percentage": 65,
        "target_percentage": 100,
        "start_percentage": 20,
        "energy_delivered_kwh": 18.5,
        "started_at": "2026-03-16T09:30:00.000Z",
        "estimated_minutes_remaining": 22,
        "estimated_completion_time": "2026-03-16T10:52:00.000Z"
      }
    },
    {
      "id": "a7b8c9d0-...",
      "slot_number": 2,
      "charging_type": "level2",
      "connector_type": "type2",
      "power_output_kw": "22.00",
      "status": "available",
      "active_session": null
    }
  ]
}
```

#### POST /api/stations
*Auth required: manager*
```json
{
  "name": "Green Valley Chargers",
  "description": "Eco-friendly charging station",
  "address": "456 Oak Ave",
  "city": "San Francisco",
  "state": "CA",
  "zipCode": "94110",
  "latitude": 37.7580,
  "longitude": -122.4155,
  "pricingPerKwh": 0.30,
  "operatingHours": { "open": "06:00", "close": "22:00", "timezone": "America/Los_Angeles" },
  "amenities": ["wifi", "parking"]
}
```

**Response (201):** Station object (status: "pending")

#### PUT /api/stations/:id
*Auth required: manager (owner only)*

#### GET /api/stations/manager/my-stations
*Auth required: manager*

#### POST /api/stations/:id/slots
*Auth required: manager (owner only)*
```json
{
  "slotNumber": 7,
  "chargingType": "dc_fast",
  "connectorType": "ccs",
  "powerOutputKw": 150
}
```

#### PUT /api/stations/:id/slots/:slotId
*Auth required: manager*

#### DELETE /api/stations/:id/slots/:slotId
*Auth required: manager*

#### PATCH /api/stations/:id/approve
*Auth required: admin*

**Response (200):**
```json
{
  "id": "d4e5f6a7-...",
  "name": "Green Valley Chargers",
  "status": "approved",
  "updated_at": "2026-03-16T11:00:00.000Z"
}
```

#### PATCH /api/stations/:id/reject
*Auth required: admin*

#### PATCH /api/stations/:id/disable
*Auth required: admin*

---

### Smart Slot Predictions

#### GET /api/stations/:id/predictions

**Response when slots are available (200):**
```json
{
  "available": true,
  "availableSlots": 3,
  "message": "Slots available now",
  "estimatedMinutes": 0
}
```

**Response when all occupied (200):**
```json
{
  "available": false,
  "estimatedMinutes": 12,
  "message": "Next slot available in ~12 minutes",
  "prediction": {
    "minutes": 12,
    "slot": 3,
    "source": "charging_progress",
    "currentPercentage": 82,
    "targetPercentage": 100
  },
  "allPredictions": [
    { "minutes": 12, "slot": 3, "source": "charging_progress" },
    { "minutes": 25, "slot": 1, "source": "reservation_schedule" },
    { "minutes": 38, "slot": 5, "source": "charging_progress" }
  ]
}
```

**Response with historical fallback (200):**
```json
{
  "available": false,
  "estimatedMinutes": 18,
  "message": "Next slot available in ~18 minutes",
  "prediction": {
    "minutes": 18,
    "source": "historical_average"
  },
  "allPredictions": [
    { "minutes": 18, "source": "historical_average" }
  ]
}
```

---

### Reservations

#### POST /api/reservations
*Auth required*
```json
{
  "slotId": "e5f6a7b8-...",
  "stationId": "d4e5f6a7-...",
  "scheduledStart": "2026-03-16T14:00:00.000Z",
  "scheduledEnd": "2026-03-16T15:30:00.000Z",
  "vehicleInfo": { "make": "Tesla", "model": "Model 3", "year": "2024" },
  "notes": "Will arrive 5 min early"
}
```

**Response (201):**
```json
{
  "id": "b8c9d0e1-...",
  "user_id": "a1b2c3d4-...",
  "slot_id": "e5f6a7b8-...",
  "station_id": "d4e5f6a7-...",
  "status": "confirmed",
  "scheduled_start": "2026-03-16T14:00:00.000Z",
  "scheduled_end": "2026-03-16T15:30:00.000Z",
  "vehicle_info": { "make": "Tesla", "model": "Model 3", "year": "2024" },
  "station_name": "Downtown EV Hub",
  "station_address": "123 Main St",
  "slot_number": 2,
  "charging_type": "level2",
  "connector_type": "type2",
  "user_name": "John EV Owner",
  "created_at": "2026-03-16T10:30:00.000Z"
}
```

**Error (409):**
```json
{
  "error": "Time slot is already reserved"
}
```

#### GET /api/reservations/my?status=confirmed
*Auth required*

**Response (200):** Array of reservation objects

#### GET /api/reservations/:id
*Auth required*

#### PATCH /api/reservations/:id/cancel
*Auth required*

**Response (200):**
```json
{
  "id": "b8c9d0e1-...",
  "status": "cancelled",
  "updated_at": "2026-03-16T11:00:00.000Z"
}
```

#### GET /api/reservations/station/:stationId
*Auth required: manager or admin*

---

### Charging Sessions

#### POST /api/charging/start
*Auth required*
```json
{
  "slotId": "e5f6a7b8-...",
  "startPercentage": 25,
  "targetPercentage": 90,
  "reservationId": "b8c9d0e1-..."
}
```

**Response (201):**
```json
{
  "id": "c9d0e1f2-...",
  "slot_id": "e5f6a7b8-...",
  "user_id": "a1b2c3d4-...",
  "status": "charging",
  "start_percentage": "25.00",
  "current_percentage": "25.00",
  "target_percentage": "90.00",
  "energy_delivered_kwh": "0.0000",
  "cost": "0.00",
  "started_at": "2026-03-16T14:00:00.000Z",
  "station_name": "Downtown EV Hub",
  "slot_number": 2,
  "power_output_kw": "22.00",
  "estimated_minutes_remaining": 132,
  "estimated_completion_time": "2026-03-16T16:12:00.000Z"
}
```

#### PATCH /api/charging/:id/progress
*Auth required: manager*
```json
{
  "currentPercentage": 55,
  "energyDeliveredKwh": 12.3,
  "averagePowerKw": 21.5,
  "cost": 4.31
}
```

**Response (200):**
```json
{
  "id": "c9d0e1f2-...",
  "current_percentage": "55.00",
  "target_percentage": "90.00",
  "energy_delivered_kwh": "12.3000",
  "average_power_kw": "21.50",
  "cost": "4.31",
  "estimated_minutes_remaining": 71,
  "estimated_completion_time": "2026-03-16T15:41:00.000Z"
}
```

#### PATCH /api/charging/:id/complete
*Auth required: manager*

**Response (200):**
```json
{
  "id": "c9d0e1f2-...",
  "status": "completed",
  "current_percentage": "90.00",
  "completed_at": "2026-03-16T15:45:00.000Z",
  "energy_delivered_kwh": "26.4000",
  "cost": "9.24"
}
```

#### GET /api/charging/active
*Auth required*

**Response (200):** Array of active session objects with ETA

#### GET /api/charging/:id
*Auth required*

#### GET /api/charging/station/:stationId
*Auth required: manager or admin*

---

### Admin

All admin endpoints require `Authorization: Bearer <admin_token>`.

#### GET /api/admin/stats

**Response (200):**
```json
{
  "total_users": "42",
  "total_customers": "35",
  "total_managers": "6",
  "total_stations": "12",
  "approved_stations": "8",
  "pending_stations": "3",
  "rejected_stations": "1",
  "disabled_stations": "0",
  "total_slots": "48",
  "available_slots": "31",
  "occupied_slots": "12",
  "total_reservations": "156",
  "active_reservations": "5",
  "confirmed_reservations": "8",
  "total_sessions": "312",
  "active_sessions": "12",
  "total_energy_kwh": "8542.3400",
  "total_revenue": "2989.82"
}
```

#### GET /api/admin/users?role=customer&search=john&page=1&limit=20
#### PATCH /api/admin/users/:id/toggle-status
#### PATCH /api/admin/users/:id/role
```json
{ "role": "manager" }
```
#### DELETE /api/admin/users/:id
#### GET /api/admin/stations?status=pending
#### GET /api/admin/audit-logs?action=station.approve&page=1

**Response (200):**
```json
[
  {
    "id": "e1f2a3b4-...",
    "user_id": "admin-uuid-...",
    "action": "station.approve",
    "entity_type": "station",
    "entity_id": "d4e5f6a7-...",
    "details": { "name": "Green Valley Chargers" },
    "ip_address": "::1",
    "user_name": "Platform Admin",
    "user_email": "admin@evcharge.com",
    "created_at": "2026-03-16T11:00:00.000Z"
  }
]
```

---

### Health Check

#### GET /api/health
```json
{
  "status": "ok",
  "timestamp": "2026-03-16T10:00:00.000Z"
}
```

---

## WebSocket Events

Connect with:
```js
const socket = io('http://localhost:3001', {
  auth: { token: 'your-jwt-token' }
});
```

### Client → Server
| Event | Payload | Description |
|---|---|---|
| `subscribe:station` | `stationId` | Subscribe to real-time updates for a station |
| `unsubscribe:station` | `stationId` | Unsubscribe |
| `charging:progress` | `{ sessionId, stationId, slotId, currentPercentage, ... }` | Manager pushes charger progress |
| `slot:statusChange` | `{ stationId, slotId, status }` | Manager changes slot status |

### Server → Client
| Event | Payload | Description |
|---|---|---|
| `slot:updated` | `{ slotId, currentPercentage, estimatedMinutesRemaining, ... }` | Charging progress broadcast |
| `slot:statusChanged` | `{ slotId, status, updatedAt }` | Slot became available/reserved/occupied |
| `charging:update` | `{ sessionId, currentPercentage, cost, ... }` | Progress update to session owner |
| `charging:completed` | `{ sessionId, energyDeliveredKwh, cost }` | Session completed |
| `station:approved` | `{ stationId, name }` | Admin approved a station |
| `station:rejected` | `{ stationId, name }` | Admin rejected a station |
| `station:disabled` | `{ stationId, name }` | Admin disabled a station |

---

## Error Format

All errors return:
```json
{
  "error": "Human-readable message"
}
```

Validation errors:
```json
{
  "error": "Validation failed",
  "details": [
    { "field": "email", "message": "Valid email required" },
    { "field": "password", "message": "Password must be at least 8 characters" }
  ]
}
```

### Common Status Codes
| Code | Meaning |
|------|---------|
| 200  | Success |
| 201  | Created |
| 204  | Deleted (no body) |
| 400  | Bad request / validation error |
| 401  | Not authenticated / invalid credentials |
| 403  | Forbidden (wrong role or not owner) |
| 404  | Resource not found |
| 409  | Conflict (duplicate / already reserved) |
| 429  | Rate limited |
| 500  | Internal server error |

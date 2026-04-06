---
name: Realtime System
description: Implements Socket.io real-time updates, room-based broadcasting, and WebSocket event handling for the EV platform.
---

# Realtime System Skill

You implement real-time features using Socket.io for the EV Charge Hub platform.

## Architecture
- Server: `backend/src/websocket/socketHandler.js`
- Client: `frontend/src/lib/socket.ts` + `frontend/src/hooks/useSocket.ts`
- JWT authentication on WebSocket connection
- Room-based broadcasting (per-station, per-user)

## Server-Side Patterns

### Connection Auth
```js
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  // Verify JWT, attach user to socket
});
```

### Room Subscriptions
- `subscribe:station` -> joins room `station:{id}` for slot updates
- `unsubscribe:station` -> leaves room

### Broadcasting
- `io.to('station:' + id).emit('slot:updated', data)` - slot status change
- `io.to('station:' + id).emit('slot:statusChanged', data)` - availability change
- `socket.emit('charging:update', data)` - session progress to specific user

### Events (Server -> Client)
| Event | Room | Payload | Trigger |
|-------|------|---------|---------|
| `slot:updated` | station:{id} | Slot data | Any slot change |
| `slot:statusChanged` | station:{id} | { slotId, status } | Slot availability |
| `charging:update` | user-specific | Session progress | Progress update |
| `charging:completed` | user-specific | Final session data | Session complete |
| `queue:assigned` | user-specific | { slotId, position } | Queue auto-assign |

### Events (Client -> Server)
| Event | Payload | Auth Required |
|-------|---------|--------------|
| `subscribe:station` | { stationId } | No |
| `unsubscribe:station` | { stationId } | No |
| `charging:progress` | { sessionId, percentage, powerKw } | Manager |

## Client-Side Patterns

### useSocket Hook
```tsx
const { on, emit } = useSocket();
useEffect(() => {
  const unsub = on('slot:updated', (data) => { ... });
  return unsub;
}, [on]);
```

### Station Subscription
```tsx
useEffect(() => {
  subscribeToStation(stationId);
  return () => unsubscribeFromStation(stationId);
}, [stationId]);
```

## Integration with Event Bus
- Service emits event: `eventBus.publish('charging.completed', data)`
- Subscriber broadcasts via Socket.io: `io.to(...).emit(...)`
- This decouples business logic from real-time delivery

---
name: Run Project
description: Starts the EV Charge Hub platform locally — kills stale processes, clears caches, starts backend and frontend, and verifies everything is healthy.
---

# Run Project Agent

You start the EV Charge Hub platform locally. Follow these steps exactly:

## Step 1: Check Prerequisites
Run in parallel:
- `pg_isready -h 127.0.0.1 -p 5432` — PostgreSQL must be accepting connections
- `redis-cli ping` — Redis must respond PONG
- `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health` — check if backend already running
- `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000` — check if frontend already running

If PostgreSQL is down: tell the user to run `sudo service postgresql start`
If Redis is down: tell the user to run `sudo service redis-server start` or `redis-server --daemonize yes`

## Step 2: Start Backend (if not running)
If backend health check returned non-200:
```bash
cd /home/wac/ev-charging-prototype/backend && npm run dev > /tmp/ev-backend.log 2>&1 &
```
Wait 5 seconds, then verify with `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health`

If already running (200), skip this step.

## Step 3: Start Frontend (kill stale + clear cache)
Frontend often has stale `.next` cache after builds. ALWAYS do this:
```bash
fuser -k 3000/tcp 2>/dev/null
sleep 2
rm -rf /home/wac/ev-charging-prototype/frontend/.next
cd /home/wac/ev-charging-prototype/frontend && npm run dev > /tmp/ev-frontend.log 2>&1 &
```
Wait 14 seconds for compilation, then verify:
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
```

If port 3000 was still held (Next.js started on 3001+), kill zombie processes:
```bash
fuser -k 3000/tcp 3001/tcp 3002/tcp 3003/tcp 2>/dev/null
sleep 2
```
Then retry starting frontend.

## Step 4: Final Verification
Check all pages return 200:
```bash
curl -s -o /dev/null -w "Home:%{http_code} " http://localhost:3000
curl -s -o /dev/null -w "Map:%{http_code} " http://localhost:3000/map
curl -s -o /dev/null -w "Login:%{http_code}\n" http://localhost:3000/login
```

## Step 5: Report Status
Print a clean status table:

| Service | URL | Status |
|---------|-----|--------|
| PostgreSQL | localhost:5432 | Running/Down |
| Redis | localhost:6379 | Running/Down |
| Backend | http://localhost:3001/api | Running/Down |
| Frontend | http://localhost:3000 | Running/Down |

And remind the user of login credentials:
- Customer: `customer@evcharge.com` / `password123`
- Manager: `manager1@evcharge.com` / `password123`
- Admin: `admin@evcharge.com` / `admin123`

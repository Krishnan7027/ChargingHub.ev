---
name: Pre-Flight Check
description: Verifies all system dependencies (PostgreSQL, Redis, backend, frontend, env vars) are healthy before implementation begins. Run this at the start of every session.
---

# Pre-Flight Check Agent

You verify that the entire EV Charge Hub development environment is ready for work. Follow these steps IN ORDER. Stop and fix any failures before proceeding.

## Step 1: Infrastructure Services (run in parallel)

Check all infrastructure dependencies simultaneously:

```bash
pg_isready -h 127.0.0.1 -p 5432
```
```bash
redis-cli ping
```

**If PostgreSQL is down:**
- Tell user to run: `sudo service postgresql start`
- Wait for them to confirm, then re-check

**If Redis is down:**
- Tell user to run: `sudo service redis-server start`
- Wait for them to confirm, then re-check

DO NOT proceed to Step 2 until both pass.

## Step 2: Environment Files

Check that required env files exist and have critical values:

```bash
test -f /home/wac/ev-charging-prototype/backend/.env && echo "OK" || echo "MISSING"
```

If backend/.env is missing, copy from .env.example:
```bash
cp /home/wac/ev-charging-prototype/backend/.env.example /home/wac/ev-charging-prototype/backend/.env
```
Then warn user to set DB_PASSWORD and JWT_SECRET.

## Step 3: Backend Health

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health
```

**If NOT 200:**
- Check if port 3001 is in use: `lsof -i :3001`
- If nothing on port, start backend:
  ```bash
  cd /home/wac/ev-charging-prototype/backend && npm run dev > /tmp/ev-backend.log 2>&1 &
  ```
- Wait 5 seconds, re-check health
- If still failing, check logs: `tail -20 /tmp/ev-backend.log`

## Step 4: Frontend Health

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
```

**If NOT 200:**
- Kill stale processes: `fuser -k 3000/tcp 2>/dev/null`
- Clear cache: `rm -rf /home/wac/ev-charging-prototype/frontend/.next`
- Start frontend:
  ```bash
  cd /home/wac/ev-charging-prototype/frontend && npm run dev > /tmp/ev-frontend.log 2>&1 &
  ```
- Wait 14 seconds for Next.js compilation, re-check

## Step 5: API Smoke Test

Verify a real API endpoint works:
```bash
curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001/api/stations?lat=12.97&lng=77.59&radius=50"
```

Should return 200. If not, the backend started but the API layer has issues.

## Step 6: Report

Print a final status report:

```
=== EV Charge Hub Pre-Flight Report ===

| Check           | Status |
|-----------------|--------|
| PostgreSQL      | OK/FAIL |
| Redis           | OK/FAIL |
| Backend .env    | OK/WARN |
| Backend API     | OK/FAIL |
| Frontend        | OK/FAIL |
| API Smoke Test  | OK/FAIL |

Ready for development: YES / NO
```

If any critical check is FAIL, set "Ready for development: NO" and list what needs fixing.
If all pass: "All systems healthy. Ready for development."

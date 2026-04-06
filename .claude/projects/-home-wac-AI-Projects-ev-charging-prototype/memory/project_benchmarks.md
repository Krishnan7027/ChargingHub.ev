---
name: benchmark-resume-instructions
description: How to resume benchmark runs - start backend with high rate limit, then run benchmark script
type: project
---

To run benchmarks, start the backend first with rate limiting disabled, then execute the benchmark script:

1. `RATE_LIMIT_MAX=1000000 PORT=3001 node src/server.js` (from `backend/`)
2. `node benchmarks/run-benchmarks.js` (from `backend/`)

**Why:** Rate limit must be raised so benchmark requests aren't throttled. Default port is 3001.
**How to apply:** Run these two commands in order when resuming benchmark work.

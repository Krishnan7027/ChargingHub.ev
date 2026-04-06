#!/usr/bin/env node
'use strict';

const autocannon = require('autocannon');
const http = require('http');

const BASE_URL = 'http://localhost:3001';

// These get populated at startup
let CUSTOMER_TOKEN = '';
let ADMIN_TOKEN = '';
let STATION_ID = '';
let SESSION_ID = '';

async function httpRequest(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(data); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function setup() {
  console.log('Setting up test data...');

  const customerLogin = await httpRequest('POST', '/api/auth/login', {
    email: 'customer@evcharge.com', password: 'password123'
  });
  CUSTOMER_TOKEN = customerLogin.token;

  const adminLogin = await httpRequest('POST', '/api/auth/login', {
    email: 'admin@evcharge.com', password: 'admin123'
  });
  ADMIN_TOKEN = adminLogin.token;

  const stations = await httpRequest('GET', '/api/stations/nearby?latitude=37.7749&longitude=-122.4194&radius=50');
  STATION_ID = stations[0]?.id;

  const sessions = await httpRequest('GET', '/api/charging/active', null, CUSTOMER_TOKEN);
  SESSION_ID = Array.isArray(sessions) && sessions[0]?.id;

  console.log(`  Station: ${STATION_ID}`);
  console.log(`  Session: ${SESSION_ID}`);
  console.log(`  Tokens: customer=${!!CUSTOMER_TOKEN}, admin=${!!ADMIN_TOKEN}\n`);
}

function runBenchmark(config) {
  return new Promise((resolve, reject) => {
    const instance = autocannon({
      url: `${BASE_URL}${config.path}`,
      method: config.method || 'GET',
      headers: config.headers || {},
      body: config.body ? JSON.stringify(config.body) : undefined,
      connections: config.connections || 10,
      duration: config.duration || 10,
      pipelining: 1,
    }, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });

    // Suppress live rendering
    autocannon.track(instance, { renderProgressBar: false });
  });
}

const endpoints = () => [
  // === Public endpoints ===
  {
    name: 'GET /api/health',
    path: '/api/health',
    category: 'health',
  },
  {
    name: 'POST /api/auth/login',
    path: '/api/auth/login',
    method: 'POST',
    body: { email: 'customer@evcharge.com', password: 'password123' },
    category: 'auth',
  },
  {
    name: 'GET /api/stations/nearby',
    path: `/api/stations/nearby?latitude=37.7749&longitude=-122.4194&radius=50`,
    category: 'stations',
  },
  {
    name: 'GET /api/stations/search',
    path: '/api/stations/search?query=Downtown',
    category: 'stations',
  },
  {
    name: 'GET /api/stations/:id',
    path: `/api/stations/${STATION_ID}`,
    category: 'stations',
  },
  {
    name: 'GET /api/stations/:id/predictions',
    path: `/api/stations/${STATION_ID}/predictions`,
    category: 'predictions',
  },

  // === Auth-required customer endpoints ===
  {
    name: 'GET /api/auth/profile',
    path: '/api/auth/profile',
    headers: { Authorization: `Bearer ${CUSTOMER_TOKEN}` },
    category: 'auth',
  },
  {
    name: 'GET /api/reservations/my',
    path: '/api/reservations/my',
    headers: { Authorization: `Bearer ${CUSTOMER_TOKEN}` },
    category: 'reservations',
  },
  {
    name: 'GET /api/charging/active',
    path: '/api/charging/active',
    headers: { Authorization: `Bearer ${CUSTOMER_TOKEN}` },
    category: 'charging',
  },
  {
    name: 'GET /api/payments/my',
    path: '/api/payments/my',
    headers: { Authorization: `Bearer ${CUSTOMER_TOKEN}` },
    category: 'payments',
  },

  // === Intelligent / Prediction endpoints ===
  {
    name: 'GET /api/intelligent/predictions/:stationId',
    path: `/api/intelligent/predictions/${STATION_ID}`,
    category: 'intelligent',
  },
  {
    name: 'GET /api/intelligent/demand/:stationId',
    path: `/api/intelligent/demand/${STATION_ID}`,
    category: 'intelligent',
  },
  {
    name: 'GET /api/intelligent/demand/:stationId/today',
    path: `/api/intelligent/demand/${STATION_ID}/today`,
    category: 'intelligent',
  },
  {
    name: 'GET /api/intelligent/pricing/:stationId',
    path: `/api/intelligent/pricing/${STATION_ID}`,
    category: 'intelligent',
  },
  {
    name: 'GET /api/intelligent/pricing/:stationId/current',
    path: `/api/intelligent/pricing/${STATION_ID}/current`,
    category: 'intelligent',
  },
  {
    name: 'GET /api/intelligent/congestion/:stationId',
    path: `/api/intelligent/congestion/${STATION_ID}`,
    category: 'intelligent',
  },
  {
    name: 'GET /api/intelligent/grid/:stationId',
    path: `/api/intelligent/grid/${STATION_ID}`,
    category: 'intelligent',
  },
  {
    name: 'GET /api/intelligent/recommendations',
    path: '/api/intelligent/recommendations',
    category: 'intelligent',
  },
  {
    name: 'GET /api/intelligent/reliability/:stationId',
    path: `/api/intelligent/reliability/${STATION_ID}`,
    category: 'intelligent',
  },
  {
    name: 'GET /api/intelligent/reliability/leaderboard',
    path: '/api/intelligent/reliability/leaderboard',
    category: 'intelligent',
  },
  {
    name: 'GET /api/intelligent/reviews/station/:stationId',
    path: `/api/intelligent/reviews/station/${STATION_ID}`,
    category: 'intelligent',
  },
  {
    name: 'GET /api/intelligent/allocation/:stationId/recommend',
    path: `/api/intelligent/allocation/${STATION_ID}/recommend`,
    category: 'intelligent',
  },
  {
    name: 'GET /api/intelligent/allocation/:stationId/queue',
    path: `/api/intelligent/allocation/${STATION_ID}/queue`,
    category: 'intelligent',
  },
  {
    name: 'GET /api/intelligent/mobility/heatmap',
    path: '/api/intelligent/mobility/heatmap',
    category: 'intelligent',
  },
  {
    name: 'GET /api/intelligent/mobility/behavior',
    path: '/api/intelligent/mobility/behavior',
    category: 'intelligent',
  },
  {
    name: 'GET /api/intelligent/mobility/trends',
    path: '/api/intelligent/mobility/trends',
    category: 'intelligent',
  },
  {
    name: 'GET /api/intelligent/mobility/cities',
    path: '/api/intelligent/mobility/cities',
    category: 'intelligent',
  },
  {
    name: 'GET /api/intelligent/optimization/:stationId',
    path: `/api/intelligent/optimization/${STATION_ID}`,
    category: 'intelligent',
  },
  {
    name: 'GET /api/intelligent/rewards/catalog',
    path: '/api/intelligent/rewards/catalog',
    category: 'intelligent',
  },
  {
    name: 'GET /api/intelligent/rewards/leaderboard',
    path: '/api/intelligent/rewards/leaderboard',
    category: 'intelligent',
  },

  // === Auth-required intelligent endpoints ===
  {
    name: 'GET /api/intelligent/carbon/me',
    path: '/api/intelligent/carbon/me',
    headers: { Authorization: `Bearer ${CUSTOMER_TOKEN}` },
    category: 'intelligent',
  },
  {
    name: 'GET /api/intelligent/battery-health',
    path: '/api/intelligent/battery-health',
    headers: { Authorization: `Bearer ${CUSTOMER_TOKEN}` },
    category: 'intelligent',
  },
  {
    name: 'GET /api/intelligent/scheduling/quick',
    path: '/api/intelligent/scheduling/quick',
    headers: { Authorization: `Bearer ${CUSTOMER_TOKEN}` },
    category: 'intelligent',
  },
  {
    name: 'GET /api/intelligent/range-safety/assess',
    path: '/api/intelligent/range-safety/assess',
    headers: { Authorization: `Bearer ${CUSTOMER_TOKEN}` },
    category: 'intelligent',
  },
  {
    name: 'GET /api/intelligent/rewards/wallet',
    path: '/api/intelligent/rewards/wallet',
    headers: { Authorization: `Bearer ${CUSTOMER_TOKEN}` },
    category: 'intelligent',
  },
  {
    name: 'GET /api/intelligent/rewards/history',
    path: '/api/intelligent/rewards/history',
    headers: { Authorization: `Bearer ${CUSTOMER_TOKEN}` },
    category: 'intelligent',
  },

  // === Admin endpoints ===
  {
    name: 'GET /api/admin/stats',
    path: '/api/admin/stats',
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    category: 'admin',
  },
  {
    name: 'GET /api/admin/users',
    path: '/api/admin/users',
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    category: 'admin',
  },
  {
    name: 'GET /api/admin/stations',
    path: '/api/admin/stations',
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    category: 'admin',
  },
  {
    name: 'GET /api/admin/audit-logs',
    path: '/api/admin/audit-logs',
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    category: 'admin',
  },

  // === Prediction endpoints ===
  {
    name: 'GET /api/predictions/stations/:stationId/next-available',
    path: `/api/predictions/stations/${STATION_ID}/next-available`,
    category: 'predictions',
  },
  {
    name: 'GET /api/predictions/demand-profile',
    path: `/api/predictions/demand-profile?stationId=${STATION_ID}`,
    category: 'predictions',
  },

  // === Route planner ===
  {
    name: 'POST /api/route-planner/plan',
    path: '/api/route-planner/plan',
    method: 'POST',
    body: {
      origin: { lat: 37.7749, lng: -122.4194 },
      destination: { lat: 37.3382, lng: -121.8863 },
      vehicleRange: 300,
      currentBattery: 80,
    },
    category: 'route-planner',
  },
];

async function main() {
  await setup();

  const allEndpoints = endpoints();
  const results = [];

  console.log(`Running benchmarks on ${allEndpoints.length} endpoints (10s each, 10 connections)\n`);
  console.log('='.repeat(100));

  for (const ep of allEndpoints) {
    process.stdout.write(`  Benchmarking: ${ep.name} ... `);

    try {
      const result = await runBenchmark({
        path: ep.path,
        method: ep.method,
        headers: ep.headers,
        body: ep.body,
        connections: 10,
        duration: 10,
      });

      const summary = {
        name: ep.name,
        category: ep.category,
        requests_per_sec: Math.round(result.requests.average),
        latency_avg_ms: result.latency.average,
        latency_p50_ms: result.latency.p50,
        latency_p99_ms: result.latency.p99,
        latency_max_ms: result.latency.max,
        throughput_mb: Math.round(result.throughput.average / 1024 / 1024 * 100) / 100,
        errors: result.errors,
        timeouts: result.timeouts,
        non2xx: result.non2xx,
        total_requests: result.requests.total,
      };

      results.push(summary);
      console.log(
        `${summary.requests_per_sec} req/s | avg ${summary.latency_avg_ms}ms | p99 ${summary.latency_p99_ms}ms | errors: ${summary.errors + summary.non2xx}`
      );
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
      results.push({
        name: ep.name,
        category: ep.category,
        error: err.message,
        requests_per_sec: 0,
        latency_avg_ms: Infinity,
        latency_p99_ms: Infinity,
      });
    }
  }

  console.log('\n' + '='.repeat(100));
  console.log('\n📊 BENCHMARK RESULTS - SORTED BY LATENCY (WORST FIRST)\n');

  const sorted = results
    .filter(r => !r.error)
    .sort((a, b) => b.latency_p99_ms - a.latency_p99_ms);

  console.log(
    'Rank'.padEnd(5) +
    'Endpoint'.padEnd(55) +
    'Req/s'.padStart(8) +
    'Avg(ms)'.padStart(10) +
    'P50(ms)'.padStart(10) +
    'P99(ms)'.padStart(10) +
    'Max(ms)'.padStart(10) +
    'Errors'.padStart(8)
  );
  console.log('-'.repeat(116));

  sorted.forEach((r, i) => {
    const flag = r.latency_p99_ms > 100 ? ' ⚠️' : r.latency_p99_ms > 50 ? ' ⚡' : '';
    console.log(
      `#${i + 1}`.padEnd(5) +
      r.name.padEnd(55) +
      String(r.requests_per_sec).padStart(8) +
      String(r.latency_avg_ms).padStart(10) +
      String(r.latency_p50_ms).padStart(10) +
      String(r.latency_p99_ms).padStart(10) +
      String(r.latency_max_ms).padStart(10) +
      String(r.errors + (r.non2xx || 0)).padStart(8) +
      flag
    );
  });

  // Summary stats
  const slowest = sorted.slice(0, 10);
  console.log('\n\n🔴 TOP 10 WORST PERFORMERS (by p99 latency):\n');
  slowest.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.name}`);
    console.log(`     p99: ${r.latency_p99_ms}ms | avg: ${r.latency_avg_ms}ms | ${r.requests_per_sec} req/s`);
  });

  // Endpoints with errors
  const errored = results.filter(r => (r.errors || 0) + (r.non2xx || 0) > 0);
  if (errored.length > 0) {
    console.log('\n\n🔴 ENDPOINTS WITH ERRORS:\n');
    errored.forEach(r => {
      console.log(`  ${r.name}: ${r.errors} errors, ${r.non2xx || 0} non-2xx`);
    });
  }

  // Write JSON results
  const fs = require('fs');
  const outPath = require('path').join(__dirname, 'results.json');
  fs.writeFileSync(outPath, JSON.stringify({ timestamp: new Date().toISOString(), results: sorted }, null, 2));
  console.log(`\n\nResults saved to ${outPath}`);
}

main().catch(console.error);

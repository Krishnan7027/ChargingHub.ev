#!/usr/bin/env node
'use strict';

/**
 * SQL Query Profiler - measures actual query execution times
 * for the slowest endpoints identified by benchmarks
 */

const { Pool } = require('pg');
const env = require('../src/config/env');

const pool = new Pool({
  host: env.db.host,
  port: env.db.port,
  database: env.db.name,
  user: env.db.user,
  password: env.db.password,
});

const STATION_ID = process.argv[2] || '97d081c9-bd3a-4e5b-9b4e-52aa0da26e75';
const USER_ID = '878ffbf1-b3ea-45d3-9035-04babe569eea'; // customer

async function profileQuery(name, sql, params = []) {
  // Run EXPLAIN ANALYZE
  const explain = await pool.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`, params);
  const plan = explain.rows[0]['QUERY Plan'] || explain.rows[0]['QUERY PLAN'];
  const planData = Array.isArray(plan) ? plan[0] : plan;

  const executionTime = planData['Execution Time'] || planData['Total Runtime'] || 0;
  const planningTime = planData['Planning Time'] || 0;

  console.log(`\n${'='.repeat(80)}`);
  console.log(`QUERY: ${name}`);
  console.log(`${'='.repeat(80)}`);
  console.log(`  Planning:  ${planningTime.toFixed(2)}ms`);
  console.log(`  Execution: ${executionTime.toFixed(2)}ms`);
  console.log(`  Total:     ${(planningTime + executionTime).toFixed(2)}ms`);

  // Extract key details from plan
  const planNode = planData['Plan'];
  printPlanNode(planNode, 1);

  return { name, planningTime, executionTime, total: planningTime + executionTime };
}

function printPlanNode(node, depth) {
  if (!node) return;
  const indent = '  '.repeat(depth + 1);
  const type = node['Node Type'];
  const relation = node['Relation Name'] || '';
  const rows = node['Actual Rows'] || 0;
  const loops = node['Actual Loops'] || 1;
  const time = node['Actual Total Time'] || 0;
  const filter = node['Filter'] || '';
  const indexName = node['Index Name'] || '';

  let line = `${indent}→ ${type}`;
  if (relation) line += ` on ${relation}`;
  if (indexName) line += ` (${indexName})`;
  line += ` | rows=${rows} loops=${loops} time=${time.toFixed(2)}ms`;
  if (filter) line += ` | filter: ${filter}`;

  // Flag slow nodes
  if (time > 1.0) line += ' ⚠️ SLOW';
  if (loops > 1) line += ` 🔁 ${loops}x`;

  console.log(line);

  // Recurse into sub-plans
  const plans = node['Plans'] || [];
  for (const subPlan of plans) {
    printPlanNode(subPlan, depth + 1);
  }

  // Check for SubPlan nodes
  if (node['Subplan Name']) {
    console.log(`${indent}  (SubPlan: ${node['Subplan Name']})`);
  }
}

async function main() {
  console.log('SQL Query Profiler for EV Charging Platform');
  console.log(`Station ID: ${STATION_ID}`);
  console.log(`User ID: ${USER_ID}`);

  const results = [];

  // 1. Reliability Leaderboard (SLOWEST - #1)
  results.push(await profileQuery(
    'reliability/leaderboard',
    `SELECT srs.*, s.name AS station_name, s.address, s.city, s.rating AS station_rating
     FROM station_reliability_scores srs
     JOIN stations s ON s.id = srs.station_id
     WHERE srs.total_reviews >= $1
     ORDER BY srs.reliability_score DESC
     LIMIT $2`,
    [3, 20]
  ));

  // 2. Mobility Cities (SLOWEST - #2)
  results.push(await profileQuery(
    'mobility/cities',
    `SELECT DISTINCT city FROM stations
     WHERE city IS NOT NULL AND city != '' AND status = 'approved'
     ORDER BY city`,
    []
  ));

  // 3. Admin Stats (SLOWEST - #3) - the 18-subquery monster
  results.push(await profileQuery(
    'admin/stats',
    `SELECT
      (SELECT COUNT(*) FROM users) AS total_users,
      (SELECT COUNT(*) FROM users WHERE role = 'customer') AS total_customers,
      (SELECT COUNT(*) FROM users WHERE role = 'manager') AS total_managers,
      (SELECT COUNT(*) FROM stations) AS total_stations,
      (SELECT COUNT(*) FROM stations WHERE status = 'approved') AS approved_stations,
      (SELECT COUNT(*) FROM stations WHERE status = 'pending') AS pending_stations,
      (SELECT COUNT(*) FROM stations WHERE status = 'rejected') AS rejected_stations,
      (SELECT COUNT(*) FROM stations WHERE status = 'disabled') AS disabled_stations,
      (SELECT COUNT(*) FROM charging_slots) AS total_slots,
      (SELECT COUNT(*) FROM charging_slots WHERE status = 'available') AS available_slots,
      (SELECT COUNT(*) FROM charging_slots WHERE status = 'occupied') AS occupied_slots,
      (SELECT COUNT(*) FROM reservations) AS total_reservations,
      (SELECT COUNT(*) FROM reservations WHERE status = 'active') AS active_reservations,
      (SELECT COUNT(*) FROM reservations WHERE status = 'confirmed') AS confirmed_reservations,
      (SELECT COUNT(*) FROM charging_sessions) AS total_sessions,
      (SELECT COUNT(*) FROM charging_sessions WHERE status = 'charging') AS active_sessions,
      (SELECT COALESCE(SUM(energy_delivered_kwh), 0) FROM charging_sessions WHERE status = 'completed') AS total_energy_kwh,
      (SELECT COALESCE(SUM(cost), 0) FROM charging_sessions WHERE status = 'completed') AS total_revenue`,
    []
  ));

  // 4. Stations Nearby with N+1 subqueries
  results.push(await profileQuery(
    'stations/nearby',
    `SELECT s.*,
       earth_distance(ll_to_earth(s.latitude, s.longitude), ll_to_earth($1, $2)) as distance_meters,
       (SELECT COUNT(*) FROM charging_slots cs WHERE cs.station_id = s.id) as total_slots,
       (SELECT COUNT(*) FROM charging_slots cs WHERE cs.station_id = s.id AND cs.status = 'available') as available_slots
     FROM stations s
     WHERE s.status = 'approved'
       AND earth_distance(ll_to_earth(s.latitude, s.longitude), ll_to_earth($1, $2)) < $3
     ORDER BY distance_meters ASC
     LIMIT $4 OFFSET $5`,
    [37.7749, -122.4194, 50000, 20, 0]
  ));

  // 5. Reservations/my
  results.push(await profileQuery(
    'reservations/my',
    `SELECT r.*, s.name as station_name, s.address as station_address,
       cs.slot_number, cs.charging_type
     FROM reservations r
     JOIN stations s ON r.station_id = s.id
     JOIN charging_slots cs ON r.slot_id = cs.id
     WHERE r.user_id = $1
     ORDER BY r.scheduled_start DESC
     LIMIT $2 OFFSET $3`,
    [USER_ID, 20, 0]
  ));

  // 6. Admin Stations
  results.push(await profileQuery(
    'admin/stations',
    `SELECT s.*,
       u.email as manager_email,
       (SELECT COUNT(*) FROM charging_slots cs WHERE cs.station_id = s.id) as total_slots,
       (SELECT COUNT(*) FROM charging_slots cs WHERE cs.station_id = s.id AND cs.status = 'available') as available_slots,
       (SELECT COUNT(*) FROM charging_sessions ch WHERE ch.slot_id IN (SELECT id FROM charging_slots WHERE station_id = s.id) AND ch.status = 'charging') as active_sessions
     FROM stations s
     LEFT JOIN users u ON s.manager_id = u.id
     ORDER BY s.created_at DESC`,
    []
  ));

  // Summary
  console.log('\n\n' + '='.repeat(80));
  console.log('SUMMARY - SORTED BY TOTAL TIME');
  console.log('='.repeat(80));

  results.sort((a, b) => b.total - a.total);
  results.forEach((r, i) => {
    const bar = '█'.repeat(Math.ceil(r.total / 0.5));
    console.log(`  ${i + 1}. ${r.name.padEnd(35)} ${r.total.toFixed(2).padStart(8)}ms ${bar}`);
  });

  await pool.end();
}

main().catch(console.error);

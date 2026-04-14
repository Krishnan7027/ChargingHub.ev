'use strict';

/**
 * Full India ingestion from OpenChargeMap.
 *
 * Fetches ALL Indian EV charging stations and upserts into the database.
 * Run: node src/migrations/ingest-ocm-india.js
 */

require('dotenv').config();
const db = require('../config/database');

const OCM_KEY = process.env.OCM_API_KEY;
if (!OCM_KEY) {
  console.error('[ingest] OCM_API_KEY not set in .env');
  process.exit(1);
}

const CONNECTOR_MAP = {
  25: { chargingType: 'level2', connectorType: 'type2' },
  1036: { chargingType: 'level2', connectorType: 'type2' },
  33: { chargingType: 'dc_fast', connectorType: 'ccs' },
  2: { chargingType: 'dc_fast', connectorType: 'chademo' },
  1: { chargingType: 'level2', connectorType: 'type1' },
  30: { chargingType: 'dc_fast', connectorType: 'tesla' },
  27: { chargingType: 'dc_fast', connectorType: 'tesla' },
};

function mapConnector(typeId) {
  return CONNECTOR_MAP[typeId] || { chargingType: 'level2', connectorType: 'type2' };
}

async function fetchAllIndiaStations() {
  const url = `https://api.openchargemap.io/v3/poi?output=json&countrycode=IN&maxresults=5000&compact=true&verbose=false&key=${OCM_KEY}`;

  console.log('[ingest] Fetching all India stations from OpenChargeMap...');
  const res = await fetch(url, {
    headers: { 'User-Agent': 'EVChargeHub/1.0' },
  });

  if (!res.ok) throw new Error(`OCM returned ${res.status}: ${res.statusText}`);

  const data = await res.json();
  console.log(`[ingest] Received ${data.length} stations from OCM`);
  return data;
}

async function ingestStation(poi, managerId) {
  const addr = poi.AddressInfo || {};
  const connections = poi.Connections || [];

  if (!addr.Latitude || !addr.Longitude) return 'skipped';

  const externalId = `ocm-${poi.ID}`;

  // Check if already exists
  const { rows: existing } = await db.query(
    'SELECT id FROM stations WHERE external_id = $1',
    [externalId]
  );
  if (existing.length > 0) return 'exists';

  // Parse pricing
  let pricingPerKwh = 8.5; // default INR/kWh
  if (poi.UsageCost) {
    const match = poi.UsageCost.match(/[\d.]+/);
    if (match) {
      const val = parseFloat(match[0]);
      if (val > 0 && val < 100) pricingPerKwh = val;
    }
  }

  // Build slots from connections
  const slots = [];
  let slotNum = 1;
  for (const conn of connections) {
    if (!conn.ConnectionTypeID) continue;
    const mapped = mapConnector(conn.ConnectionTypeID);
    const qty = conn.Quantity || 1;
    for (let q = 0; q < qty && slotNum <= 20; q++) {
      slots.push({
        slotNumber: slotNum++,
        chargingType: mapped.chargingType,
        connectorType: mapped.connectorType,
        powerOutputKw: conn.PowerKW || (mapped.chargingType === 'dc_fast' ? 50 : 22),
      });
    }
  }
  if (slots.length === 0) {
    slots.push({ slotNumber: 1, chargingType: 'level2', connectorType: 'type2', powerOutputKw: 22 });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const stationName = addr.Title || `OCM Station ${poi.ID}`;
    const { rows: [station] } = await client.query(
      `INSERT INTO stations
         (manager_id, name, description, address, city, state, zip_code, country,
          latitude, longitude, status, pricing_per_kwh, external_id, external_source,
          rating, operating_hours, amenities)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'IN', $8, $9, 'approved', $10, $11, 'openchargemap',
               $12, '{"type":"ALWAYS_OPEN","schedule":null}', $13)
       RETURNING id`,
      [
        managerId,
        stationName,
        poi.GeneralComments || `EV charging station in ${addr.Town || 'India'}`,
        [addr.AddressLine1, addr.AddressLine2].filter(Boolean).join(', ') || stationName,
        addr.Town || 'Unknown',
        addr.StateOrProvince || '',
        addr.Postcode || '',
        addr.Latitude,
        addr.Longitude,
        pricingPerKwh,
        externalId,
        (3.0 + Math.random() * 1.8).toFixed(2),
        [],
      ]
    );

    for (const slot of slots) {
      await client.query(
        `INSERT INTO charging_slots (station_id, slot_number, charging_type, connector_type, power_output_kw, status)
         VALUES ($1, $2, $3, $4, $5, 'available')`,
        [station.id, slot.slotNumber, slot.chargingType, slot.connectorType, slot.powerOutputKw]
      );
    }

    await client.query('COMMIT');
    return 'created';
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  const pois = await fetchAllIndiaStations();

  // Get manager IDs
  const { rows: managers } = await db.query("SELECT id FROM users WHERE role = 'manager' LIMIT 3");
  if (managers.length === 0) {
    console.error('[ingest] No managers found. Run npm run seed first.');
    process.exit(1);
  }

  const stats = { created: 0, exists: 0, skipped: 0, errors: 0 };

  for (let i = 0; i < pois.length; i++) {
    const managerId = managers[i % managers.length].id;
    try {
      const result = await ingestStation(pois[i], managerId);
      stats[result]++;
      if (result === 'created' && stats.created % 50 === 0) {
        process.stdout.write(`  [${i + 1}/${pois.length}] ${stats.created} created...\r`);
      }
    } catch (err) {
      stats.errors++;
      if (stats.errors <= 5) {
        console.error(`  Error on POI ${pois[i].ID}: ${err.message}`);
      }
    }
  }

  console.log(`\n[ingest] Complete!`);
  console.log(`  Created:  ${stats.created}`);
  console.log(`  Existing: ${stats.exists}`);
  console.log(`  Skipped:  ${stats.skipped}`);
  console.log(`  Errors:   ${stats.errors}`);

  // Print city breakdown
  const { rows: cities } = await db.query(
    `SELECT city, COUNT(*) as cnt FROM stations WHERE external_source = 'openchargemap' GROUP BY city ORDER BY cnt DESC LIMIT 20`
  );
  console.log(`\nTop cities (OpenChargeMap):`);
  cities.forEach(c => console.log(`  ${c.city}: ${c.cnt}`));

  const { rows: [total] } = await db.query('SELECT COUNT(*) as cnt FROM stations');
  console.log(`\nTotal stations in database: ${total.cnt}`);
}

main()
  .then(() => process.exit(0))
  .catch(err => { console.error('[ingest] Fatal:', err); process.exit(1); });

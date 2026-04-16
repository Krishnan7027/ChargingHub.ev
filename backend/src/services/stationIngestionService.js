'use strict';

/**
 * Station Ingestion Service
 *
 * Pulls real-world EV charging station data from OpenChargeMap API
 * and upserts into the local database.
 *
 * OpenChargeMap is free, no API key required for moderate usage.
 * Docs: https://openchargemap.org/site/develop/api
 */

const db = require('../config/database');
const { logAudit } = require('../utils/auditLogger');

const env = require('../config/env');
const OCM_BASE = 'https://api.openchargemap.io/v3/poi';
const OCM_API_KEY = env.ocmApiKey || process.env.OCM_API_KEY || '';

// Map OCM connection types to our schema
const CONNECTOR_MAP = {
  // IEC Type 2 (Mennekes)
  25: { chargingType: 'level2', connectorType: 'type2' },
  1036: { chargingType: 'level2', connectorType: 'type2' },
  // CCS (Combo)
  33: { chargingType: 'dc_fast', connectorType: 'ccs' },
  // CHAdeMO
  2: { chargingType: 'dc_fast', connectorType: 'chademo' },
  // Type 1 (J1772)
  1: { chargingType: 'level2', connectorType: 'type1' },
  // Tesla
  30: { chargingType: 'dc_fast', connectorType: 'tesla' },
  27: { chargingType: 'dc_fast', connectorType: 'tesla' },
};

function mapConnector(ocmTypeId) {
  return CONNECTOR_MAP[ocmTypeId] || { chargingType: 'level2', connectorType: 'type2' };
}

/**
 * Fetch stations from OpenChargeMap for a given region.
 *
 * @param {Object} params
 * @param {number} params.latitude - Center latitude
 * @param {number} params.longitude - Center longitude
 * @param {number} params.radiusKm - Search radius in km (max ~250)
 * @param {number} params.maxResults - Max results (default 200)
 * @param {string} params.countryCode - ISO country code (e.g., 'IN', 'US')
 */
async function fetchFromOpenChargeMap({ latitude, longitude, radiusKm = 100, maxResults = 200, countryCode }) {
  const params = new URLSearchParams({
    output: 'json',
    latitude: String(latitude),
    longitude: String(longitude),
    distance: String(radiusKm),
    distanceunit: 'KM',
    maxresults: String(maxResults),
    compact: 'true',
    verbose: 'false',
  });

  if (countryCode) {
    params.set('countrycode', countryCode);
  }

  if (OCM_API_KEY) {
    params.set('key', OCM_API_KEY);
  }

  const url = `${OCM_BASE}?${params}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'EVChargeHub/1.0' },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`OpenChargeMap returned ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

/**
 * Transform an OpenChargeMap POI into our station + slots format.
 */
function transformOCMStation(poi) {
  const addr = poi.AddressInfo || {};
  const connections = poi.Connections || [];

  const station = {
    externalId: `ocm-${poi.ID}`,
    name: addr.Title || `Station ${poi.ID}`,
    address: [addr.AddressLine1, addr.AddressLine2].filter(Boolean).join(', ') || addr.Title || 'Unknown',
    city: addr.Town || 'Unknown',
    state: addr.StateOrProvince || '',
    zipCode: addr.Postcode || '',
    country: addr.Country?.ISOCode || 'IN',
    latitude: addr.Latitude,
    longitude: addr.Longitude,
    description: poi.GeneralComments || '',
    amenities: [],
    pricingPerKwh: null,
  };

  // Extract usage cost if available
  if (poi.UsageCost) {
    const match = poi.UsageCost.match(/[\d.]+/);
    if (match) {
      station.pricingPerKwh = parseFloat(match[0]);
    }
  }

  // Transform connections to slots
  const slots = connections
    .filter((c) => c.ConnectionTypeID)
    .map((c, i) => {
      const mapped = mapConnector(c.ConnectionTypeID);
      return {
        slotNumber: i + 1,
        chargingType: mapped.chargingType,
        connectorType: mapped.connectorType,
        powerOutputKw: c.PowerKW || (mapped.chargingType === 'dc_fast' ? 50 : 22),
        quantity: c.Quantity || 1,
      };
    });

  // Expand quantity into individual slots
  const expandedSlots = [];
  let slotNum = 1;
  for (const slot of slots) {
    for (let q = 0; q < slot.quantity; q++) {
      expandedSlots.push({
        slotNumber: slotNum++,
        chargingType: slot.chargingType,
        connectorType: slot.connectorType,
        powerOutputKw: slot.powerOutputKw,
      });
    }
  }

  // Ensure at least 1 slot
  if (expandedSlots.length === 0) {
    expandedSlots.push({
      slotNumber: 1,
      chargingType: 'level2',
      connectorType: 'type2',
      powerOutputKw: 22,
    });
  }

  return { station, slots: expandedSlots };
}

/**
 * Upsert a station and its slots into the database.
 * Uses external_id for deduplication.
 *
 * @param {string} managerId - The manager user ID to assign new stations to
 * @param {Object} stationData - Transformed station data
 * @param {Array} slotsData - Transformed slots data
 * @returns {{ created: boolean, stationId: string }}
 */
async function upsertStation(managerId, { station, slots }) {
  // Check if station already exists by external_id
  const { rows: existing } = await db.query(
    `SELECT id FROM stations WHERE external_id = $1`,
    [station.externalId],
  );

  if (existing.length > 0) {
    return { created: false, stationId: existing[0].id };
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Insert station
    const { rows: [newStation] } = await client.query(
      `INSERT INTO stations
         (manager_id, name, description, address, city, state, zip_code, country,
          latitude, longitude, status, pricing_per_kwh, external_id, external_source,
          operating_hours, amenities)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'approved', $11, $12, 'openchargemmap',
               '{"type":"ALWAYS_OPEN","schedule":null}', $13)
       RETURNING id`,
      [
        managerId,
        station.name,
        station.description,
        station.address,
        station.city,
        station.state,
        station.zipCode,
        station.country,
        station.latitude,
        station.longitude,
        station.pricingPerKwh || 8.5, // Default INR per kWh
        station.externalId,
        station.amenities || [],
      ],
    );

    // Insert slots
    for (const slot of slots) {
      await client.query(
        `INSERT INTO charging_slots (station_id, slot_number, charging_type, connector_type, power_output_kw, status)
         VALUES ($1, $2, $3, $4, $5, 'available')`,
        [newStation.id, slot.slotNumber, slot.chargingType, slot.connectorType, slot.powerOutputKw],
      );
    }

    await client.query('COMMIT');
    return { created: true, stationId: newStation.id };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Run a full ingestion for a region.
 *
 * @param {Object} params
 * @param {string} params.managerId - Manager to assign stations to
 * @param {number} params.latitude
 * @param {number} params.longitude
 * @param {number} params.radiusKm
 * @param {number} params.maxResults
 * @param {string} params.countryCode
 * @returns {{ fetched: number, created: number, skipped: number, errors: number }}
 */
async function ingestRegion({ managerId, latitude, longitude, radiusKm = 100, maxResults = 200, countryCode }) {
  const pois = await fetchFromOpenChargeMap({ latitude, longitude, radiusKm, maxResults, countryCode });

  const stats = { fetched: pois.length, created: 0, skipped: 0, errors: 0 };

  for (const poi of pois) {
    try {
      if (!poi.AddressInfo?.Latitude || !poi.AddressInfo?.Longitude) {
        stats.skipped++;
        continue;
      }

      const transformed = transformOCMStation(poi);
      const result = await upsertStation(managerId, transformed);

      if (result.created) {
        stats.created++;
      } else {
        stats.skipped++;
      }
    } catch (err) {
      console.error(`[ingestion] Failed to ingest OCM POI ${poi.ID}:`, err.message);
      stats.errors++;
    }
  }

  logAudit({
    userId: managerId,
    action: 'station.bulk_ingest',
    entityType: 'ingestion',
    details: { ...stats, region: { latitude, longitude, radiusKm, countryCode } },
  });

  return stats;
}

/**
 * Ingest stations for predefined Indian cities.
 */
async function ingestIndianStations(managerId) {
  const cities = [
    { name: 'Bengaluru', lat: 12.9716, lng: 77.5946, radius: 50 },
    { name: 'Mumbai', lat: 19.076, lng: 72.8777, radius: 50 },
    { name: 'Delhi', lat: 28.6139, lng: 77.209, radius: 50 },
    { name: 'Chennai', lat: 13.0827, lng: 80.2707, radius: 40 },
    { name: 'Hyderabad', lat: 17.385, lng: 78.4867, radius: 40 },
    { name: 'Pune', lat: 18.5204, lng: 73.8567, radius: 40 },
    { name: 'Kolkata', lat: 22.5726, lng: 88.3639, radius: 40 },
    { name: 'Ahmedabad', lat: 23.0225, lng: 72.5714, radius: 30 },
    { name: 'Jaipur', lat: 26.9124, lng: 75.7873, radius: 30 },
    { name: 'Kochi', lat: 9.9312, lng: 76.2673, radius: 30 },
  ];

  const totals = { fetched: 0, created: 0, skipped: 0, errors: 0 };

  for (const city of cities) {
    console.log(`[ingestion] Fetching stations for ${city.name}...`);
    try {
      const stats = await ingestRegion({
        managerId,
        latitude: city.lat,
        longitude: city.lng,
        radiusKm: city.radius,
        maxResults: 100,
        countryCode: 'IN',
      });
      totals.fetched += stats.fetched;
      totals.created += stats.created;
      totals.skipped += stats.skipped;
      totals.errors += stats.errors;
      console.log(`[ingestion]   ${city.name}: +${stats.created} new, ${stats.skipped} existing, ${stats.errors} errors`);
    } catch (err) {
      console.error(`[ingestion]   ${city.name} FAILED: ${err.message}`);
      totals.errors++;
    }
  }

  return totals;
}

module.exports = {
  fetchFromOpenChargeMap,
  transformOCMStation,
  upsertStation,
  ingestRegion,
  ingestIndianStations,
};

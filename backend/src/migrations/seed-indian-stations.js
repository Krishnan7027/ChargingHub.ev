'use strict';

/**
 * Seed real Indian EV charging stations.
 *
 * Curated dataset of actual charging locations across major Indian cities.
 * Run: node src/migrations/seed-indian-stations.js
 */

const db = require('../config/database');

const INDIAN_STATIONS = [
  // ── Bengaluru ─────────────────────────────────────────────
  { name: 'Tata Power EZ Charge - Indiranagar', address: '100 Feet Road, Indiranagar', city: 'Bengaluru', state: 'Karnataka', zip: '560038', lat: 12.9784, lng: 77.6408, price: 8.5, slots: [{ type: 'dc_fast', conn: 'ccs', kw: 60 }, { type: 'dc_fast', conn: 'chademo', kw: 50 }, { type: 'level2', conn: 'type2', kw: 22 }] },
  { name: 'Ather Grid - Koramangala', address: '80 Feet Road, Koramangala', city: 'Bengaluru', state: 'Karnataka', zip: '560034', lat: 12.9352, lng: 77.6245, price: 0, slots: [{ type: 'level2', conn: 'type2', kw: 7.4 }, { type: 'level2', conn: 'type2', kw: 7.4 }] },
  { name: 'BESCOM EV Station - MG Road', address: 'MG Road Metro Station', city: 'Bengaluru', state: 'Karnataka', zip: '560001', lat: 12.9756, lng: 77.6066, price: 7.0, slots: [{ type: 'dc_fast', conn: 'ccs', kw: 50 }, { type: 'level2', conn: 'type2', kw: 22 }] },
  { name: 'ChargeZone - Whitefield', address: 'ITPL Main Road, Whitefield', city: 'Bengaluru', state: 'Karnataka', zip: '560066', lat: 12.9698, lng: 77.7500, price: 9.0, slots: [{ type: 'dc_fast', conn: 'ccs', kw: 120 }, { type: 'dc_fast', conn: 'ccs', kw: 60 }, { type: 'level2', conn: 'type2', kw: 22 }] },
  { name: 'Statiq - Electronic City', address: 'Electronic City Phase 1', city: 'Bengaluru', state: 'Karnataka', zip: '560100', lat: 12.8456, lng: 77.6603, price: 8.0, slots: [{ type: 'dc_fast', conn: 'ccs', kw: 60 }, { type: 'level2', conn: 'type2', kw: 22 }, { type: 'level2', conn: 'type2', kw: 22 }] },
  { name: 'Tata Power - Hebbal', address: 'Hebbal Flyover, Bellary Road', city: 'Bengaluru', state: 'Karnataka', zip: '560024', lat: 13.0358, lng: 77.5970, price: 8.5, slots: [{ type: 'dc_fast', conn: 'ccs', kw: 50 }, { type: 'level2', conn: 'type2', kw: 22 }] },
  { name: 'BPCL EV Station - Jayanagar', address: 'Jayanagar 4th Block', city: 'Bengaluru', state: 'Karnataka', zip: '560041', lat: 12.9250, lng: 77.5938, price: 7.5, slots: [{ type: 'dc_fast', conn: 'ccs', kw: 50 }, { type: 'level2', conn: 'type2', kw: 22 }] },
  { name: 'Kazam EV Hub - HSR Layout', address: 'HSR Layout Sector 7', city: 'Bengaluru', state: 'Karnataka', zip: '560102', lat: 12.9116, lng: 77.6474, price: 9.5, slots: [{ type: 'dc_fast', conn: 'ccs', kw: 150 }, { type: 'dc_fast', conn: 'ccs', kw: 60 }, { type: 'level2', conn: 'type2', kw: 22 }, { type: 'level2', conn: 'type2', kw: 22 }] },

  // ── Mumbai ────────────────────────────────────────────────
  { name: 'Tata Power - BKC', address: 'Bandra Kurla Complex', city: 'Mumbai', state: 'Maharashtra', zip: '400051', lat: 19.0596, lng: 72.8656, price: 9.0, slots: [{ type: 'dc_fast', conn: 'ccs', kw: 60 }, { type: 'dc_fast', conn: 'chademo', kw: 50 }, { type: 'level2', conn: 'type2', kw: 22 }] },
  { name: 'Adani Electricity - Andheri', address: 'Andheri East, MIDC', city: 'Mumbai', state: 'Maharashtra', zip: '400093', lat: 19.1136, lng: 72.8697, price: 8.0, slots: [{ type: 'dc_fast', conn: 'ccs', kw: 50 }, { type: 'level2', conn: 'type2', kw: 22 }] },
  { name: 'ChargeZone - Powai', address: 'Hiranandani Gardens, Powai', city: 'Mumbai', state: 'Maharashtra', zip: '400076', lat: 19.1176, lng: 72.9060, price: 10.0, slots: [{ type: 'dc_fast', conn: 'ccs', kw: 120 }, { type: 'dc_fast', conn: 'ccs', kw: 60 }, { type: 'level2', conn: 'type2', kw: 22 }] },
  { name: 'IOCL EV Station - Worli', address: 'Worli Sea Face', city: 'Mumbai', state: 'Maharashtra', zip: '400018', lat: 19.0178, lng: 72.8150, price: 7.5, slots: [{ type: 'dc_fast', conn: 'ccs', kw: 50 }, { type: 'level2', conn: 'type2', kw: 22 }] },
  { name: 'Statiq - Lower Parel', address: 'Senapati Bapat Marg', city: 'Mumbai', state: 'Maharashtra', zip: '400013', lat: 19.0060, lng: 72.8313, price: 8.5, slots: [{ type: 'dc_fast', conn: 'ccs', kw: 60 }, { type: 'level2', conn: 'type2', kw: 22 }, { type: 'level2', conn: 'type2', kw: 22 }] },
  { name: 'EV Motors - Navi Mumbai', address: 'Palm Beach Road, Vashi', city: 'Navi Mumbai', state: 'Maharashtra', zip: '400703', lat: 19.0748, lng: 72.9986, price: 7.0, slots: [{ type: 'dc_fast', conn: 'ccs', kw: 50 }, { type: 'level2', conn: 'type2', kw: 22 }] },
  { name: 'Tata Power - Thane', address: 'Ghodbunder Road, Thane West', city: 'Thane', state: 'Maharashtra', zip: '400607', lat: 19.2183, lng: 72.9781, price: 8.0, slots: [{ type: 'dc_fast', conn: 'ccs', kw: 50 }, { type: 'level2', conn: 'type2', kw: 22 }] },

  // ── Delhi NCR ─────────────────────────────────────────────
  { name: 'Tata Power - Connaught Place', address: 'Connaught Place, Inner Circle', city: 'New Delhi', state: 'Delhi', zip: '110001', lat: 28.6315, lng: 77.2167, price: 8.0, slots: [{ type: 'dc_fast', conn: 'ccs', kw: 60 }, { type: 'dc_fast', conn: 'chademo', kw: 50 }, { type: 'level2', conn: 'type2', kw: 22 }] },
  { name: 'ChargeZone - Nehru Place', address: 'Nehru Place IT Hub', city: 'New Delhi', state: 'Delhi', zip: '110019', lat: 28.5491, lng: 77.2533, price: 9.0, slots: [{ type: 'dc_fast', conn: 'ccs', kw: 120 }, { type: 'dc_fast', conn: 'ccs', kw: 60 }] },
  { name: 'EESL EV Station - India Gate', address: 'Near India Gate, Rajpath', city: 'New Delhi', state: 'Delhi', zip: '110003', lat: 28.6129, lng: 77.2295, price: 7.0, slots: [{ type: 'dc_fast', conn: 'ccs', kw: 50 }, { type: 'level2', conn: 'type2', kw: 22 }] },
  { name: 'Fortum - Cyber Hub', address: 'DLF Cyber Hub, Gurugram', city: 'Gurugram', state: 'Haryana', zip: '122002', lat: 28.4943, lng: 77.0885, price: 10.0, slots: [{ type: 'dc_fast', conn: 'ccs', kw: 150 }, { type: 'dc_fast', conn: 'ccs', kw: 60 }, { type: 'level2', conn: 'type2', kw: 22 }] },
  { name: 'Statiq - Noida Sector 18', address: 'Sector 18, Atta Market', city: 'Noida', state: 'Uttar Pradesh', zip: '201301', lat: 28.5706, lng: 77.3218, price: 8.5, slots: [{ type: 'dc_fast', conn: 'ccs', kw: 60 }, { type: 'level2', conn: 'type2', kw: 22 }] },
  { name: 'BPCL EV - Dwarka', address: 'Sector 21, Dwarka', city: 'New Delhi', state: 'Delhi', zip: '110077', lat: 28.5731, lng: 77.0440, price: 7.5, slots: [{ type: 'dc_fast', conn: 'ccs', kw: 50 }, { type: 'level2', conn: 'type2', kw: 22 }] },

  // ── Chennai ───────────────────────────────────────────────
  { name: 'Tata Power - T Nagar', address: 'Usman Road, T Nagar', city: 'Chennai', state: 'Tamil Nadu', zip: '600017', lat: 13.0418, lng: 80.2341, price: 8.0, slots: [{ type: 'dc_fast', conn: 'ccs', kw: 50 }, { type: 'level2', conn: 'type2', kw: 22 }] },
  { name: 'ChargeZone - OMR', address: 'Old Mahabalipuram Road, Sholinganallur', city: 'Chennai', state: 'Tamil Nadu', zip: '600119', lat: 12.9010, lng: 80.2279, price: 9.0, slots: [{ type: 'dc_fast', conn: 'ccs', kw: 120 }, { type: 'dc_fast', conn: 'ccs', kw: 60 }, { type: 'level2', conn: 'type2', kw: 22 }] },
  { name: 'TANGEDCO EV - Marina Beach', address: 'Kamarajar Salai, Marina', city: 'Chennai', state: 'Tamil Nadu', zip: '600005', lat: 13.0500, lng: 80.2824, price: 6.5, slots: [{ type: 'dc_fast', conn: 'ccs', kw: 50 }, { type: 'level2', conn: 'type2', kw: 22 }] },
  { name: 'Ather Grid - Anna Nagar', address: 'Anna Nagar 2nd Avenue', city: 'Chennai', state: 'Tamil Nadu', zip: '600040', lat: 13.0850, lng: 80.2101, price: 0, slots: [{ type: 'level2', conn: 'type2', kw: 7.4 }, { type: 'level2', conn: 'type2', kw: 7.4 }] },

  // ── Hyderabad ──────────────────────────────────────────────
  { name: 'Tata Power - HITEC City', address: 'HITEC City, Madhapur', city: 'Hyderabad', state: 'Telangana', zip: '500081', lat: 17.4435, lng: 78.3772, price: 8.0, slots: [{ type: 'dc_fast', conn: 'ccs', kw: 60 }, { type: 'dc_fast', conn: 'chademo', kw: 50 }, { type: 'level2', conn: 'type2', kw: 22 }] },
  { name: 'ChargeZone - Gachibowli', address: 'Financial District, Gachibowli', city: 'Hyderabad', state: 'Telangana', zip: '500032', lat: 17.4260, lng: 78.3489, price: 9.5, slots: [{ type: 'dc_fast', conn: 'ccs', kw: 120 }, { type: 'dc_fast', conn: 'ccs', kw: 60 }] },
  { name: 'Statiq - Banjara Hills', address: 'Road No. 12, Banjara Hills', city: 'Hyderabad', state: 'Telangana', zip: '500034', lat: 17.4156, lng: 78.4347, price: 8.5, slots: [{ type: 'dc_fast', conn: 'ccs', kw: 50 }, { type: 'level2', conn: 'type2', kw: 22 }] },

  // ── Pune ──────────────────────────────────────────────────
  { name: 'Tata Power - Hinjewadi', address: 'Hinjewadi IT Park Phase 1', city: 'Pune', state: 'Maharashtra', zip: '411057', lat: 18.5912, lng: 73.7390, price: 8.0, slots: [{ type: 'dc_fast', conn: 'ccs', kw: 60 }, { type: 'level2', conn: 'type2', kw: 22 }, { type: 'level2', conn: 'type2', kw: 22 }] },
  { name: 'ChargeZone - Koregaon Park', address: 'North Main Road, Koregaon Park', city: 'Pune', state: 'Maharashtra', zip: '411001', lat: 18.5362, lng: 73.8937, price: 9.0, slots: [{ type: 'dc_fast', conn: 'ccs', kw: 60 }, { type: 'dc_fast', conn: 'ccs', kw: 50 }] },
  { name: 'HPCL EV - Kothrud', address: 'Karve Road, Kothrud', city: 'Pune', state: 'Maharashtra', zip: '411038', lat: 18.5074, lng: 73.8077, price: 7.5, slots: [{ type: 'dc_fast', conn: 'ccs', kw: 50 }, { type: 'level2', conn: 'type2', kw: 22 }] },

  // ── Kolkata ───────────────────────────────────────────────
  { name: 'Tata Power - Park Street', address: 'Park Street, Kolkata', city: 'Kolkata', state: 'West Bengal', zip: '700016', lat: 22.5527, lng: 88.3529, price: 7.5, slots: [{ type: 'dc_fast', conn: 'ccs', kw: 50 }, { type: 'level2', conn: 'type2', kw: 22 }] },
  { name: 'CESC EV Station - Salt Lake', address: 'Salt Lake Sector V', city: 'Kolkata', state: 'West Bengal', zip: '700091', lat: 22.5726, lng: 88.4312, price: 7.0, slots: [{ type: 'dc_fast', conn: 'ccs', kw: 50 }, { type: 'level2', conn: 'type2', kw: 22 }] },

  // ── Ahmedabad ─────────────────────────────────────────────
  { name: 'Tata Power - SG Highway', address: 'SG Highway, Bodakdev', city: 'Ahmedabad', state: 'Gujarat', zip: '380054', lat: 23.0339, lng: 72.5076, price: 7.5, slots: [{ type: 'dc_fast', conn: 'ccs', kw: 60 }, { type: 'level2', conn: 'type2', kw: 22 }] },
  { name: 'Statiq - Prahlad Nagar', address: 'Prahlad Nagar Garden', city: 'Ahmedabad', state: 'Gujarat', zip: '380015', lat: 23.0145, lng: 72.5112, price: 8.0, slots: [{ type: 'dc_fast', conn: 'ccs', kw: 50 }, { type: 'level2', conn: 'type2', kw: 22 }] },

  // ── Kochi ─────────────────────────────────────────────────
  { name: 'KSEB EV Station - MG Road', address: 'MG Road, Ernakulam', city: 'Kochi', state: 'Kerala', zip: '682035', lat: 9.9816, lng: 76.2999, price: 6.5, slots: [{ type: 'dc_fast', conn: 'ccs', kw: 50 }, { type: 'level2', conn: 'type2', kw: 22 }] },
  { name: 'Tata Power - Kakkanad', address: 'Infopark, Kakkanad', city: 'Kochi', state: 'Kerala', zip: '682030', lat: 10.0099, lng: 76.3541, price: 8.0, slots: [{ type: 'dc_fast', conn: 'ccs', kw: 60 }, { type: 'level2', conn: 'type2', kw: 22 }] },

  // ── Jaipur ────────────────────────────────────────────────
  { name: 'Tata Power - MI Road', address: 'MI Road, C Scheme', city: 'Jaipur', state: 'Rajasthan', zip: '302001', lat: 26.9124, lng: 75.7873, price: 7.5, slots: [{ type: 'dc_fast', conn: 'ccs', kw: 50 }, { type: 'level2', conn: 'type2', kw: 22 }] },
  { name: 'BPCL EV - Mansarovar', address: 'Jaipur-Ajmer Highway, Mansarovar', city: 'Jaipur', state: 'Rajasthan', zip: '302020', lat: 26.8657, lng: 75.7591, price: 7.0, slots: [{ type: 'dc_fast', conn: 'ccs', kw: 50 }, { type: 'level2', conn: 'type2', kw: 22 }] },

  // ── Highway corridors ─────────────────────────────────────
  { name: 'Tata Power - Lonavala (Mumbai-Pune Expy)', address: 'Mumbai-Pune Expressway, Lonavala', city: 'Lonavala', state: 'Maharashtra', zip: '410401', lat: 18.7546, lng: 73.4062, price: 10.0, slots: [{ type: 'dc_fast', conn: 'ccs', kw: 150 }, { type: 'dc_fast', conn: 'ccs', kw: 60 }, { type: 'dc_fast', conn: 'chademo', kw: 50 }] },
  { name: 'IOCL EV - Tumkur (BLR-MUM Highway)', address: 'NH48, Tumkur', city: 'Tumkur', state: 'Karnataka', zip: '572101', lat: 13.3379, lng: 77.1019, price: 8.5, slots: [{ type: 'dc_fast', conn: 'ccs', kw: 60 }, { type: 'dc_fast', conn: 'ccs', kw: 50 }] },
  { name: 'ChargeZone - Mathura (Delhi-Agra)', address: 'NH44, Mathura', city: 'Mathura', state: 'Uttar Pradesh', zip: '281001', lat: 27.4924, lng: 77.6737, price: 9.0, slots: [{ type: 'dc_fast', conn: 'ccs', kw: 120 }, { type: 'dc_fast', conn: 'ccs', kw: 60 }] },
  { name: 'Statiq - Surat (Mumbai-Ahmedabad)', address: 'NH48, Surat Ring Road', city: 'Surat', state: 'Gujarat', zip: '395007', lat: 21.1702, lng: 72.8311, price: 8.0, slots: [{ type: 'dc_fast', conn: 'ccs', kw: 60 }, { type: 'level2', conn: 'type2', kw: 22 }] },
  { name: 'Tata Power - Hosur (BLR-Chennai)', address: 'NH44, Hosur', city: 'Hosur', state: 'Tamil Nadu', zip: '635109', lat: 12.7409, lng: 77.8253, price: 8.0, slots: [{ type: 'dc_fast', conn: 'ccs', kw: 60 }, { type: 'dc_fast', conn: 'ccs', kw: 50 }] },
];

async function seedIndianStations() {
  console.log(`\n[seed] Seeding ${INDIAN_STATIONS.length} Indian EV charging stations...\n`);

  // Get or create a manager for Indian stations
  const { rows: managers } = await db.query(
    `SELECT id FROM users WHERE role = 'manager' LIMIT 3`,
  );

  if (managers.length === 0) {
    console.error('[seed] No managers found. Run main seed first: npm run seed');
    process.exit(1);
  }

  let created = 0;
  let skipped = 0;

  for (let i = 0; i < INDIAN_STATIONS.length; i++) {
    const s = INDIAN_STATIONS[i];
    const managerId = managers[i % managers.length].id;
    const externalId = `curated-in-${i + 1}`;

    // Check if already exists
    const { rows: existing } = await db.query(
      `SELECT id FROM stations WHERE external_id = $1`,
      [externalId],
    );

    if (existing.length > 0) {
      skipped++;
      continue;
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: [station] } = await client.query(
        `INSERT INTO stations
           (manager_id, name, description, address, city, state, zip_code, country,
            latitude, longitude, status, pricing_per_kwh, external_id, external_source,
            rating, operating_hours, amenities)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'IN', $8, $9, 'approved', $10, $11, 'curated',
                 $12, '{"type":"ALWAYS_OPEN","schedule":null}', $13)
         RETURNING id`,
        [
          managerId,
          s.name,
          `EV charging station in ${s.city}`,
          s.address,
          s.city,
          s.state,
          s.zip,
          s.lat,
          s.lng,
          s.price,
          externalId,
          (3.5 + Math.random() * 1.4).toFixed(2),
          ['wifi', 'restroom'],
        ],
      );

      for (const slot of s.slots) {
        await client.query(
          `INSERT INTO charging_slots (station_id, slot_number, charging_type, connector_type, power_output_kw, status)
           VALUES ($1, $2, $3, $4, $5, 'available')`,
          [station.id, s.slots.indexOf(slot) + 1, slot.type, slot.conn, slot.kw],
        );
      }

      await client.query('COMMIT');
      created++;
      process.stdout.write(`  [${created}/${INDIAN_STATIONS.length}] ${s.name} (${s.city})\n`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`  FAILED: ${s.name} — ${err.message}`);
    } finally {
      client.release();
    }
  }

  console.log(`\n[seed] Done: ${created} created, ${skipped} skipped (already exist)`);
  console.log(`[seed] Total Indian stations: ${INDIAN_STATIONS.length} across 10+ cities + highway corridors\n`);
}

seedIndianStations()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[seed] Fatal error:', err);
    process.exit(1);
  });

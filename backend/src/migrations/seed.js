require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');

// ── Helpers ──────────────────────────────────────────────────

function hoursAgo(h) { return new Date(Date.now() - h * 3600_000); }
function hoursFromNow(h) { return new Date(Date.now() + h * 3600_000); }
function daysAgo(d) { return new Date(Date.now() - d * 86400_000); }
function randomBetween(min, max) { return Math.round((Math.random() * (max - min) + min) * 100) / 100; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// San Francisco Bay Area stations with realistic coordinates
const STATION_DATA = [
  { name: 'Downtown EV Hub',          address: '123 Main St',           city: 'San Francisco', state: 'CA', zip: '94102', lat: 37.7749, lng: -122.4194, price: 0.35, amenities: ['wifi','restroom','cafe'],     desc: 'Fast charging in the heart of downtown SF, steps from BART' },
  { name: 'SFO Airport Charging',     address: '780 Airport Blvd',      city: 'San Francisco', state: 'CA', zip: '94128', lat: 37.6213, lng: -122.3790, price: 0.42, amenities: ['wifi','parking','security'],  desc: 'Convenient charging near SFO terminals with covered parking' },
  { name: 'Mission Bay Supercharger',  address: '501 Terry Francois',    city: 'San Francisco', state: 'CA', zip: '94158', lat: 37.7712, lng: -122.3870, price: 0.38, amenities: ['wifi','restroom'],            desc: 'High-speed DC charging near Oracle Park' },
  { name: 'Oakland Tech Hub',         address: '1999 Harrison St',      city: 'Oakland',       state: 'CA', zip: '94612', lat: 37.8044, lng: -122.2712, price: 0.32, amenities: ['wifi','restroom','parking'],  desc: 'Affordable charging in downtown Oakland near Lake Merritt' },
  { name: 'Berkeley Green Station',   address: '2100 University Ave',   city: 'Berkeley',      state: 'CA', zip: '94704', lat: 37.8716, lng: -122.2727, price: 0.30, amenities: ['wifi','cafe','bike_rack'],    desc: '100% solar-powered charging near UC Berkeley campus' },
  { name: 'Palo Alto EV Depot',       address: '450 University Ave',    city: 'Palo Alto',     state: 'CA', zip: '94301', lat: 37.4419, lng: -122.1430, price: 0.40, amenities: ['wifi','restroom','parking'],  desc: 'Premium charging in downtown Palo Alto' },
  { name: 'San Jose Convention',      address: '150 W San Carlos St',   city: 'San Jose',      state: 'CA', zip: '95113', lat: 37.3300, lng: -121.8886, price: 0.33, amenities: ['wifi','restroom','security'], desc: 'Large station near San Jose Convention Center' },
  { name: 'Fremont Factory Charge',   address: '45500 Fremont Blvd',    city: 'Fremont',       state: 'CA', zip: '94538', lat: 37.4946, lng: -121.9420, price: 0.28, amenities: ['wifi','parking'],             desc: 'Budget-friendly charging near Tesla factory area' },
  { name: 'Marin Gateway Charging',   address: '100 Donahue St',        city: 'Sausalito',     state: 'CA', zip: '94965', lat: 37.8590, lng: -122.4852, price: 0.45, amenities: ['restroom','scenic_view'],     desc: 'Scenic charging with Golden Gate Bridge views' },
  { name: 'Daly City BART Station',   address: '500 John Daly Blvd',    city: 'Daly City',     state: 'CA', zip: '94014', lat: 37.7006, lng: -122.4662, price: 0.31, amenities: ['parking','transit'],          desc: 'Park & charge while you commute via BART' },
  { name: 'Mountain View Tech Park',  address: '1600 Amphitheatre Pkwy',city: 'Mountain View', state: 'CA', zip: '94043', lat: 37.4220, lng: -122.0841, price: 0.36, amenities: ['wifi','restroom','parking'],  desc: 'Charging near Google campus and Shoreline trails' },
  { name: 'Walnut Creek Plaza',       address: '1299 N California Blvd',city: 'Walnut Creek',  state: 'CA', zip: '94596', lat: 37.9024, lng: -122.0614, price: 0.34, amenities: ['wifi','restroom','shopping'], desc: 'Charge while you shop at Broadway Plaza' },
];

// Slot configurations per station type
const SLOT_CONFIGS = {
  large:  [
    { n: 1, type: 'dc_fast', conn: 'ccs',     kw: 150 },
    { n: 2, type: 'dc_fast', conn: 'ccs',     kw: 150 },
    { n: 3, type: 'dc_fast', conn: 'chademo', kw: 100 },
    { n: 4, type: 'level2',  conn: 'type2',   kw: 22 },
    { n: 5, type: 'level2',  conn: 'type2',   kw: 22 },
    { n: 6, type: 'level2',  conn: 'type1',   kw: 19.2 },
    { n: 7, type: 'level2',  conn: 'type2',   kw: 11 },
    { n: 8, type: 'level1',  conn: 'type1',   kw: 7.4 },
  ],
  medium: [
    { n: 1, type: 'dc_fast', conn: 'ccs',   kw: 150 },
    { n: 2, type: 'dc_fast', conn: 'ccs',   kw: 100 },
    { n: 3, type: 'level2',  conn: 'type2', kw: 22 },
    { n: 4, type: 'level2',  conn: 'type2', kw: 22 },
    { n: 5, type: 'level2',  conn: 'type1', kw: 11 },
    { n: 6, type: 'level1',  conn: 'type1', kw: 7.4 },
  ],
  small:  [
    { n: 1, type: 'dc_fast', conn: 'ccs',   kw: 50 },
    { n: 2, type: 'level2',  conn: 'type2', kw: 22 },
    { n: 3, type: 'level2',  conn: 'type2', kw: 22 },
    { n: 4, type: 'level1',  conn: 'type1', kw: 7.4 },
  ],
};

const stationSizes = ['large','medium','medium','small','medium','large','large','medium','small','small','large','medium'];

const CUSTOMER_NAMES = [
  'Sarah Chen', 'Marcus Williams', 'Priya Patel', 'James O\'Brien',
  'Yuki Tanaka', 'Elena Rodriguez', 'David Kim', 'Fatima Al-Hassan',
  'Lucas Moreau', 'Aisha Johnson', 'Erik Lindberg', 'Maria Santos',
  'Kevin Nguyen', 'Zoe Thompson', 'Carlos Rivera', 'Hannah Miller',
  'Raj Sharma', 'Olivia Park', 'Ben Foster', 'Lena Kowalski',
];

const VEHICLE_TYPES = [
  { make: 'Tesla',    model: 'Model 3', cap: 57.5 },
  { make: 'Tesla',    model: 'Model Y', cap: 75 },
  { make: 'Tesla',    model: 'Model S', cap: 100 },
  { make: 'BMW',      model: 'i4',      cap: 83.9 },
  { make: 'Hyundai',  model: 'Ioniq 5', cap: 77.4 },
  { make: 'Ford',     model: 'Mach-E',  cap: 91 },
  { make: 'Rivian',   model: 'R1T',     cap: 135 },
  { make: 'Chevy',    model: 'Bolt EV', cap: 65 },
  { make: 'VW',       model: 'ID.4',    cap: 82 },
  { make: 'Kia',      model: 'EV6',     cap: 77.4 },
  { make: 'Polestar', model: '2',       cap: 78 },
  { make: 'Nissan',   model: 'Ariya',   cap: 87 },
];

const REVIEW_COMMENTS = [
  'Great station, fast charging and clean facilities!',
  'Reliable chargers. Been using this station for months.',
  'Nice location but can get busy during rush hour.',
  'Love the cafe nearby. Perfect for waiting.',
  'One of the best stations in the area. Highly recommend!',
  'Decent charging speed. Parking is convenient.',
  'Good station but could use more DC fast chargers.',
  'Always available when I need it. My go-to station.',
  'WiFi is a nice touch. Makes the wait easier.',
  'Clean, well-maintained, and affordable.',
  'Had to wait 10 min but the charging was fast.',
  'Friendly staff and great amenities.',
];

// ── Main seed function ───────────────────────────────────────

async function seed() {
  const client = await pool.connect();
  try {
    // Skip seeding if data already exists (idempotent for production deploys)
    const { rows: [{ count }] } = await client.query('SELECT COUNT(*)::int AS count FROM users');
    if (count > 0) {
      console.log(`Database already seeded (${count} users found). Skipping.`);
      return;
    }

    await client.query('BEGIN');

    console.log('Seeding users...');

    // Hash passwords once (bcrypt is slow, reuse for demo users)
    const hash = await bcrypt.hash('password123', 12);
    const adminHash = await bcrypt.hash('admin123', 12);

    // Admin
    const { rows: [admin] } = await client.query(`
      INSERT INTO users (email, password_hash, full_name, phone, role, email_verified)
      VALUES ('admin@evcharge.com', $1, 'Platform Admin', '+14155550000', 'admin', true)
      ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
      RETURNING id
    `, [adminHash]);

    // Managers (3 — each manages different stations)
    const managerNames = ['Alex Manager', 'Jordan Stations', 'Riley Charge'];
    const managerIds = [];
    for (let i = 0; i < managerNames.length; i++) {
      const { rows: [mgr] } = await client.query(`
        INSERT INTO users (email, password_hash, full_name, phone, role, email_verified)
        VALUES ($1, $2, $3, $4, 'manager', true)
        ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
        RETURNING id
      `, [`manager${i + 1}@evcharge.com`, hash, managerNames[i], `+1415555${String(100 + i).padStart(4, '0')}`]);
      managerIds.push(mgr.id);
    }

    // Customers (20 diverse users)
    const customerIds = [];
    for (let i = 0; i < CUSTOMER_NAMES.length; i++) {
      const { rows: [cust] } = await client.query(`
        INSERT INTO users (email, password_hash, full_name, phone, role, email_verified, created_at)
        VALUES ($1, $2, $3, $4, 'customer', true, $5)
        ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
        RETURNING id
      `, [
        `user${i + 1}@evcharge.com`,
        hash,
        CUSTOMER_NAMES[i],
        `+1415555${String(200 + i).padStart(4, '0')}`,
        daysAgo(Math.floor(Math.random() * 90) + 10), // joined 10-100 days ago
      ]);
      customerIds.push(cust.id);
    }

    // Keep backward compat credentials
    await client.query(`
      INSERT INTO users (email, password_hash, full_name, phone, role, email_verified)
      VALUES ('customer@evcharge.com', $1, 'John EV Owner', '+14155559999', 'customer', true)
      ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
      RETURNING id
    `, [hash]);
    await client.query(`
      INSERT INTO users (email, password_hash, full_name, phone, role, email_verified)
      VALUES ('manager@evcharge.com', $1, 'Station Manager', '+14155559998', 'manager', true)
      ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
      RETURNING id
    `, [hash]);

    console.log(`  Created ${3 + CUSTOMER_NAMES.length + 3} users`);

    // ── Stations ──────────────────────────────────────────
    console.log('Seeding stations...');

    const stationIds = [];
    const stationSlotIds = []; // stationSlotIds[stationIdx] = [slotId, ...]
    const stationPrices = [];

    for (let si = 0; si < STATION_DATA.length; si++) {
      const s = STATION_DATA[si];
      const managerId = managerIds[si % managerIds.length];
      const rating = randomBetween(3.5, 4.9);

      const { rows: [station] } = await client.query(`
        INSERT INTO stations (manager_id, name, description, address, city, state, zip_code, latitude, longitude,
                              status, pricing_per_kwh, amenities, rating, total_reviews,
                              operating_hours)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'approved', $10, $11, $12, $13, $14)
        ON CONFLICT DO NOTHING
        RETURNING id
      `, [
        managerId, s.name, s.desc, s.address, s.city, s.state, s.zip,
        s.lat, s.lng, s.price, s.amenities, rating,
        Math.floor(Math.random() * 40) + 5,
        JSON.stringify({ open: '06:00', close: '23:00', timezone: 'America/Los_Angeles' }),
      ]);

      if (!station) continue;
      stationIds.push(station.id);
      stationPrices.push(s.price);

      // ── Slots ─────────────────────────────────────────
      const config = SLOT_CONFIGS[stationSizes[si]];
      const slotIds = [];
      for (const slot of config) {
        const { rows: [sl] } = await client.query(`
          INSERT INTO charging_slots (station_id, slot_number, charging_type, connector_type, power_output_kw)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (station_id, slot_number) DO NOTHING
          RETURNING id
        `, [station.id, slot.n, slot.type, slot.conn, slot.kw]);
        if (sl) slotIds.push({ id: sl.id, kw: slot.kw, type: slot.type });
      }
      stationSlotIds.push(slotIds);
    }

    console.log(`  Created ${stationIds.length} stations with ${stationSlotIds.flat().length} total slots`);

    // ── Historical completed sessions (last 30 days) ────
    console.log('Seeding historical sessions & reservations...');

    let sessionCount = 0;
    let reservationCount = 0;

    for (let dayOffset = 30; dayOffset >= 1; dayOffset--) {
      for (let si = 0; si < stationIds.length; si++) {
        const slots = stationSlotIds[si];
        if (!slots.length) continue;
        const price = stationPrices[si];

        // Each station gets 3-10 sessions per day (busier stations get more)
        const sessionsPerDay = Math.floor(Math.random() * 8) + 3;

        for (let s = 0; s < sessionsPerDay; s++) {
          const slot = pick(slots);
          const cust = pick(customerIds);
          const vehicle = pick(VEHICLE_TYPES);

          const startHour = Math.floor(Math.random() * 16) + 6; // 6am-10pm
          const startDate = new Date(daysAgo(dayOffset));
          startDate.setHours(startHour, Math.floor(Math.random() * 60), 0, 0);

          const startPct = randomBetween(10, 45);
          const targetPct = randomBetween(80, 100);
          const energyKwh = ((targetPct - startPct) / 100) * vehicle.cap;
          const durationMin = Math.ceil((energyKwh / (slot.kw * 0.85)) * 60);
          const endDate = new Date(startDate.getTime() + durationMin * 60_000);
          const cost = Math.round(energyKwh * price * 100) / 100;
          const avgPower = Math.round(slot.kw * randomBetween(0.7, 0.95) * 100) / 100;

          // ~60% of sessions have a reservation
          let resId = null;
          if (Math.random() < 0.6) {
            const { rows: [res] } = await client.query(`
              INSERT INTO reservations (user_id, slot_id, station_id, status, scheduled_start, scheduled_end,
                                        actual_start, actual_end, vehicle_info, created_at)
              VALUES ($1, $2, $3, 'completed', $4, $5, $4, $5, $6, $7)
              RETURNING id
            `, [cust, slot.id, stationIds[si], startDate, endDate,
                JSON.stringify({ make: vehicle.make, model: vehicle.model }),
                new Date(startDate.getTime() - 3600_000)]);
            resId = res.id;
            reservationCount++;
          }

          await client.query(`
            INSERT INTO charging_sessions (reservation_id, slot_id, user_id, status,
                                           start_percentage, current_percentage, target_percentage,
                                           energy_delivered_kwh, average_power_kw, cost,
                                           started_at, completed_at, created_at)
            VALUES ($1, $2, $3, 'completed', $4, $5, $5, $6, $7, $8, $9, $10, $9)
          `, [resId, slot.id, cust, startPct, targetPct,
              energyKwh, avgPower, cost, startDate, endDate]);
          sessionCount++;
        }
      }
    }

    console.log(`  Created ${sessionCount} historical sessions, ${reservationCount} reservations`);

    // ── Active "charging" sessions (right now) ──────────
    console.log('Seeding active sessions...');

    let activeCount = 0;
    for (let si = 0; si < stationIds.length; si++) {
      const slots = stationSlotIds[si];
      if (!slots.length) continue;

      // 1-3 slots currently charging per station
      const activeSlots = slots.sort(() => Math.random() - 0.5).slice(0, Math.min(Math.floor(Math.random() * 3) + 1, slots.length));

      for (const slot of activeSlots) {
        const cust = pick(customerIds);
        const vehicle = pick(VEHICLE_TYPES);
        const startedMinAgo = Math.floor(Math.random() * 60) + 10; // started 10-70 min ago
        const startPct = randomBetween(8, 35);
        const targetPct = randomBetween(80, 100);

        // Simulate progress based on elapsed time
        const elapsedHours = startedMinAgo / 60;
        const energySoFar = slot.kw * 0.85 * elapsedHours;
        const pctGained = (energySoFar / vehicle.cap) * 100;
        const currentPct = Math.min(Math.round((startPct + pctGained) * 100) / 100, targetPct - 1);
        const avgPower = Math.round(slot.kw * randomBetween(0.75, 0.95) * 100) / 100;
        const cost = Math.round(energySoFar * stationPrices[si] * 100) / 100;

        const { rows: [sess] } = await client.query(`
          INSERT INTO charging_sessions (slot_id, user_id, status,
                                         start_percentage, current_percentage, target_percentage,
                                         energy_delivered_kwh, average_power_kw, cost,
                                         started_at, created_at)
          VALUES ($1, $2, 'charging', $3, $4, $5, $6, $7, $8, $9, $9)
          RETURNING id
        `, [slot.id, cust, startPct, currentPct, targetPct,
            energySoFar, avgPower, cost,
            hoursAgo(startedMinAgo / 60)]);

        // Mark slot as occupied
        await client.query(`
          UPDATE charging_slots SET status = 'occupied', current_session_id = $1 WHERE id = $2
        `, [sess.id, slot.id]);

        activeCount++;
      }
    }

    console.log(`  Created ${activeCount} active charging sessions`);

    // ── Upcoming reservations (next 24h) ────────────────
    console.log('Seeding upcoming reservations...');

    let upcomingCount = 0;
    for (let si = 0; si < stationIds.length; si++) {
      const slots = stationSlotIds[si];
      const availableSlots = [];

      // Find slots that are still available
      const { rows: avail } = await client.query(
        `SELECT id FROM charging_slots WHERE station_id = $1 AND status = 'available'`,
        [stationIds[si]]
      );
      for (const row of avail) {
        const match = slots.find((s) => s.id === row.id);
        if (match) availableSlots.push(match);
      }

      // 0-2 upcoming reservations per station
      const count = Math.min(Math.floor(Math.random() * 3), availableSlots.length);
      for (let r = 0; r < count; r++) {
        const slot = availableSlots[r];
        const cust = pick(customerIds);
        const vehicle = pick(VEHICLE_TYPES);
        const startH = randomBetween(1, 20);
        const start = hoursFromNow(startH);
        const end = hoursFromNow(startH + randomBetween(0.5, 2));

        await client.query(`
          INSERT INTO reservations (user_id, slot_id, station_id, status, scheduled_start, scheduled_end, vehicle_info)
          VALUES ($1, $2, $3, 'confirmed', $4, $5, $6)
        `, [cust, slot.id, stationIds[si], start, end,
            JSON.stringify({ make: vehicle.make, model: vehicle.model })]);

        await client.query(`UPDATE charging_slots SET status = 'reserved' WHERE id = $1`, [slot.id]);
        upcomingCount++;
      }
    }

    console.log(`  Created ${upcomingCount} upcoming reservations`);

    // ── Slot usage history (for prediction engine) ──────
    console.log('Seeding slot usage history...');

    let historyCount = 0;
    for (let si = 0; si < stationIds.length; si++) {
      const slots = stationSlotIds[si];

      for (const slot of slots) {
        // Populate usage patterns for each day-of-week and busy hours
        for (let day = 0; day <= 6; day++) {
          // Weekdays (1-5) are busier than weekends
          const isWeekday = day >= 1 && day <= 5;

          for (let hour = 6; hour <= 22; hour++) {
            // Usage varies by time of day
            let baseSessions;
            if (hour >= 7 && hour <= 9) baseSessions = isWeekday ? 5 : 2;        // morning commute
            else if (hour >= 11 && hour <= 13) baseSessions = isWeekday ? 4 : 3;  // lunch
            else if (hour >= 17 && hour <= 19) baseSessions = isWeekday ? 6 : 3;  // evening commute
            else baseSessions = isWeekday ? 2 : 2;                                 // off-peak

            const usageCount = baseSessions + Math.floor(Math.random() * 3);
            if (usageCount === 0) continue;

            // Duration depends on charger speed: DC fast = shorter, Level 1 = longer
            let avgDuration;
            if (slot.type === 'dc_fast') avgDuration = randomBetween(20, 45);
            else if (slot.type === 'level2') avgDuration = randomBetween(45, 120);
            else avgDuration = randomBetween(120, 300);

            const avgEnergy = (avgDuration / 60) * slot.kw * 0.85;

            await client.query(`
              INSERT INTO slot_usage_history (slot_id, station_id, day_of_week, hour_of_day,
                                              avg_session_duration_min, avg_energy_kwh, usage_count)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
              ON CONFLICT (slot_id, day_of_week, hour_of_day) DO UPDATE SET
                avg_session_duration_min = EXCLUDED.avg_session_duration_min,
                avg_energy_kwh = EXCLUDED.avg_energy_kwh,
                usage_count = EXCLUDED.usage_count
            `, [slot.id, stationIds[si], day, hour, avgDuration, avgEnergy, usageCount]);
            historyCount++;
          }
        }
      }
    }

    console.log(`  Created ${historyCount} usage history records`);

    // ── Reviews ─────────────────────────────────────────
    console.log('Seeding reviews...');

    let reviewCount = 0;
    const usedPairs = new Set();

    for (let si = 0; si < stationIds.length; si++) {
      // 4-12 reviews per station
      const numReviews = Math.floor(Math.random() * 9) + 4;
      const shuffledCustomers = [...customerIds].sort(() => Math.random() - 0.5);

      for (let r = 0; r < Math.min(numReviews, shuffledCustomers.length); r++) {
        const key = `${shuffledCustomers[r]}:${stationIds[si]}`;
        if (usedPairs.has(key)) continue;
        usedPairs.add(key);

        const rating = Math.random() < 0.7 ? pick([4, 5]) : pick([2, 3, 4]);

        await client.query(`
          INSERT INTO reviews (user_id, station_id, rating, comment, created_at)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (user_id, station_id) DO NOTHING
        `, [shuffledCustomers[r], stationIds[si], rating,
            pick(REVIEW_COMMENTS),
            daysAgo(Math.floor(Math.random() * 60))]);
        reviewCount++;
      }
    }

    console.log(`  Created ${reviewCount} reviews`);

    // ── Update station ratings from reviews ─────────────
    await client.query(`
      UPDATE stations s SET
        rating = sub.avg_rating,
        total_reviews = sub.cnt
      FROM (
        SELECT station_id, ROUND(AVG(rating)::numeric, 2) AS avg_rating, COUNT(*) AS cnt
        FROM reviews GROUP BY station_id
      ) sub
      WHERE s.id = sub.station_id
    `);

    await client.query('COMMIT');

    console.log('\nSeed complete!');
    console.log('──────────────────────────────────────');
    console.log('Credentials (all passwords: password123):');
    console.log('  Admin:     admin@evcharge.com / admin123');
    console.log('  Managers:  manager1@evcharge.com, manager2@evcharge.com, manager3@evcharge.com');
    console.log('  Customers: user1@evcharge.com ... user20@evcharge.com');
    console.log('  Legacy:    customer@evcharge.com, manager@evcharge.com');
    console.log('──────────────────────────────────────');
    console.log(`  ${stationIds.length} stations across SF Bay Area`);
    console.log(`  ${stationSlotIds.flat().length} charging slots (DC Fast + Level 2 + Level 1)`);
    console.log(`  ${sessionCount} historical sessions (30 days)`);
    console.log(`  ${activeCount} active charging sessions (right now)`);
    console.log(`  ${reservationCount + upcomingCount} reservations (completed + upcoming)`);
    console.log(`  ${historyCount} usage history records (prediction engine)`);
    console.log(`  ${reviewCount} station reviews`);

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

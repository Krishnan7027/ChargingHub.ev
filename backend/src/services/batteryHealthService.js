const db = require('../config/database');

/**
 * AI Battery Health Prediction Service
 *
 * Degradation model based on empirical EV battery research:
 *
 * 1. Cycle aging — each full equivalent cycle costs ~0.01–0.03% capacity
 *    depending on depth-of-discharge and charging speed.
 *
 * 2. Calendar aging — ~1.5% per year baseline at moderate temps,
 *    accelerated by high average SoC and temperature.
 *
 * 3. Stress factors:
 *    - Fast charging (DC fast / >50 kW): 1.6× cycle degradation
 *    - Deep discharge (<10% SoC start): 1.4× cycle degradation
 *    - Overcharging (>95% end SoC): 1.3× cycle degradation
 *    - High temperature (>35°C avg): 1.5× calendar + cycle degradation
 *    - Frequent charging (>2 sessions/day avg): 1.2× cycle degradation
 *
 * 4. Health estimation:
 *    health% = 100 - cycleDegradation - calendarDegradation
 *
 * 5. Prediction:
 *    annualRate = totalDegradation / ageYears
 *    yearsTo80% = (health - 80) / annualRate
 */

// ── Degradation constants ────────────────────────────────────────
const BASE_CYCLE_DEGRADATION_PCT = 0.015;   // % per full equivalent cycle
const BASE_CALENDAR_DEGRADATION_PCT_YEAR = 1.5; // % per year
const FAST_CHARGE_MULTIPLIER = 1.6;
const DEEP_DISCHARGE_MULTIPLIER = 1.4;
const OVERCHARGE_MULTIPLIER = 1.3;
const HIGH_TEMP_MULTIPLIER = 1.5;
const FREQUENT_CHARGING_MULTIPLIER = 1.2;

// ── Get or create a battery health profile ───────────────────────
async function getOrCreateProfile(userId, vehicleInfo = {}) {
  const { rows: existing } = await db.query(
    `SELECT * FROM battery_health_profiles WHERE user_id = $1`,
    [userId],
  );

  if (existing.length > 0) return existing[0];

  const capacity = vehicleInfo.batteryCapacityKwh || 60;
  const { rows: created } = await db.query(
    `INSERT INTO battery_health_profiles (user_id, vehicle_name, battery_capacity_kwh, original_capacity_kwh, manufacture_year)
     VALUES ($1, $2, $3, $3, $4)
     RETURNING *`,
    [userId, vehicleInfo.vehicleName || 'My EV', capacity, vehicleInfo.manufactureYear || null],
  );
  return created[0];
}

// ── Update profile with vehicle info ─────────────────────────────
async function updateProfile(userId, data) {
  const profile = await getOrCreateProfile(userId);

  const fields = [];
  const params = [profile.id];
  let idx = 2;

  if (data.vehicleName) { fields.push(`vehicle_name = $${idx++}`); params.push(data.vehicleName); }
  if (data.batteryCapacityKwh) {
    fields.push(`battery_capacity_kwh = $${idx++}`);
    params.push(data.batteryCapacityKwh);
    fields.push(`original_capacity_kwh = $${idx++}`);
    params.push(data.batteryCapacityKwh);
  }
  if (data.manufactureYear) { fields.push(`manufacture_year = $${idx++}`); params.push(data.manufactureYear); }

  if (fields.length === 0) return profile;

  const { rows } = await db.query(
    `UPDATE battery_health_profiles SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
    params,
  );
  return rows[0];
}

// ── Analyze all charging sessions and compute health ─────────────
async function analyzeHealth(userId) {
  const profile = await getOrCreateProfile(userId);
  const batteryKwh = Number(profile.original_capacity_kwh);

  // Fetch all completed sessions for this user
  const { rows: sessions } = await db.query(`
    SELECT
      cs.id, cs.start_percentage, cs.current_percentage, cs.target_percentage,
      cs.energy_delivered_kwh, cs.average_power_kw, cs.started_at, cs.completed_at,
      sl.charging_type, sl.power_output_kw,
      bdt.battery_temp_celsius, bdt.estimated_degradation_pct
    FROM charging_sessions cs
    JOIN charging_slots sl ON sl.id = cs.slot_id
    LEFT JOIN battery_digital_twins bdt ON bdt.session_id = cs.id
    WHERE cs.user_id = $1
      AND cs.status IN ('completed', 'charging')
    ORDER BY cs.started_at ASC
  `, [userId]);

  if (sessions.length === 0) {
    return formatHealthResponse(profile, [], []);
  }

  // ── Aggregate session data ───────────────────────────────────
  let totalEnergy = 0;
  let totalCycles = 0;
  let fastChargeSessions = 0;
  let normalChargeSessions = 0;
  let deepDischargeCount = 0;
  let overchargeCount = 0;
  let sumStartSoc = 0;
  let sumEndSoc = 0;
  let sumDoD = 0;
  let sumTemp = 0;
  let tempCount = 0;
  let sessionsPerDay = {};

  for (const sess of sessions) {
    const startSoc = Number(sess.start_percentage || 20);
    const endSoc = Number(sess.current_percentage || sess.target_percentage || 80);
    const energy = Number(sess.energy_delivered_kwh || 0);
    const powerKw = Number(sess.power_output_kw || sess.average_power_kw || 0);
    const chargingType = sess.charging_type || 'level2';
    const temp = sess.battery_temp_celsius ? Number(sess.battery_temp_celsius) : null;

    totalEnergy += energy;

    // Full equivalent cycle = energy / battery capacity
    const cycleEquiv = energy / batteryKwh;
    totalCycles += cycleEquiv;

    // Charging type classification
    const isFast = chargingType === 'dc_fast' || powerKw > 50;
    if (isFast) fastChargeSessions++;
    else normalChargeSessions++;

    // Depth of discharge
    const dod = endSoc - startSoc;
    sumDoD += dod;
    sumStartSoc += startSoc;
    sumEndSoc += endSoc;

    // Risk markers
    if (startSoc < 10) deepDischargeCount++;
    if (endSoc > 95) overchargeCount++;

    // Temperature tracking
    if (temp) { sumTemp += temp; tempCount++; }

    // Sessions per day
    if (sess.started_at) {
      const day = new Date(sess.started_at).toISOString().slice(0, 10);
      sessionsPerDay[day] = (sessionsPerDay[day] || 0) + 1;
    }
  }

  const totalSessions = sessions.length;
  const avgStartSoc = totalSessions > 0 ? sumStartSoc / totalSessions : 0;
  const avgEndSoc = totalSessions > 0 ? sumEndSoc / totalSessions : 0;
  const avgDoD = totalSessions > 0 ? sumDoD / totalSessions : 0;
  const avgTemp = tempCount > 0 ? sumTemp / tempCount : null;
  const fastChargePct = totalSessions > 0 ? (fastChargeSessions / totalSessions) * 100 : 0;

  // Average sessions per day
  const dayCount = Object.keys(sessionsPerDay).length || 1;
  const avgSessionsPerDay = totalSessions / dayCount;

  // ── Degradation calculation ──────────────────────────────────

  // 1. Cycle degradation
  let cycleDegFactor = 1.0;
  if (fastChargePct > 30) cycleDegFactor *= FAST_CHARGE_MULTIPLIER * (fastChargePct / 100) + (1 - fastChargePct / 100);
  if (deepDischargeCount > totalSessions * 0.1) cycleDegFactor *= DEEP_DISCHARGE_MULTIPLIER;
  if (overchargeCount > totalSessions * 0.1) cycleDegFactor *= OVERCHARGE_MULTIPLIER;
  if (avgTemp && avgTemp > 35) cycleDegFactor *= HIGH_TEMP_MULTIPLIER;
  if (avgSessionsPerDay > 2) cycleDegFactor *= FREQUENT_CHARGING_MULTIPLIER;

  const cycleDegradation = totalCycles * BASE_CYCLE_DEGRADATION_PCT * cycleDegFactor;

  // 2. Calendar degradation
  const firstSession = sessions[0]?.started_at ? new Date(sessions[0].started_at) : new Date();
  const lastSession = sessions[sessions.length - 1]?.started_at ? new Date(sessions[sessions.length - 1].started_at) : new Date();
  const calendarMonths = profile.manufacture_year
    ? Math.max(1, (Date.now() - new Date(profile.manufacture_year, 0, 1).getTime()) / (1000 * 60 * 60 * 24 * 30.44))
    : Math.max(1, (lastSession.getTime() - firstSession.getTime()) / (1000 * 60 * 60 * 24 * 30.44));

  const calendarYears = calendarMonths / 12;
  let calDegFactor = 1.0;
  if (avgTemp && avgTemp > 35) calDegFactor *= HIGH_TEMP_MULTIPLIER;
  if (avgEndSoc > 90) calDegFactor *= 1.2; // high avg SoC accelerates calendar aging

  const calendarDegradation = calendarYears * BASE_CALENDAR_DEGRADATION_PCT_YEAR * calDegFactor;

  // 3. Total health
  const totalDegradation = cycleDegradation + calendarDegradation;
  const healthPct = Math.max(0, Math.min(100, 100 - totalDegradation));

  // 4. Degradation rate and predictions
  const degradationRatePerYear = calendarYears > 0 ? totalDegradation / calendarYears : 0;
  const yearsTo80 = degradationRatePerYear > 0 && healthPct > 80
    ? (healthPct - 80) / degradationRatePerYear
    : null;

  // ── Generate recommendations ─────────────────────────────────
  const recommendations = generateRecommendations({
    fastChargePct, avgStartSoc, avgEndSoc, avgDoD, avgTemp,
    deepDischargeCount, overchargeCount, totalSessions,
    avgSessionsPerDay, healthPct, degradationRatePerYear,
  });

  // ── Update profile ───────────────────────────────────────────
  await db.query(`
    UPDATE battery_health_profiles SET
      health_pct = $2,
      total_cycles = $3,
      total_energy_throughput_kwh = $4,
      degradation_rate_pct_per_year = $5,
      estimated_years_to_80_pct = $6,
      calendar_age_months = $7,
      total_sessions = $8,
      fast_charge_sessions = $9,
      normal_charge_sessions = $10,
      avg_depth_of_discharge = $11,
      avg_start_soc = $12,
      avg_end_soc = $13,
      avg_session_temp_celsius = $14,
      deep_discharge_count = $15,
      overcharge_count = $16,
      last_session_at = $17
    WHERE id = $1
  `, [
    profile.id,
    healthPct.toFixed(2),
    totalCycles.toFixed(2),
    totalEnergy.toFixed(2),
    degradationRatePerYear.toFixed(3),
    yearsTo80,
    Math.round(calendarMonths),
    totalSessions,
    fastChargeSessions,
    normalChargeSessions,
    avgDoD.toFixed(2),
    avgStartSoc.toFixed(2),
    avgEndSoc.toFixed(2),
    avgTemp ? avgTemp.toFixed(1) : null,
    deepDischargeCount,
    overchargeCount,
    lastSession,
  ]);

  // ── Create health snapshot ───────────────────────────────────
  const riskScore = computeRiskScore({
    fastChargePct, deepDischargeCount, overchargeCount,
    totalSessions, avgTemp, degradationRatePerYear,
  });

  const today = new Date().toISOString().slice(0, 10);
  await db.query(`
    INSERT INTO battery_health_snapshots
      (profile_id, user_id, snapshot_date, health_pct, total_cycles,
       total_energy_kwh, degradation_rate, sessions_in_period,
       fast_charge_pct, avg_depth_of_discharge, avg_temp_celsius, risk_score)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    ON CONFLICT (profile_id, snapshot_date) DO UPDATE SET
      health_pct = EXCLUDED.health_pct,
      total_cycles = EXCLUDED.total_cycles,
      total_energy_kwh = EXCLUDED.total_energy_kwh,
      degradation_rate = EXCLUDED.degradation_rate,
      sessions_in_period = EXCLUDED.sessions_in_period,
      fast_charge_pct = EXCLUDED.fast_charge_pct,
      avg_depth_of_discharge = EXCLUDED.avg_depth_of_discharge,
      avg_temp_celsius = EXCLUDED.avg_temp_celsius,
      risk_score = EXCLUDED.risk_score
  `, [
    profile.id, userId, today, healthPct.toFixed(2), totalCycles.toFixed(2),
    totalEnergy.toFixed(2), degradationRatePerYear.toFixed(3), totalSessions,
    fastChargePct.toFixed(2), avgDoD.toFixed(2), avgTemp ? avgTemp.toFixed(1) : null,
    riskScore.toFixed(2),
  ]);

  // ── Persist recommendations ──────────────────────────────────
  // Deactivate old recommendations
  await db.query(
    `UPDATE battery_health_recommendations SET is_active = false WHERE profile_id = $1`,
    [profile.id],
  );

  for (const rec of recommendations) {
    await db.query(`
      INSERT INTO battery_health_recommendations
        (profile_id, user_id, category, severity, title, description, potential_health_impact_pct)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [profile.id, userId, rec.category, rec.severity, rec.title, rec.description, rec.impact]);
  }

  // ── Return formatted response ────────────────────────────────
  const updatedProfile = await db.query(
    `SELECT * FROM battery_health_profiles WHERE id = $1`, [profile.id],
  );
  const snapshots = await getHealthHistory(userId);
  const activeRecs = await getActiveRecommendations(userId);

  return formatHealthResponse(updatedProfile.rows[0], snapshots, activeRecs);
}

// ── Get health data without re-analyzing ─────────────────────────
async function getHealth(userId) {
  const { rows } = await db.query(
    `SELECT * FROM battery_health_profiles WHERE user_id = $1`,
    [userId],
  );
  if (rows.length === 0) return null;

  const snapshots = await getHealthHistory(userId);
  const recs = await getActiveRecommendations(userId);
  return formatHealthResponse(rows[0], snapshots, recs);
}

// ── Get health history snapshots ─────────────────────────────────
async function getHealthHistory(userId, limit = 90) {
  const { rows } = await db.query(`
    SELECT * FROM battery_health_snapshots
    WHERE user_id = $1
    ORDER BY snapshot_date DESC
    LIMIT $2
  `, [userId, limit]);
  return rows;
}

// ── Get active recommendations ───────────────────────────────────
async function getActiveRecommendations(userId) {
  const { rows } = await db.query(`
    SELECT * FROM battery_health_recommendations
    WHERE user_id = $1 AND is_active = true
    ORDER BY
      CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
      created_at DESC
  `, [userId]);
  return rows;
}

// ── Dismiss a recommendation ─────────────────────────────────────
async function dismissRecommendation(recId, userId) {
  const { rows } = await db.query(`
    UPDATE battery_health_recommendations
    SET is_active = false, dismissed_at = NOW()
    WHERE id = $1 AND user_id = $2
    RETURNING *
  `, [recId, userId]);
  if (rows.length === 0) throw new Error('Recommendation not found');
  return rows[0];
}

// ── Recommendation generation engine ─────────────────────────────
function generateRecommendations({ fastChargePct, avgStartSoc, avgEndSoc, avgDoD, avgTemp,
  deepDischargeCount, overchargeCount, totalSessions, avgSessionsPerDay, healthPct, degradationRatePerYear }) {

  const recs = [];

  // Fast charging frequency
  if (fastChargePct > 50) {
    recs.push({
      category: 'charging_speed',
      severity: 'warning',
      title: 'Reduce DC fast charging frequency',
      description: `${fastChargePct.toFixed(0)}% of your sessions use DC fast charging. Fast charging generates more heat and accelerates battery degradation. Try to use Level 2 charging for daily needs and reserve DC fast for road trips.`,
      impact: Math.min(fastChargePct * 0.03, 2.0),
    });
  } else if (fastChargePct > 30) {
    recs.push({
      category: 'charging_speed',
      severity: 'info',
      title: 'Monitor fast charging usage',
      description: `${fastChargePct.toFixed(0)}% of your sessions use DC fast charging. This is moderate — keeping it below 30% is ideal for long-term battery health.`,
      impact: 0.5,
    });
  }

  // Depth of discharge
  if (avgStartSoc < 15) {
    recs.push({
      category: 'depth_of_discharge',
      severity: 'warning',
      title: 'Avoid letting battery drop below 15%',
      description: `Your average starting charge is ${avgStartSoc.toFixed(0)}%. Deep discharges stress battery cells. Try to plug in when you reach 20% to extend battery life.`,
      impact: 1.5,
    });
  }

  if (avgEndSoc > 90) {
    recs.push({
      category: 'depth_of_discharge',
      severity: 'warning',
      title: 'Avoid charging above 90% regularly',
      description: `Your average ending charge is ${avgEndSoc.toFixed(0)}%. Keeping the battery between 20-80% for daily use significantly reduces calendar aging and cycle stress.`,
      impact: 1.2,
    });
  }

  // Optimal range recommendation
  if (avgStartSoc < 20 || avgEndSoc > 85) {
    recs.push({
      category: 'depth_of_discharge',
      severity: 'info',
      title: 'Maintain charge between 20% and 80%',
      description: 'The 20-80% range is the sweet spot for lithium-ion batteries. Staying within this range minimizes both cycle and calendar degradation, potentially extending battery life by 2-3 years.',
      impact: 1.0,
    });
  }

  // Deep discharges
  if (deepDischargeCount > 3) {
    recs.push({
      category: 'depth_of_discharge',
      severity: deepDischargeCount > 10 ? 'critical' : 'warning',
      title: `${deepDischargeCount} deep discharge events detected`,
      description: `You've started ${deepDischargeCount} charging sessions below 10% SoC. Each deep discharge event causes above-average cell stress. Set up a low-battery reminder to charge before reaching 15%.`,
      impact: Math.min(deepDischargeCount * 0.15, 2.5),
    });
  }

  // Overcharging
  if (overchargeCount > 3) {
    recs.push({
      category: 'depth_of_discharge',
      severity: overchargeCount > 10 ? 'warning' : 'info',
      title: `${overchargeCount} overcharge events detected`,
      description: `You've charged to above 95% in ${overchargeCount} sessions. High state-of-charge accelerates calendar aging. Set your vehicle's charge limit to 80% for daily driving.`,
      impact: Math.min(overchargeCount * 0.1, 1.5),
    });
  }

  // Temperature
  if (avgTemp && avgTemp > 35) {
    recs.push({
      category: 'temperature',
      severity: 'warning',
      title: 'High average charging temperature',
      description: `Your average charging temperature is ${avgTemp.toFixed(1)}°C. High temperatures accelerate both cycle and calendar degradation. When possible, charge in shaded areas or during cooler hours.`,
      impact: 2.0,
    });
  } else if (avgTemp && avgTemp > 30) {
    recs.push({
      category: 'temperature',
      severity: 'info',
      title: 'Prefer charging during cooler hours',
      description: `Your average charging temperature is ${avgTemp.toFixed(1)}°C. Charging during early morning or evening can reduce thermal stress on the battery.`,
      impact: 0.5,
    });
  }

  // Frequency
  if (avgSessionsPerDay > 2) {
    recs.push({
      category: 'schedule',
      severity: 'info',
      title: 'Consider fewer, longer charging sessions',
      description: `You average ${avgSessionsPerDay.toFixed(1)} sessions per day. Consolidating into fewer sessions reduces the total number of charge cycles and associated wear.`,
      impact: 0.8,
    });
  }

  // Health-based urgency
  if (healthPct < 85) {
    recs.push({
      category: 'general',
      severity: 'critical',
      title: 'Battery health below 85% — consider service check',
      description: `Your estimated battery health is ${healthPct.toFixed(1)}%. This is below the typical threshold. Consider having your battery inspected by a service center.`,
      impact: 0,
    });
  } else if (healthPct < 90) {
    recs.push({
      category: 'general',
      severity: 'warning',
      title: 'Battery health declining — optimize charging habits',
      description: `Your estimated battery health is ${healthPct.toFixed(1)}% with a degradation rate of ${degradationRatePerYear.toFixed(1)}% per year. Following the recommendations above can slow further degradation.`,
      impact: 0,
    });
  }

  // Positive reinforcement
  if (healthPct >= 95 && totalSessions > 10) {
    recs.push({
      category: 'general',
      severity: 'info',
      title: 'Excellent battery health!',
      description: `Your battery is at ${healthPct.toFixed(1)}% health. Your charging habits are helping preserve battery longevity. Keep it up!`,
      impact: 0,
    });
  }

  return recs;
}

// ── Risk score computation ───────────────────────────────────────
function computeRiskScore({ fastChargePct, deepDischargeCount, overchargeCount,
  totalSessions, avgTemp, degradationRatePerYear }) {
  let score = 0;

  // Fast charge risk (0-25 points)
  score += Math.min(25, fastChargePct * 0.5);

  // Deep discharge risk (0-20 points)
  const deepPct = totalSessions > 0 ? (deepDischargeCount / totalSessions) * 100 : 0;
  score += Math.min(20, deepPct * 2);

  // Overcharge risk (0-15 points)
  const overPct = totalSessions > 0 ? (overchargeCount / totalSessions) * 100 : 0;
  score += Math.min(15, overPct * 1.5);

  // Temperature risk (0-20 points)
  if (avgTemp) {
    score += avgTemp > 40 ? 20 : avgTemp > 35 ? 15 : avgTemp > 30 ? 8 : 0;
  }

  // Degradation rate risk (0-20 points)
  score += Math.min(20, degradationRatePerYear * 5);

  return Math.min(100, score);
}

// ── Format response ──────────────────────────────────────────────
function formatHealthResponse(profile, snapshots, recommendations) {
  if (!profile) {
    return {
      profile: null,
      healthHistory: [],
      recommendations: [],
      chargingPatterns: null,
    };
  }

  return {
    profile: {
      id: profile.id,
      vehicleName: profile.vehicle_name,
      batteryCapacityKwh: Number(profile.battery_capacity_kwh),
      originalCapacityKwh: Number(profile.original_capacity_kwh),
      manufactureYear: profile.manufacture_year,
      healthPct: Number(profile.health_pct),
      estimatedRangeKm: profile.estimated_range_km ? Number(profile.estimated_range_km) : null,
      totalCycles: Number(profile.total_cycles),
      totalEnergyThroughputKwh: Number(profile.total_energy_throughput_kwh),
      degradationRatePctPerYear: Number(profile.degradation_rate_pct_per_year),
      estimatedYearsTo80Pct: profile.estimated_years_to_80_pct ? Number(profile.estimated_years_to_80_pct) : null,
      calendarAgeMonths: profile.calendar_age_months,
    },
    chargingPatterns: {
      totalSessions: profile.total_sessions,
      fastChargeSessions: profile.fast_charge_sessions,
      normalChargeSessions: profile.normal_charge_sessions,
      fastChargePct: profile.total_sessions > 0 ? (profile.fast_charge_sessions / profile.total_sessions * 100) : 0,
      avgDepthOfDischarge: Number(profile.avg_depth_of_discharge),
      avgStartSoc: Number(profile.avg_start_soc),
      avgEndSoc: Number(profile.avg_end_soc),
      avgSessionTempCelsius: profile.avg_session_temp_celsius ? Number(profile.avg_session_temp_celsius) : null,
      deepDischargeCount: profile.deep_discharge_count,
      overchargeCount: profile.overcharge_count,
      lastSessionAt: profile.last_session_at,
    },
    healthHistory: snapshots.map(s => ({
      date: s.snapshot_date,
      healthPct: Number(s.health_pct),
      totalCycles: Number(s.total_cycles),
      degradationRate: Number(s.degradation_rate),
      riskScore: Number(s.risk_score),
      fastChargePct: Number(s.fast_charge_pct),
    })),
    recommendations: recommendations.map(r => ({
      id: r.id,
      category: r.category,
      severity: r.severity,
      title: r.title,
      description: r.description,
      potentialHealthImpactPct: Number(r.potential_health_impact_pct),
      createdAt: r.created_at,
    })),
  };
}

module.exports = {
  getOrCreateProfile,
  updateProfile,
  analyzeHealth,
  getHealth,
  getHealthHistory,
  getActiveRecommendations,
  dismissRecommendation,
};

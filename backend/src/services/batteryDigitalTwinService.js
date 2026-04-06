const db = require('../config/database');

/**
 * Battery Digital Twin Simulation Service
 *
 * Simulates battery charging behavior in real-time using a multi-segment
 * charging curve model with thermal and degradation effects.
 *
 * Charging curve efficiency tiers:
 *   0–20%  → 90% (cold battery ramp-up)
 *   20–60% → 95% (optimal bulk charging)
 *   60–80% → 85% (taper begins)
 *   80–90% → 55% (heavy taper)
 *   90–100%→ 35% (trickle / CV phase)
 *
 * Thermal model:
 *   Battery temp rises ~0.3°C/min during fast charging, capped at 45°C.
 *   Above 40°C, power is derated by 2% per degree above threshold.
 *
 * Degradation model:
 *   Each full equivalent cycle costs ~0.02% capacity.
 *   Fast charging (>100 kW) adds 1.5x degradation factor.
 *   High temperature (>35°C) adds 1.3x degradation factor.
 */

// ── Charging curve efficiency by SoC range ────────────────────
function getEfficiency(soc) {
  if (soc < 20) return 0.90;
  if (soc < 60) return 0.95;
  if (soc < 80) return 0.85;
  if (soc < 90) return 0.55;
  return 0.35;
}

// ── Thermal derating factor ───────────────────────────────────
function getThermalDerate(tempC) {
  if (tempC <= 40) return 1.0;
  return Math.max(0.5, 1.0 - (tempC - 40) * 0.02);
}

// ── Create or get digital twin for a charging session ─────────
async function getOrCreateTwin(sessionId) {
  // Check for existing active twin
  const { rows: existing } = await db.query(
    `SELECT * FROM battery_digital_twins WHERE session_id = $1 AND is_active = true`,
    [sessionId],
  );
  if (existing.length > 0) return existing[0];

  // Get session data
  const { rows: sessions } = await db.query(
    `SELECT cs.*, ck.power_output_kw, ck.id as slot_id
     FROM charging_sessions cs
     JOIN charging_slots ck ON ck.id = cs.slot_id
     WHERE cs.id = $1`,
    [sessionId],
  );
  if (sessions.length === 0) return null;

  const sess = sessions[0];
  const batteryKwh = Number(sess.vehicle_battery_capacity_kwh) || 60;
  const startSoc = Number(sess.start_percentage) || Number(sess.current_percentage) || 20;
  const targetSoc = Number(sess.target_percentage) || 80;
  const maxPower = Number(sess.power_output_kw) || 50;

  const { rows: created } = await db.query(
    `INSERT INTO battery_digital_twins
       (session_id, slot_id, current_soc, target_soc, battery_capacity_kwh,
        max_power_kw, current_power_kw, battery_health_pct)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 100)
     RETURNING *`,
    [sessionId, sess.slot_id, startSoc, targetSoc, batteryKwh, maxPower,
     maxPower * getEfficiency(startSoc)],
  );
  return created[0];
}

// ── Simulate one step (called periodically or on-demand) ──────
async function simulateStep(sessionId) {
  const twin = await getOrCreateTwin(sessionId);
  if (!twin) return null;

  const soc = Number(twin.current_soc);
  const targetSoc = Number(twin.target_soc);
  const batteryKwh = Number(twin.battery_capacity_kwh);
  const maxPower = Number(twin.max_power_kw);
  let temp = Number(twin.battery_temp_celsius);
  const ambientTemp = Number(twin.ambient_temp_celsius);
  let health = Number(twin.battery_health_pct);
  let cycleCount = twin.cycle_count;
  let degradation = Number(twin.estimated_degradation_pct);
  const step = twin.simulation_step + 1;

  if (soc >= targetSoc) {
    // Charging complete
    await db.query(
      `UPDATE battery_digital_twins
       SET is_active = false, current_power_kw = 0, simulation_step = $2, updated_at = NOW()
       WHERE id = $1`,
      [twin.id, step],
    );
    return getTwinState(twin.id);
  }

  // 1. Calculate effective power
  const efficiency = getEfficiency(soc);
  const thermalDerate = getThermalDerate(temp);
  const effectivePower = maxPower * efficiency * thermalDerate * (health / 100);

  // 2. Energy delivered in this step (assume 1-minute steps)
  const stepMinutes = 1;
  const energyKwh = (effectivePower * stepMinutes) / 60;
  const socGain = (energyKwh / batteryKwh) * 100;
  const newSoc = Math.min(soc + socGain, targetSoc);

  // 3. Thermal model: temp rises during charging, cools toward ambient
  const heatGain = effectivePower > 50 ? 0.3 : 0.15; // °C/min
  const cooling = (temp - ambientTemp) * 0.05;         // natural cooling
  temp = Math.min(45, Math.max(ambientTemp, temp + heatGain - cooling));

  // 4. Degradation model
  const cycleEquiv = energyKwh / batteryKwh; // fraction of a full cycle
  let degradeFactor = 1.0;
  if (effectivePower > 100) degradeFactor *= 1.5;     // fast charging stress
  if (temp > 35) degradeFactor *= 1.3;                // thermal stress
  const stepDegradation = cycleEquiv * 0.02 * degradeFactor; // % capacity loss
  degradation += stepDegradation;
  health = Math.max(0, 100 - degradation);
  cycleCount += cycleEquiv > 0.01 ? 1 : 0;

  // 5. Estimate remaining time
  let minutesRemaining = 0;
  let simSoc = newSoc;
  while (simSoc < targetSoc) {
    const simEff = getEfficiency(simSoc);
    const simPower = maxPower * simEff * getThermalDerate(temp) * (health / 100);
    const simEnergy = (simPower * 1) / 60;
    simSoc += (simEnergy / batteryKwh) * 100;
    minutesRemaining += 1;
    if (minutesRemaining > 600) break; // safety cap at 10 hours
  }

  const totalEnergyEstimate = ((targetSoc - Number(twin.current_soc)) / 100) * batteryKwh;
  const completionTime = new Date(Date.now() + minutesRemaining * 60000);

  // 6. Update twin state
  await db.query(
    `UPDATE battery_digital_twins SET
       current_soc = $2, battery_temp_celsius = $3, current_power_kw = $4,
       charging_efficiency = $5, battery_health_pct = $6, cycle_count = $7,
       estimated_degradation_pct = $8, estimated_minutes_remaining = $9,
       estimated_completion_time = $10, estimated_energy_total_kwh = $11,
       simulation_step = $12, updated_at = NOW()
     WHERE id = $1`,
    [twin.id, newSoc.toFixed(2), temp.toFixed(1), effectivePower.toFixed(2),
     efficiency.toFixed(3), health.toFixed(2), cycleCount,
     degradation.toFixed(3), minutesRemaining, completionTime.toISOString(),
     totalEnergyEstimate.toFixed(2), step],
  );

  return getTwinState(twin.id);
}

// ── Get current twin state (formatted) ────────────────────────
async function getTwinState(twinId) {
  const { rows } = await db.query(
    `SELECT bdt.*, cs.started_at, cs.energy_delivered_kwh
     FROM battery_digital_twins bdt
     JOIN charging_sessions cs ON cs.id = bdt.session_id
     WHERE bdt.id = $1`,
    [twinId],
  );
  if (rows.length === 0) return null;
  const t = rows[0];

  return {
    id: t.id,
    sessionId: t.session_id,
    slotId: t.slot_id,
    battery: {
      currentSoc: Number(t.current_soc),
      targetSoc: Number(t.target_soc),
      capacityKwh: Number(t.battery_capacity_kwh),
      healthPct: Number(t.battery_health_pct),
      cycleCount: t.cycle_count,
      degradationPct: Number(t.estimated_degradation_pct),
    },
    charging: {
      currentPowerKw: Number(t.current_power_kw),
      maxPowerKw: Number(t.max_power_kw),
      efficiency: Number(t.charging_efficiency),
      energyDeliveredKwh: Number(t.energy_delivered_kwh || 0),
      estimatedTotalKwh: Number(t.estimated_energy_total_kwh || 0),
    },
    thermal: {
      batteryTempCelsius: Number(t.battery_temp_celsius),
      ambientTempCelsius: Number(t.ambient_temp_celsius),
      thermalStatus: Number(t.battery_temp_celsius) > 40 ? 'derated'
        : Number(t.battery_temp_celsius) > 35 ? 'warm' : 'normal',
    },
    prediction: {
      minutesRemaining: Number(t.estimated_minutes_remaining || 0),
      estimatedCompletionTime: t.estimated_completion_time,
    },
    simulationStep: t.simulation_step,
    isActive: t.is_active,
    updatedAt: t.updated_at,
  };
}

// ── Get twin by session ID ────────────────────────────────────
async function getTwinBySession(sessionId) {
  const { rows } = await db.query(
    `SELECT id FROM battery_digital_twins WHERE session_id = $1 AND is_active = true`,
    [sessionId],
  );
  if (rows.length === 0) {
    // Auto-create if session is active
    const twin = await getOrCreateTwin(sessionId);
    if (!twin) return null;
    return getTwinState(twin.id);
  }
  return getTwinState(rows[0].id);
}

// ── Get all active twins for a station ────────────────────────
async function getStationTwins(stationId) {
  const { rows } = await db.query(
    `SELECT bdt.id
     FROM battery_digital_twins bdt
     JOIN charging_slots ck ON ck.id = bdt.slot_id
     WHERE ck.station_id = $1 AND bdt.is_active = true`,
    [stationId],
  );
  const twins = [];
  for (const r of rows) {
    const state = await getTwinState(r.id);
    if (state) twins.push(state);
  }
  return twins;
}

// ── Deactivate twin when session ends ─────────────────────────
async function deactivateTwin(sessionId) {
  await db.query(
    `UPDATE battery_digital_twins SET is_active = false, current_power_kw = 0, updated_at = NOW()
     WHERE session_id = $1 AND is_active = true`,
    [sessionId],
  );
}

module.exports = {
  getOrCreateTwin,
  simulateStep,
  getTwinBySession,
  getStationTwins,
  deactivateTwin,
};

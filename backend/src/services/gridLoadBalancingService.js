const db = require('../config/database');

/**
 * Smart Grid Load Balancing Service
 *
 * Monitors real-time energy consumption per station, calculates grid load,
 * and provides power allocation recommendations to prevent grid overload.
 *
 * Grid status levels:
 *   normal   — load <70%: all slots run at full power
 *   warning  — 70–90%: suggest slower charging for new sessions
 *   critical — 90–100%: enforce power caps, defer non-urgent charging
 *   emergency— >100%: reduce all slots to minimum viable power
 *
 * Power allocation strategy (when load balancing active):
 *   1. Priority: sessions close to completion (>80% SoC) get reduced power first
 *   2. New sessions get limited power until load drops
 *   3. Slots with reservations ending soon maintain priority
 */

// ── Get or initialize grid load profile for a station ─────────
async function getOrCreateProfile(stationId) {
  const { rows: existing } = await db.query(
    `SELECT * FROM grid_load_profiles WHERE station_id = $1`,
    [stationId],
  );
  if (existing.length > 0) return existing[0];

  // Calculate default grid capacity from station slots
  const { rows: slots } = await db.query(
    `SELECT SUM(power_output_kw)::numeric(10,2) AS total_power, COUNT(*)::int AS total_slots
     FROM charging_slots WHERE station_id = $1`,
    [stationId],
  );
  const totalPower = Number(slots[0]?.total_power || 500);
  // Grid capacity is typically 1.2x total slot power (some headroom)
  const gridCapacity = Math.round(totalPower * 1.2);

  const { rows: created } = await db.query(
    `INSERT INTO grid_load_profiles (station_id, grid_capacity_kw)
     VALUES ($1, $2) RETURNING *`,
    [stationId, gridCapacity],
  );
  return created[0];
}

// ── Calculate current grid load from active sessions ──────────
async function calculateCurrentLoad(stationId) {
  const profile = await getOrCreateProfile(stationId);

  // Sum power draw from all active charging sessions
  const { rows: activeSlots } = await db.query(
    `SELECT ck.id AS slot_id, ck.slot_number, ck.power_output_kw, ck.status,
            cs.id AS session_id, cs.current_percentage, cs.target_percentage,
            cs.average_power_kw
     FROM charging_slots ck
     LEFT JOIN charging_sessions cs ON cs.slot_id = ck.id AND cs.status = 'charging'
     WHERE ck.station_id = $1
     ORDER BY ck.slot_number`,
    [stationId],
  );

  let currentLoad = 0;
  const slotAllocations = [];

  for (const slot of activeSlots) {
    const isCharging = !!slot.session_id;
    const powerDraw = isCharging
      ? Number(slot.average_power_kw || slot.power_output_kw)
      : 0;
    currentLoad += powerDraw;

    slotAllocations.push({
      slotId: slot.slot_id,
      slotNumber: slot.slot_number,
      maxPowerKw: Number(slot.power_output_kw),
      currentPowerKw: powerDraw,
      isCharging,
      currentSoc: isCharging ? Number(slot.current_percentage) : null,
      targetSoc: isCharging ? Number(slot.target_percentage) : null,
      sessionId: slot.session_id,
    });
  }

  const gridCapacity = Number(profile.grid_capacity_kw);
  const loadPercentage = (currentLoad / gridCapacity) * 100;
  const warningThreshold = Number(profile.warning_threshold_pct);
  const criticalThreshold = Number(profile.critical_threshold_pct);

  let gridStatus;
  if (loadPercentage > 100) gridStatus = 'emergency';
  else if (loadPercentage >= criticalThreshold) gridStatus = 'critical';
  else if (loadPercentage >= warningThreshold) gridStatus = 'warning';
  else gridStatus = 'normal';

  const loadBalancingActive = gridStatus !== 'normal';

  // Apply load balancing if needed
  let recommendations = [];
  if (loadBalancingActive) {
    recommendations = generateLoadBalancingRecommendations(
      slotAllocations, gridCapacity, currentLoad, gridStatus,
    );
  }

  // Update profile in database
  const peakLoad = Math.max(Number(profile.peak_load_kw), currentLoad);
  await db.query(
    `UPDATE grid_load_profiles SET
       current_load_kw = $2, load_percentage = $3, grid_status = $4,
       load_balancing_active = $5, slot_allocations = $6,
       peak_load_kw = $7, updated_at = NOW()
     WHERE station_id = $1`,
    [stationId, currentLoad.toFixed(2), loadPercentage.toFixed(2),
     gridStatus, loadBalancingActive, JSON.stringify(slotAllocations),
     peakLoad.toFixed(2)],
  );

  return {
    stationId,
    grid: {
      capacityKw: gridCapacity,
      currentLoadKw: Math.round(currentLoad * 100) / 100,
      loadPercentage: Math.round(loadPercentage * 10) / 10,
      status: gridStatus,
      loadBalancingActive,
      peakLoadKw: Math.round(peakLoad * 100) / 100,
      warningThresholdPct: warningThreshold,
      criticalThresholdPct: criticalThreshold,
    },
    slots: slotAllocations,
    recommendations,
    message: gridStatus === 'normal'
      ? 'Grid operating normally'
      : `Grid status: ${gridStatus}. Load balancing ${loadBalancingActive ? 'active' : 'standby'}.`,
  };
}

// ── Generate power allocation recommendations ─────────────────
function generateLoadBalancingRecommendations(slots, gridCapacity, currentLoad, status) {
  const recs = [];
  const overloadKw = currentLoad - gridCapacity * 0.85; // target 85% load

  if (overloadKw <= 0) return recs;

  // Sort charging slots by SoC descending (nearly-done sessions get reduced first)
  const chargingSlots = slots
    .filter((s) => s.isCharging)
    .sort((a, b) => (b.currentSoc || 0) - (a.currentSoc || 0));

  let reductionNeeded = overloadKw;

  for (const slot of chargingSlots) {
    if (reductionNeeded <= 0) break;

    const currentPower = slot.currentPowerKw;
    const soc = slot.currentSoc || 0;

    // How much can we reduce this slot?
    let minPower;
    if (status === 'emergency') {
      minPower = Math.max(currentPower * 0.3, 3.7); // minimum 3.7 kW (Level 1)
    } else if (status === 'critical') {
      minPower = Math.max(currentPower * 0.5, 7.4); // minimum 7.4 kW (Level 2)
    } else {
      minPower = currentPower * 0.7;
    }

    const reduction = currentPower - minPower;
    if (reduction > 0) {
      recs.push({
        slotId: slot.slotId,
        slotNumber: slot.slotNumber,
        action: 'reduce_power',
        currentPowerKw: currentPower,
        recommendedPowerKw: Math.round(minPower * 10) / 10,
        reductionKw: Math.round(reduction * 10) / 10,
        reason: soc >= 80
          ? `Session at ${soc}% SoC — near completion, reduced impact from power cut`
          : `Load balancing: reducing from ${currentPower}kW to ${minPower.toFixed(1)}kW`,
        priority: soc >= 80 ? 'low' : 'medium',
      });
      reductionNeeded -= reduction;
    }
  }

  if (status === 'emergency' || status === 'critical') {
    recs.push({
      action: 'defer_new_sessions',
      reason: `Grid at ${status} level — recommend deferring new fast-charging sessions`,
      priority: 'high',
    });
  }

  return recs;
}

// ── Get grid load profile ─────────────────────────────────────
async function getGridProfile(stationId) {
  return calculateCurrentLoad(stationId);
}

// ── Update grid capacity settings ─────────────────────────────
async function updateGridSettings(stationId, settings) {
  const profile = await getOrCreateProfile(stationId);
  const updates = {};
  if (settings.gridCapacityKw !== undefined) updates.grid_capacity_kw = settings.gridCapacityKw;
  if (settings.warningThresholdPct !== undefined) updates.warning_threshold_pct = settings.warningThresholdPct;
  if (settings.criticalThresholdPct !== undefined) updates.critical_threshold_pct = settings.criticalThresholdPct;

  const setClauses = Object.entries(updates)
    .map(([key], i) => `${key} = $${i + 2}`)
    .join(', ');
  const values = Object.values(updates);

  if (setClauses) {
    await db.query(
      `UPDATE grid_load_profiles SET ${setClauses}, updated_at = NOW() WHERE station_id = $1`,
      [stationId, ...values],
    );
  }

  return calculateCurrentLoad(stationId);
}

module.exports = { calculateCurrentLoad, getGridProfile, updateGridSettings };

const db = require('../config/database');
const crypto = require('crypto');

/**
 * Gamification & Rewards Service
 *
 * Points economy:
 *   - Off-peak charging:     +20 pts/session (hours 22-06)
 *   - Green energy station:  +30 pts/session (renewable_percentage > 50%)
 *   - Energy sharing:        +15 pts/event
 *   - Writing a review:      +10 pts
 *   - Daily streak bonus:    +5 pts × streak_days (capped at +50)
 *   - Achievement unlock:    badge-specific bonus points
 *
 * Levels: every 500 lifetime points = +1 level
 *   1: Starter (0),  2: Explorer (500), 3: Regular (1000),
 *   4: Advocate (2000), 5: Champion (4000), 6: Legend (8000)
 *
 * Badge criteria are evaluated after every point-earning event.
 * Rewards are redeemed from the catalog and generate a unique code.
 */

const LEVEL_THRESHOLDS = [
  { level: 1, name: 'Starter',   min: 0 },
  { level: 2, name: 'Explorer',  min: 500 },
  { level: 3, name: 'Regular',   min: 1000 },
  { level: 4, name: 'Advocate',  min: 2000 },
  { level: 5, name: 'Champion',  min: 4000 },
  { level: 6, name: 'Legend',    min: 8000 },
];

const POINTS = {
  offPeak: 20,
  greenEnergy: 30,
  energySharing: 15,
  review: 10,
  streakMultiplier: 5,  // × streak_days, capped at 50
  streakCap: 50,
};

// ── Wallet CRUD ─────────────────────────────────────────────────

async function getOrCreateWallet(userId) {
  const { rows } = await db.query(
    'SELECT * FROM user_points WHERE user_id = $1', [userId],
  );
  if (rows[0]) return rows[0];
  const { rows: created } = await db.query(
    'INSERT INTO user_points (user_id) VALUES ($1) RETURNING *', [userId],
  );
  return created[0];
}

async function getWalletSummary(userId) {
  const wallet = await getOrCreateWallet(userId);

  // Earned badges
  const { rows: badges } = await db.query(
    `SELECT ub.earned_at, ub.is_featured, b.*
     FROM user_badges ub
     JOIN badges b ON b.id = ub.badge_id
     WHERE ub.user_id = $1
     ORDER BY ub.earned_at DESC`,
    [userId],
  );

  // Active redemptions
  const { rows: redemptions } = await db.query(
    `SELECT rr.*, r.name AS reward_name, r.description AS reward_description,
            r.category AS reward_category, r.discount_pct
     FROM reward_redemptions rr
     JOIN rewards r ON r.id = rr.reward_id
     WHERE rr.user_id = $1 AND rr.status = 'active'
     ORDER BY rr.expires_at ASC`,
    [userId],
  );

  // Recent transactions
  const { rows: recentTx } = await db.query(
    `SELECT * FROM points_transactions
     WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
    [userId],
  );

  // Next level info
  const currentLevel = LEVEL_THRESHOLDS.find((l) => l.level === wallet.level) || LEVEL_THRESHOLDS[0];
  const nextLevel = LEVEL_THRESHOLDS.find((l) => l.level === wallet.level + 1);
  const lifetimePts = parseInt(wallet.lifetime_points, 10);

  return {
    wallet: formatWallet(wallet),
    level: {
      current: currentLevel,
      next: nextLevel || null,
      progressPct: nextLevel
        ? Math.round(((lifetimePts - currentLevel.min) / (nextLevel.min - currentLevel.min)) * 100)
        : 100,
    },
    badges: badges.map(formatBadge),
    activeRedemptions: redemptions.map(formatRedemption),
    recentTransactions: recentTx.map(formatTransaction),
  };
}

// ── Award Points ────────────────────────────────────────────────

async function awardPoints(userId, { points, type, description, referenceId, referenceType, metadata }) {
  const wallet = await getOrCreateWallet(userId);
  const currentBalance = parseInt(wallet.total_points, 10);
  const newBalance = currentBalance + points;
  const newLifetime = parseInt(wallet.lifetime_points, 10) + points;

  // Record transaction
  await db.query(
    `INSERT INTO points_transactions
       (user_id, points, balance_after, transaction_type, description,
        reference_id, reference_type, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [userId, points, newBalance, type, description,
     referenceId || null, referenceType || null, JSON.stringify(metadata || {})],
  );

  // Update wallet
  const newLevel = computeLevel(newLifetime);
  await db.query(
    `UPDATE user_points SET
       total_points = $2, lifetime_points = $3,
       level = $4, level_name = $5,
       last_activity_at = NOW(), updated_at = NOW()
     WHERE user_id = $1`,
    [userId, newBalance, newLifetime, newLevel.level, newLevel.name],
  );

  // Check badges
  await evaluateBadges(userId);

  return { points, newBalance, newLifetime, level: newLevel };
}

// ── Session-Based Point Awards ──────────────────────────────────

async function awardSessionPoints(userId, sessionId) {
  // Fetch session details
  const { rows: [session] } = await db.query(
    `SELECT cs.*, ck.station_id, ck.charging_type, ck.power_output_kw,
            s.name AS station_name
     FROM charging_sessions cs
     JOIN charging_slots ck ON ck.id = cs.slot_id
     JOIN stations s ON s.id = ck.station_id
     WHERE cs.id = $1 AND cs.user_id = $2`,
    [sessionId, userId],
  );
  if (!session) return { awarded: false, reason: 'Session not found' };

  // Check if already rewarded
  const { rows: existing } = await db.query(
    `SELECT id FROM points_transactions
     WHERE user_id = $1 AND reference_id = $2 AND reference_type = 'session'`,
    [userId, sessionId],
  );
  if (existing.length > 0) return { awarded: false, reason: 'Already rewarded' };

  let totalPoints = 0;
  const awards = [];

  // 1. Off-peak bonus: sessions started between 22:00 and 06:00
  const startHour = new Date(session.started_at).getHours();
  const isOffPeak = startHour >= 22 || startHour < 6;
  if (isOffPeak) {
    totalPoints += POINTS.offPeak;
    awards.push(`Off-peak charging: +${POINTS.offPeak}`);
    await incrementStat(userId, 'total_off_peak_sessions');
  }

  // 2. Green energy bonus: check carbon footprint data
  const { rows: [carbon] } = await db.query(
    `SELECT renewable_percentage FROM carbon_footprint_records
     WHERE session_id = $1 LIMIT 1`,
    [sessionId],
  ).catch(() => ({ rows: [] }));

  const isGreen = carbon && parseFloat(carbon?.renewable_percentage || 0) > 50;
  if (isGreen) {
    totalPoints += POINTS.greenEnergy;
    awards.push(`Green energy station: +${POINTS.greenEnergy}`);
    await incrementStat(userId, 'total_green_sessions');
  }

  // 3. Streak bonus
  const wallet = await getOrCreateWallet(userId);
  const streak = parseInt(wallet.current_streak_days, 10) || 0;
  const lastActivity = wallet.last_activity_at ? new Date(wallet.last_activity_at) : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let newStreak = streak;
  if (lastActivity) {
    const lastDay = new Date(lastActivity);
    lastDay.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today.getTime() - lastDay.getTime()) / 86400000);
    if (diffDays === 1) newStreak = streak + 1;
    else if (diffDays > 1) newStreak = 1;
    // same day: keep streak
  } else {
    newStreak = 1;
  }

  const streakBonus = Math.min(newStreak * POINTS.streakMultiplier, POINTS.streakCap);
  if (streakBonus > 0) {
    totalPoints += streakBonus;
    awards.push(`Streak bonus (${newStreak} days): +${streakBonus}`);
  }

  // Update streak
  const longestStreak = Math.max(parseInt(wallet.longest_streak_days, 10) || 0, newStreak);
  await db.query(
    `UPDATE user_points SET
       current_streak_days = $2, longest_streak_days = $3,
       total_sessions_rewarded = total_sessions_rewarded + 1
     WHERE user_id = $1`,
    [userId, newStreak, longestStreak],
  );

  if (totalPoints === 0) {
    return { awarded: false, reason: 'No bonus criteria met', awards: [] };
  }

  const result = await awardPoints(userId, {
    points: totalPoints,
    type: isOffPeak ? 'earned_off_peak' : isGreen ? 'earned_green_energy' : 'earned_streak',
    description: `Charging session at ${session.station_name}: ${awards.join(', ')}`,
    referenceId: sessionId,
    referenceType: 'session',
    metadata: { isOffPeak, isGreen, streakDays: newStreak, awards },
  });

  return { awarded: true, ...result, awards };
}

// ── Review Points ───────────────────────────────────────────────

async function awardReviewPoints(userId, reviewId) {
  const { rows: existing } = await db.query(
    `SELECT id FROM points_transactions
     WHERE user_id = $1 AND reference_id = $2 AND reference_type = 'review'`,
    [userId, reviewId],
  );
  if (existing.length > 0) return { awarded: false };

  return awardPoints(userId, {
    points: POINTS.review,
    type: 'earned_review',
    description: `Wrote a station review: +${POINTS.review} pts`,
    referenceId: reviewId,
    referenceType: 'review',
  });
}

// ── Energy Sharing Points ───────────────────────────────────────

async function awardEnergySharingPoints(userId, referenceId) {
  return awardPoints(userId, {
    points: POINTS.energySharing,
    type: 'earned_energy_sharing',
    description: `Energy sharing participation: +${POINTS.energySharing} pts`,
    referenceId,
    referenceType: 'energy_sharing',
  });
}

// ── Badge Evaluation ────────────────────────────────────────────

async function evaluateBadges(userId) {
  // Get all badges user hasn't earned yet
  const { rows: unearned } = await db.query(
    `SELECT b.* FROM badges b
     WHERE b.is_active = true
       AND NOT EXISTS (
         SELECT 1 FROM user_badges ub WHERE ub.badge_id = b.id AND ub.user_id = $1
       )
     ORDER BY b.sort_order`,
    [userId],
  );

  if (unearned.length === 0) return [];

  // Gather user stats
  const stats = await getUserStats(userId);
  const newBadges = [];

  for (const badge of unearned) {
    const value = stats[badge.criteria_type] || 0;
    if (value >= badge.criteria_threshold) {
      // Award badge
      await db.query(
        `INSERT INTO user_badges (user_id, badge_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [userId, badge.id],
      );

      // Award bonus points if any
      if (badge.points_reward > 0) {
        await awardPoints(userId, {
          points: badge.points_reward,
          type: 'earned_achievement',
          description: `Unlocked "${badge.name}": +${badge.points_reward} pts`,
          referenceId: badge.id,
          referenceType: 'badge',
        });
      }
      newBadges.push(formatBadge(badge));
    }
  }

  return newBadges;
}

async function getUserStats(userId) {
  const wallet = await getOrCreateWallet(userId);

  // Total sessions
  const { rows: [sessCounts] } = await db.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(DISTINCT station_id)::int AS unique_stations
     FROM charging_sessions cs
     JOIN charging_slots ck ON ck.id = cs.slot_id
     WHERE cs.user_id = $1 AND cs.status = 'completed'`,
    [userId],
  );

  // Total energy
  const { rows: [energySum] } = await db.query(
    `SELECT COALESCE(SUM(energy_delivered_kwh), 0)::numeric AS total_kwh
     FROM charging_sessions WHERE user_id = $1 AND status = 'completed'`,
    [userId],
  );

  // Review count
  const { rows: [revCount] } = await db.query(
    `SELECT COUNT(*)::int AS total FROM reviews WHERE user_id = $1`,
    [userId],
  );

  // Energy sharing count (from points_transactions)
  const { rows: [shareCount] } = await db.query(
    `SELECT COUNT(*)::int AS total FROM points_transactions
     WHERE user_id = $1 AND transaction_type = 'earned_energy_sharing'`,
    [userId],
  );

  return {
    total_sessions: sessCounts?.total || 0,
    unique_stations: sessCounts?.unique_stations || 0,
    green_sessions_count: parseInt(wallet.total_green_sessions, 10) || 0,
    off_peak_count: parseInt(wallet.total_off_peak_sessions, 10) || 0,
    streak_days: Math.max(
      parseInt(wallet.current_streak_days, 10) || 0,
      parseInt(wallet.longest_streak_days, 10) || 0,
    ),
    review_count: revCount?.total || 0,
    total_energy_kwh: parseFloat(energySum?.total_kwh) || 0,
    energy_sharing_count: shareCount?.total || 0,
  };
}

// ── Reward Redemption ───────────────────────────────────────────

async function getRewardCatalog() {
  const { rows } = await db.query(
    `SELECT * FROM rewards WHERE is_active = true ORDER BY points_cost ASC`,
  );
  return rows.map(formatReward);
}

async function redeemReward(userId, rewardId) {
  const wallet = await getOrCreateWallet(userId);
  const balance = parseInt(wallet.total_points, 10);

  // Get reward
  const { rows: [reward] } = await db.query(
    'SELECT * FROM rewards WHERE id = $1 AND is_active = true', [rewardId],
  );
  if (!reward) throw new Error('Reward not found or inactive');
  if (balance < reward.points_cost) throw new Error(`Insufficient points. Need ${reward.points_cost}, have ${balance}`);
  if (reward.max_redemptions && reward.total_redeemed >= reward.max_redemptions) {
    throw new Error('This reward is sold out');
  }

  const newBalance = balance - reward.points_cost;
  const code = generateCode();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (reward.valid_days || 30));

  // Create redemption
  const { rows: [redemption] } = await db.query(
    `INSERT INTO reward_redemptions (user_id, reward_id, points_spent, code, expires_at)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [userId, rewardId, reward.points_cost, code, expiresAt],
  );

  // Deduct points
  await db.query(
    `INSERT INTO points_transactions
       (user_id, points, balance_after, transaction_type, description, reference_id, reference_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [userId, -reward.points_cost, newBalance,
     `redeemed_${reward.category}`,
     `Redeemed "${reward.name}" for ${reward.points_cost} pts`,
     redemption.id, 'redemption'],
  );

  await db.query(
    'UPDATE user_points SET total_points = $2, updated_at = NOW() WHERE user_id = $1',
    [userId, newBalance],
  );

  // Increment redemption count
  await db.query(
    'UPDATE rewards SET total_redeemed = total_redeemed + 1 WHERE id = $1',
    [rewardId],
  );

  return {
    redemption: formatRedemption({ ...redemption, reward_name: reward.name, reward_description: reward.description, reward_category: reward.category, discount_pct: reward.discount_pct }),
    newBalance,
  };
}

async function getUserRedemptions(userId, { status } = {}) {
  let filter = '';
  const params = [userId];
  if (status) {
    filter = 'AND rr.status = $2';
    params.push(status);
  }
  const { rows } = await db.query(
    `SELECT rr.*, r.name AS reward_name, r.description AS reward_description,
            r.category AS reward_category, r.discount_pct
     FROM reward_redemptions rr
     JOIN rewards r ON r.id = rr.reward_id
     WHERE rr.user_id = $1 ${filter}
     ORDER BY rr.created_at DESC`,
    params,
  );
  return rows.map(formatRedemption);
}

// ── All Badges Catalog ──────────────────────────────────────────

async function getBadgeCatalog(userId) {
  const { rows } = await db.query(
    `SELECT b.*,
            CASE WHEN ub.id IS NOT NULL THEN true ELSE false END AS earned,
            ub.earned_at,
            ub.is_featured
     FROM badges b
     LEFT JOIN user_badges ub ON ub.badge_id = b.id AND ub.user_id = $1
     WHERE b.is_active = true
     ORDER BY b.sort_order`,
    [userId || '00000000-0000-0000-0000-000000000000'],
  );
  return rows.map((b) => ({
    ...formatBadge(b),
    earned: b.earned,
    earnedAt: b.earned_at || null,
    isFeatured: b.is_featured || false,
  }));
}

// ── Leaderboard ─────────────────────────────────────────────────

async function getLeaderboard({ limit = 20 } = {}) {
  const { rows } = await db.query(
    `SELECT up.*, u.full_name, u.avatar_url,
            (SELECT COUNT(*) FROM user_badges ub WHERE ub.user_id = up.user_id)::int AS badge_count
     FROM user_points up
     JOIN users u ON u.id = up.user_id
     WHERE up.lifetime_points > 0
     ORDER BY up.lifetime_points DESC
     LIMIT $1`,
    [limit],
  );
  return rows.map((r, i) => ({
    rank: i + 1,
    userId: r.user_id,
    userName: r.full_name,
    avatarUrl: r.avatar_url,
    lifetimePoints: parseInt(r.lifetime_points, 10),
    level: r.level,
    levelName: r.level_name,
    badgeCount: r.badge_count,
    currentStreak: parseInt(r.current_streak_days, 10),
    longestStreak: parseInt(r.longest_streak_days, 10),
  }));
}

// ── Points History ──────────────────────────────────────────────

async function getPointsHistory(userId, { limit = 30, offset = 0 } = {}) {
  const { rows } = await db.query(
    `SELECT * FROM points_transactions
     WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [userId, limit, offset],
  );
  const { rows: [count] } = await db.query(
    'SELECT COUNT(*)::int AS total FROM points_transactions WHERE user_id = $1',
    [userId],
  );
  return { transactions: rows.map(formatTransaction), total: count?.total || 0 };
}

// ── Helpers ─────────────────────────────────────────────────────

function computeLevel(lifetimePoints) {
  let result = LEVEL_THRESHOLDS[0];
  for (const level of LEVEL_THRESHOLDS) {
    if (lifetimePoints >= level.min) result = level;
    else break;
  }
  return result;
}

function generateCode() {
  return 'RW-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

async function incrementStat(userId, field) {
  await db.query(
    `UPDATE user_points SET ${field} = ${field} + 1, updated_at = NOW() WHERE user_id = $1`,
    [userId],
  );
}

function formatWallet(w) {
  return {
    userId: w.user_id,
    totalPoints: parseInt(w.total_points, 10),
    lifetimePoints: parseInt(w.lifetime_points, 10),
    level: w.level,
    levelName: w.level_name,
    currentStreak: parseInt(w.current_streak_days, 10),
    longestStreak: parseInt(w.longest_streak_days, 10),
    totalSessionsRewarded: parseInt(w.total_sessions_rewarded, 10),
    totalOffPeakSessions: parseInt(w.total_off_peak_sessions, 10),
    totalGreenSessions: parseInt(w.total_green_sessions, 10),
    totalEnergySharedKwh: parseFloat(w.total_energy_shared_kwh) || 0,
    lastActivityAt: w.last_activity_at,
  };
}

function formatBadge(b) {
  return {
    id: b.id,
    slug: b.slug,
    name: b.name,
    description: b.description,
    icon: b.icon,
    category: b.category,
    criteriaType: b.criteria_type,
    criteriaThreshold: b.criteria_threshold,
    pointsReward: b.points_reward,
    rarity: b.rarity,
    earnedAt: b.earned_at || null,
    isFeatured: b.is_featured || false,
  };
}

function formatReward(r) {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    category: r.category,
    pointsCost: r.points_cost,
    discountPct: r.discount_pct ? parseFloat(r.discount_pct) : null,
    discountMaxAmount: r.discount_max_amount ? parseFloat(r.discount_max_amount) : null,
    validDays: r.valid_days,
    totalRedeemed: r.total_redeemed,
    isActive: r.is_active,
  };
}

function formatRedemption(r) {
  return {
    id: r.id,
    rewardName: r.reward_name || null,
    rewardDescription: r.reward_description || null,
    rewardCategory: r.reward_category || null,
    discountPct: r.discount_pct ? parseFloat(r.discount_pct) : null,
    pointsSpent: r.points_spent,
    status: r.status,
    code: r.code,
    expiresAt: r.expires_at,
    usedAt: r.used_at,
    createdAt: r.created_at,
  };
}

function formatTransaction(t) {
  return {
    id: t.id,
    points: t.points,
    balanceAfter: t.balance_after,
    type: t.transaction_type,
    description: t.description,
    referenceId: t.reference_id,
    referenceType: t.reference_type,
    metadata: t.metadata,
    createdAt: t.created_at,
  };
}

module.exports = {
  getOrCreateWallet,
  getWalletSummary,
  awardPoints,
  awardSessionPoints,
  awardReviewPoints,
  awardEnergySharingPoints,
  evaluateBadges,
  getUserStats,
  getRewardCatalog,
  redeemReward,
  getUserRedemptions,
  getBadgeCatalog,
  getLeaderboard,
  getPointsHistory,
};

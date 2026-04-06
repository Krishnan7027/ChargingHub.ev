const db = require('../config/database');
const { caches } = require('../utils/cache');

/**
 * Community Rating & Reliability Service
 *
 * Multi-dimensional review system with 4 rating axes:
 *   1. Charging Speed Accuracy — did the station deliver advertised speeds?
 *   2. Station Reliability      — was the equipment functional and dependable?
 *   3. Cleanliness & Accessibility — physical condition and ease of use
 *   4. Wait Time Accuracy       — was the predicted/advertised wait accurate?
 *
 * Reliability Score (0-100%) combines:
 *   - Review-based score (60%): weighted average of dimensional ratings
 *   - Uptime score (20%): from operational data (maintenance/availability)
 *   - Consistency score (10%): low variance in ratings = more reliable
 *   - Recommendation rate (10%): % of reviewers who would recommend
 *
 * The reliability score is injected into the recommendation engine
 * to boost stations with proven track records.
 */

const RELIABILITY_WEIGHTS = {
  reviewScore: 0.60,
  uptimeScore: 0.20,
  consistencyScore: 0.10,
  recommendationRate: 0.10,
};

const DIMENSION_WEIGHTS = {
  reliability: 0.35,
  chargingSpeed: 0.25,
  waitTime: 0.25,
  cleanliness: 0.15,
};

// ── Create / Update Review ────────────────────────────────────

async function createReview(userId, stationId, data) {
  const {
    rating, comment, chargingSpeedRating, reliabilityRating,
    cleanlinessRating, waitTimeRating, wouldRecommend,
    visitDate, chargingTypeUsed,
  } = data;

  // Upsert: one review per user per station
  const { rows } = await db.query(
    `INSERT INTO reviews (
       user_id, station_id, rating, comment,
       charging_speed_rating, reliability_rating,
       cleanliness_rating, wait_time_rating,
       would_recommend, visit_date, charging_type_used
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (user_id, station_id) DO UPDATE SET
       rating = EXCLUDED.rating,
       comment = EXCLUDED.comment,
       charging_speed_rating = EXCLUDED.charging_speed_rating,
       reliability_rating = EXCLUDED.reliability_rating,
       cleanliness_rating = EXCLUDED.cleanliness_rating,
       wait_time_rating = EXCLUDED.wait_time_rating,
       would_recommend = EXCLUDED.would_recommend,
       visit_date = EXCLUDED.visit_date,
       charging_type_used = EXCLUDED.charging_type_used,
       updated_at = NOW()
     RETURNING *`,
    [
      userId, stationId, rating, comment || null,
      chargingSpeedRating || null, reliabilityRating || null,
      cleanlinessRating || null, waitTimeRating || null,
      wouldRecommend !== undefined ? wouldRecommend : true,
      visitDate || null, chargingTypeUsed || null,
    ],
  );

  // Update station aggregate rating
  await updateStationRating(stationId);
  // Recalculate reliability
  await calculateReliabilityScore(stationId);

  return formatReview(rows[0]);
}

async function deleteReview(reviewId, userId) {
  const { rows } = await db.query(
    `DELETE FROM reviews WHERE id = $1 AND user_id = $2 RETURNING station_id`,
    [reviewId, userId],
  );
  if (rows[0]) {
    await updateStationRating(rows[0].station_id);
    await calculateReliabilityScore(rows[0].station_id);
  }
  return rows.length > 0;
}

// ── Get Reviews ───────────────────────────────────────────────

async function getStationReviews(stationId, { page = 1, limit = 20, sort = 'recent' } = {}) {
  const offset = (page - 1) * limit;
  let orderBy = 'r.created_at DESC';
  if (sort === 'highest') orderBy = 'r.rating DESC, r.created_at DESC';
  else if (sort === 'lowest') orderBy = 'r.rating ASC, r.created_at DESC';
  else if (sort === 'helpful') orderBy = 'r.helpful_count DESC, r.created_at DESC';

  const { rows } = await db.query(
    `SELECT r.*, u.full_name AS user_name, u.avatar_url
     FROM reviews r
     JOIN users u ON u.id = r.user_id
     WHERE r.station_id = $1 AND r.reported = false
     ORDER BY ${orderBy}
     LIMIT $2 OFFSET $3`,
    [stationId, limit, offset],
  );

  const { rows: countRows } = await db.query(
    `SELECT COUNT(*)::int AS total FROM reviews WHERE station_id = $1 AND reported = false`,
    [stationId],
  );

  return {
    reviews: rows.map(formatReview),
    total: countRows[0]?.total || 0,
    page,
    limit,
    totalPages: Math.ceil((countRows[0]?.total || 0) / limit),
  };
}

async function getUserReviews(userId) {
  const { rows } = await db.query(
    `SELECT r.*, s.name AS station_name, s.address AS station_address, s.city AS station_city
     FROM reviews r
     JOIN stations s ON s.id = r.station_id
     WHERE r.user_id = $1
     ORDER BY r.created_at DESC`,
    [userId],
  );
  return rows.map(formatReview);
}

// ── Vote Helpful ──────────────────────────────────────────────

async function voteHelpful(reviewId, userId, isHelpful) {
  await db.query(
    `INSERT INTO review_votes (review_id, user_id, is_helpful)
     VALUES ($1, $2, $3)
     ON CONFLICT (review_id, user_id) DO UPDATE SET is_helpful = $3`,
    [reviewId, userId, isHelpful],
  );

  // Update helpful count
  const { rows } = await db.query(
    `UPDATE reviews SET helpful_count = (
       SELECT COUNT(*) FROM review_votes WHERE review_id = $1 AND is_helpful = true
     ) WHERE id = $1 RETURNING helpful_count`,
    [reviewId],
  );
  return { helpfulCount: rows[0]?.helpful_count || 0 };
}

// ── Report Review ─────────────────────────────────────────────

async function reportReview(reviewId, userId) {
  await db.query(
    `UPDATE reviews SET reported = true WHERE id = $1 AND user_id != $2`,
    [reviewId, userId],
  );
}

// ── Reliability Score Calculation ─────────────────────────────

async function calculateReliabilityScore(stationId) {
  // Aggregate review data
  const { rows: [agg] } = await db.query(
    `SELECT
       COUNT(*)::int AS total_reviews,
       COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days')::int AS reviews_last_30,
       AVG(rating)::numeric(3,2) AS avg_overall,
       AVG(charging_speed_rating)::numeric(3,2) AS avg_speed,
       AVG(reliability_rating)::numeric(3,2) AS avg_reliability,
       AVG(cleanliness_rating)::numeric(3,2) AS avg_cleanliness,
       AVG(wait_time_rating)::numeric(3,2) AS avg_wait,
       STDDEV(rating)::numeric(4,2) AS rating_stddev,
       COUNT(*) FILTER (WHERE would_recommend = true)::int AS recommend_count,
       COUNT(*) FILTER (WHERE rating = 5)::int AS five_star,
       COUNT(*) FILTER (WHERE rating = 1)::int AS one_star,
       jsonb_build_object(
         '1', COUNT(*) FILTER (WHERE rating = 1)::int,
         '2', COUNT(*) FILTER (WHERE rating = 2)::int,
         '3', COUNT(*) FILTER (WHERE rating = 3)::int,
         '4', COUNT(*) FILTER (WHERE rating = 4)::int,
         '5', COUNT(*) FILTER (WHERE rating = 5)::int
       ) AS distribution
     FROM reviews
     WHERE station_id = $1 AND reported = false`,
    [stationId],
  );

  const totalReviews = agg.total_reviews || 0;
  if (totalReviews === 0) {
    // No reviews — set defaults
    await db.query(
      `INSERT INTO station_reliability_scores (station_id)
       VALUES ($1)
       ON CONFLICT (station_id) DO UPDATE SET
         total_reviews = 0, reliability_score = 50,
         updated_at = NOW(), last_calculated_at = NOW()`,
      [stationId],
    );
    return { reliabilityScore: 50, totalReviews: 0 };
  }

  // Review-based score: weighted dimensional average normalised to 0-100
  const dimAvgs = {
    reliability: parseFloat(agg.avg_reliability) || parseFloat(agg.avg_overall) || 3,
    chargingSpeed: parseFloat(agg.avg_speed) || parseFloat(agg.avg_overall) || 3,
    waitTime: parseFloat(agg.avg_wait) || parseFloat(agg.avg_overall) || 3,
    cleanliness: parseFloat(agg.avg_cleanliness) || parseFloat(agg.avg_overall) || 3,
  };

  const weightedDimScore =
    dimAvgs.reliability * DIMENSION_WEIGHTS.reliability +
    dimAvgs.chargingSpeed * DIMENSION_WEIGHTS.chargingSpeed +
    dimAvgs.waitTime * DIMENSION_WEIGHTS.waitTime +
    dimAvgs.cleanliness * DIMENSION_WEIGHTS.cleanliness;

  const reviewScore = (weightedDimScore / 5) * 100; // normalise to 0-100

  // Uptime score: base 80, penalise if many 1-star reliability reviews
  const reliabilityAvg = parseFloat(agg.avg_reliability) || parseFloat(agg.avg_overall) || 3;
  const uptimeScore = Math.min(100, 60 + (reliabilityAvg / 5) * 40);

  // Consistency score: lower stddev = more consistent = higher score
  const stddev = parseFloat(agg.rating_stddev) || 0;
  const consistencyScore = Math.max(0, 100 - (stddev * 25)); // stddev 0 → 100, stddev 2 → 50

  // Recommendation rate
  const recommendationRate = totalReviews > 0
    ? (agg.recommend_count / totalReviews) * 100 : 50;

  // Combined reliability score
  const reliabilityScore = Math.round(
    reviewScore * RELIABILITY_WEIGHTS.reviewScore +
    uptimeScore * RELIABILITY_WEIGHTS.uptimeScore +
    consistencyScore * RELIABILITY_WEIGHTS.consistencyScore +
    recommendationRate * RELIABILITY_WEIGHTS.recommendationRate
  );

  // Trend: compare last 30 days avg to overall avg
  let trend = 'stable';
  let trendDelta = 0;
  if (agg.reviews_last_30 >= 3) {
    const { rows: [recent] } = await db.query(
      `SELECT AVG(rating)::numeric(3,2) AS recent_avg
       FROM reviews WHERE station_id = $1 AND created_at > NOW() - INTERVAL '30 days'`,
      [stationId],
    );
    const recentAvg = parseFloat(recent?.recent_avg) || parseFloat(agg.avg_overall);
    trendDelta = Math.round((recentAvg - parseFloat(agg.avg_overall)) * 100) / 100;
    if (trendDelta > 0.2) trend = 'improving';
    else if (trendDelta < -0.2) trend = 'declining';
  }

  // Persist
  await db.query(
    `INSERT INTO station_reliability_scores (
       station_id, avg_overall_rating, avg_charging_speed_rating,
       avg_reliability_rating, avg_cleanliness_rating, avg_wait_time_rating,
       reliability_score, uptime_score, review_consistency_score,
       recommendation_rate, total_reviews, reviews_last_30_days,
       five_star_count, one_star_count, rating_distribution,
       trend, trend_delta, last_calculated_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NOW(),NOW())
     ON CONFLICT (station_id) DO UPDATE SET
       avg_overall_rating = EXCLUDED.avg_overall_rating,
       avg_charging_speed_rating = EXCLUDED.avg_charging_speed_rating,
       avg_reliability_rating = EXCLUDED.avg_reliability_rating,
       avg_cleanliness_rating = EXCLUDED.avg_cleanliness_rating,
       avg_wait_time_rating = EXCLUDED.avg_wait_time_rating,
       reliability_score = EXCLUDED.reliability_score,
       uptime_score = EXCLUDED.uptime_score,
       review_consistency_score = EXCLUDED.review_consistency_score,
       recommendation_rate = EXCLUDED.recommendation_rate,
       total_reviews = EXCLUDED.total_reviews,
       reviews_last_30_days = EXCLUDED.reviews_last_30_days,
       five_star_count = EXCLUDED.five_star_count,
       one_star_count = EXCLUDED.one_star_count,
       rating_distribution = EXCLUDED.rating_distribution,
       trend = EXCLUDED.trend,
       trend_delta = EXCLUDED.trend_delta,
       last_calculated_at = NOW(),
       updated_at = NOW()`,
    [
      stationId,
      parseFloat(agg.avg_overall) || 0,
      parseFloat(agg.avg_speed) || 0,
      parseFloat(agg.avg_reliability) || 0,
      parseFloat(agg.avg_cleanliness) || 0,
      parseFloat(agg.avg_wait) || 0,
      reliabilityScore, uptimeScore, consistencyScore, recommendationRate,
      totalReviews, agg.reviews_last_30,
      agg.five_star, agg.one_star,
      JSON.stringify(agg.distribution),
      trend, trendDelta,
    ],
  );

  return {
    reliabilityScore,
    reviewScore: Math.round(reviewScore),
    uptimeScore: Math.round(uptimeScore),
    consistencyScore: Math.round(consistencyScore),
    recommendationRate: Math.round(recommendationRate),
    totalReviews,
    trend,
    trendDelta,
  };
}

// ── Get Reliability Score ─────────────────────────────────────

async function getReliabilityScore(stationId) {
  const { rows } = await db.query(
    `SELECT srs.*, s.name AS station_name, s.rating AS station_rating, s.total_reviews AS station_total_reviews
     FROM station_reliability_scores srs
     JOIN stations s ON s.id = srs.station_id
     WHERE srs.station_id = $1`,
    [stationId],
  );

  if (!rows[0]) {
    // Calculate if not yet computed
    const result = await calculateReliabilityScore(stationId);
    const { rows: fresh } = await db.query(
      `SELECT srs.*, s.name AS station_name
       FROM station_reliability_scores srs
       JOIN stations s ON s.id = srs.station_id
       WHERE srs.station_id = $1`,
      [stationId],
    );
    return fresh[0] ? formatReliability(fresh[0]) : {
      stationId, reliabilityScore: 50, totalReviews: 0,
    };
  }

  return formatReliability(rows[0]);
}

// ── Get Reliability Leaderboard ───────────────────────────────

async function getReliabilityLeaderboard({ city, limit = 20, minReviews = 3 } = {}) {
  const cacheKey = `leaderboard:${city || 'all'}:${limit}:${minReviews}`;
  return caches.general.wrap(cacheKey, async () => {
    const params = [minReviews, limit];
    let cityFilter = '';
    if (city) {
      cityFilter = `AND s.city = $3`;
      params.push(city);
    }

    const { rows } = await db.query(
      `SELECT srs.station_id, srs.reliability_score, srs.total_reviews,
              srs.avg_overall_rating, srs.avg_charging_speed_rating, srs.avg_reliability_rating,
              srs.avg_cleanliness_rating, srs.avg_wait_time_rating, srs.recommendation_rate,
              srs.reviews_last_30_days, srs.trend, srs.trend_delta,
              s.name AS station_name, s.address, s.city, s.rating AS station_rating
       FROM station_reliability_scores srs
       JOIN stations s ON s.id = srs.station_id
       WHERE srs.total_reviews >= $1 ${cityFilter}
       ORDER BY srs.reliability_score DESC
       LIMIT $2`,
      params,
    );

    return rows.map(formatReliability);
  }, 5 * 60_000); // 5 minute cache
}

// ── Get Reliability for Recommendations Integration ───────────

async function getReliabilityScoresForStations(stationIds) {
  if (!stationIds || stationIds.length === 0) return {};
  const { rows } = await db.query(
    `SELECT station_id, reliability_score, avg_overall_rating, total_reviews
     FROM station_reliability_scores
     WHERE station_id = ANY($1)`,
    [stationIds],
  );
  return Object.fromEntries(
    rows.map((r) => [r.station_id, {
      reliabilityScore: parseFloat(r.reliability_score),
      avgRating: parseFloat(r.avg_overall_rating),
      totalReviews: parseInt(r.total_reviews, 10),
    }]),
  );
}

// ── Helpers ───────────────────────────────────────────────────

async function updateStationRating(stationId) {
  await db.query(
    `UPDATE stations SET
       rating = COALESCE((SELECT AVG(rating)::numeric(3,2) FROM reviews WHERE station_id = $1 AND reported = false), 0),
       total_reviews = (SELECT COUNT(*) FROM reviews WHERE station_id = $1 AND reported = false)
     WHERE id = $1`,
    [stationId],
  );
}

function formatReview(r) {
  return {
    id: r.id,
    userId: r.user_id,
    stationId: r.station_id,
    userName: r.user_name || r.full_name || null,
    avatarUrl: r.avatar_url || null,
    stationName: r.station_name || null,
    stationAddress: r.station_address || null,
    stationCity: r.station_city || null,
    rating: r.rating,
    chargingSpeedRating: r.charging_speed_rating,
    reliabilityRating: r.reliability_rating,
    cleanlinessRating: r.cleanliness_rating,
    waitTimeRating: r.wait_time_rating,
    comment: r.comment,
    wouldRecommend: r.would_recommend,
    visitDate: r.visit_date,
    chargingTypeUsed: r.charging_type_used,
    helpfulCount: r.helpful_count || 0,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function formatReliability(r) {
  return {
    stationId: r.station_id,
    stationName: r.station_name || null,
    address: r.address || null,
    city: r.city || null,
    stationRating: r.station_rating ? parseFloat(r.station_rating) : null,
    avgOverallRating: parseFloat(r.avg_overall_rating) || 0,
    avgChargingSpeedRating: parseFloat(r.avg_charging_speed_rating) || 0,
    avgReliabilityRating: parseFloat(r.avg_reliability_rating) || 0,
    avgCleanlinessRating: parseFloat(r.avg_cleanliness_rating) || 0,
    avgWaitTimeRating: parseFloat(r.avg_wait_time_rating) || 0,
    reliabilityScore: parseFloat(r.reliability_score) || 0,
    uptimeScore: parseFloat(r.uptime_score) || 0,
    reviewConsistencyScore: parseFloat(r.review_consistency_score) || 0,
    recommendationRate: parseFloat(r.recommendation_rate) || 0,
    totalReviews: parseInt(r.total_reviews, 10) || 0,
    reviewsLast30Days: parseInt(r.reviews_last_30_days, 10) || 0,
    fiveStarCount: parseInt(r.five_star_count, 10) || 0,
    oneStarCount: parseInt(r.one_star_count, 10) || 0,
    ratingDistribution: r.rating_distribution || { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
    trend: r.trend || 'stable',
    trendDelta: parseFloat(r.trend_delta) || 0,
    lastCalculatedAt: r.last_calculated_at,
  };
}

module.exports = {
  createReview,
  deleteReview,
  getStationReviews,
  getUserReviews,
  voteHelpful,
  reportReview,
  calculateReliabilityScore,
  getReliabilityScore,
  getReliabilityLeaderboard,
  getReliabilityScoresForStations,
};

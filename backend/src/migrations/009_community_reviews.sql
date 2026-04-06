-- Migration 009: Community Rating & Reliability System
-- Extends existing reviews table with multi-dimensional ratings
-- and adds station reliability scoring

-- Add multi-dimensional rating columns to existing reviews table
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS charging_speed_rating INTEGER CHECK (charging_speed_rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS reliability_rating INTEGER CHECK (reliability_rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS cleanliness_rating INTEGER CHECK (cleanliness_rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS wait_time_rating INTEGER CHECK (wait_time_rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS would_recommend BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS visit_date DATE,
  ADD COLUMN IF NOT EXISTS charging_type_used VARCHAR(20),
  ADD COLUMN IF NOT EXISTS helpful_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reported BOOLEAN DEFAULT false;

-- Station reliability scores — aggregated from reviews + operational data
CREATE TABLE IF NOT EXISTS station_reliability_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  -- Aggregate ratings (1-5 scale)
  avg_overall_rating NUMERIC(3,2) DEFAULT 0,
  avg_charging_speed_rating NUMERIC(3,2) DEFAULT 0,
  avg_reliability_rating NUMERIC(3,2) DEFAULT 0,
  avg_cleanliness_rating NUMERIC(3,2) DEFAULT 0,
  avg_wait_time_rating NUMERIC(3,2) DEFAULT 0,
  -- Reliability score (0-100%)
  reliability_score NUMERIC(5,2) DEFAULT 0,
  -- Component scores for reliability
  uptime_score NUMERIC(5,2) DEFAULT 80,  -- base from operational data
  review_consistency_score NUMERIC(5,2) DEFAULT 50,
  recommendation_rate NUMERIC(5,2) DEFAULT 0,
  -- Counts
  total_reviews INTEGER DEFAULT 0,
  reviews_last_30_days INTEGER DEFAULT 0,
  five_star_count INTEGER DEFAULT 0,
  one_star_count INTEGER DEFAULT 0,
  -- Distribution
  rating_distribution JSONB DEFAULT '{"1":0,"2":0,"3":0,"4":0,"5":0}',
  -- Trending
  trend VARCHAR(10) DEFAULT 'stable' CHECK (trend IN ('improving', 'stable', 'declining')),
  trend_delta NUMERIC(4,2) DEFAULT 0,
  -- Timestamps
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(station_id)
);

-- Review helpfulness votes
CREATE TABLE IF NOT EXISTS review_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_helpful BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(review_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_station_reliability ON station_reliability_scores(station_id);
CREATE INDEX IF NOT EXISTS idx_station_reliability_score ON station_reliability_scores(reliability_score DESC);
CREATE INDEX IF NOT EXISTS idx_review_votes_review ON review_votes(review_id);
CREATE INDEX IF NOT EXISTS idx_reviews_station_rating ON reviews(station_id, rating DESC);

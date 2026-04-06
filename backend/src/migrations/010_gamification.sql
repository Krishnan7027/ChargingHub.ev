-- Migration 010: Gamification & Rewards System
-- Points economy, badges/achievements, reward redemptions, and leaderboard

-- ── User Points Wallet ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total_points INTEGER DEFAULT 0,
  lifetime_points INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  level_name VARCHAR(40) DEFAULT 'Starter',
  current_streak_days INTEGER DEFAULT 0,
  longest_streak_days INTEGER DEFAULT 0,
  total_sessions_rewarded INTEGER DEFAULT 0,
  total_off_peak_sessions INTEGER DEFAULT 0,
  total_green_sessions INTEGER DEFAULT 0,
  total_energy_shared_kwh NUMERIC(10,2) DEFAULT 0,
  last_activity_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ── Points Transaction Ledger ───────────────────────────────────
CREATE TABLE IF NOT EXISTS points_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points INTEGER NOT NULL, -- positive = earned, negative = spent
  balance_after INTEGER NOT NULL,
  transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN (
    'earned_off_peak', 'earned_green_energy', 'earned_energy_sharing',
    'earned_review', 'earned_streak', 'earned_referral', 'earned_achievement',
    'redeemed_discount', 'redeemed_reservation', 'redeemed_partner',
    'admin_adjustment', 'expired'
  )),
  description TEXT NOT NULL,
  reference_id UUID,       -- session/reservation/review ID
  reference_type VARCHAR(30), -- 'session', 'reservation', 'review', etc.
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Badges / Achievements ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(60) UNIQUE NOT NULL,
  name VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  icon VARCHAR(10) NOT NULL,           -- emoji icon
  category VARCHAR(30) NOT NULL CHECK (category IN (
    'eco', 'streak', 'social', 'explorer', 'power', 'milestone'
  )),
  criteria_type VARCHAR(40) NOT NULL,  -- e.g. 'green_sessions_count', 'off_peak_count'
  criteria_threshold INTEGER NOT NULL, -- e.g. 10 green sessions
  points_reward INTEGER DEFAULT 0,     -- bonus points on unlock
  rarity VARCHAR(12) DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── User Earned Badges ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  is_featured BOOLEAN DEFAULT false, -- user can feature up to 3 badges
  UNIQUE(user_id, badge_id)
);

-- ── Reward Catalog ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(60) UNIQUE NOT NULL,
  name VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(30) NOT NULL CHECK (category IN (
    'discount', 'reservation', 'partner', 'cosmetic'
  )),
  points_cost INTEGER NOT NULL,
  discount_pct NUMERIC(5,2),          -- for discount rewards
  discount_max_amount NUMERIC(10,2),
  valid_days INTEGER DEFAULT 30,      -- days until expiry after redemption
  max_redemptions INTEGER,            -- NULL = unlimited
  total_redeemed INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── User Reward Redemptions ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS reward_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
  points_spent INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired', 'cancelled')),
  code VARCHAR(20),                    -- unique redemption code
  expires_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_points_user ON user_points(user_id);
CREATE INDEX IF NOT EXISTS idx_points_tx_user ON points_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_points_tx_type ON points_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_reward_redemptions_user ON reward_redemptions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_badges_category ON badges(category, sort_order);
CREATE INDEX IF NOT EXISTS idx_user_points_level ON user_points(level DESC, lifetime_points DESC);

-- ── Seed Default Badges ─────────────────────────────────────────
INSERT INTO badges (slug, name, description, icon, category, criteria_type, criteria_threshold, points_reward, rarity, sort_order) VALUES
  -- Eco badges
  ('eco_starter',        'Eco Starter',        'Complete your first green energy charging session',          '🌱', 'eco', 'green_sessions_count', 1,   25,  'common',    1),
  ('eco_charger',        'Eco Charger',        'Complete 10 green energy sessions',                         '🌿', 'eco', 'green_sessions_count', 10,  100, 'uncommon',  2),
  ('eco_warrior',        'Eco Warrior',        'Complete 50 green energy sessions',                         '🌍', 'eco', 'green_sessions_count', 50,  500, 'rare',      3),
  ('eco_champion',       'Eco Champion',       'Complete 200 green energy sessions',                        '♻️', 'eco', 'green_sessions_count', 200, 2000,'epic',      4),
  ('off_peak_pioneer',   'Off-Peak Pioneer',   'Charge during off-peak hours 5 times',                     '🌙', 'eco', 'off_peak_count',       5,   50,  'common',    5),
  ('off_peak_pro',       'Off-Peak Pro',       'Charge during off-peak hours 25 times',                    '🌜', 'eco', 'off_peak_count',       25,  250, 'uncommon',  6),
  ('night_owl',          'Night Owl',          'Charge during off-peak hours 100 times',                   '🦉', 'eco', 'off_peak_count',       100, 1000,'rare',      7),
  -- Streak badges
  ('week_streak',        'Week Warrior',       'Maintain a 7-day charging streak',                          '🔥', 'streak', 'streak_days',       7,   100, 'common',    10),
  ('month_streak',       'Month Master',       'Maintain a 30-day charging streak',                         '💪', 'streak', 'streak_days',       30,  500, 'rare',      11),
  ('century_streak',     'Century Club',       'Maintain a 100-day charging streak',                        '💯', 'streak', 'streak_days',       100, 2500,'epic',      12),
  -- Social badges
  ('first_review',       'First Impression',   'Write your first station review',                           '✍️', 'social', 'review_count',       1,   25,  'common',    20),
  ('reviewer_10',        'Trusted Reviewer',   'Write 10 station reviews',                                 '📝', 'social', 'review_count',       10,  200, 'uncommon',  21),
  ('reviewer_50',        'Review Expert',      'Write 50 station reviews',                                 '🏆', 'social', 'review_count',       50,  1000,'rare',      22),
  -- Explorer badges
  ('station_explorer',   'Station Explorer',   'Charge at 5 different stations',                            '🗺️', 'explorer', 'unique_stations', 5,   50,  'common',    30),
  ('station_hopper',     'Station Hopper',     'Charge at 15 different stations',                           '🧭', 'explorer', 'unique_stations', 15,  250, 'uncommon',  31),
  ('globetrotter',       'Globetrotter',       'Charge at 50 different stations',                           '✈️', 'explorer', 'unique_stations', 50,  1000,'rare',      32),
  -- Power / milestone badges
  ('first_charge',       'First Spark',        'Complete your first charging session',                      '⚡', 'milestone', 'total_sessions',  1,   10,  'common',    40),
  ('power_50',           'Charge Veteran',     'Complete 50 charging sessions',                             '🔋', 'milestone', 'total_sessions',  50,  250, 'uncommon',  41),
  ('power_200',          'Charging Legend',     'Complete 200 charging sessions',                            '⭐', 'milestone', 'total_sessions',  200, 1000,'rare',      42),
  ('megawatt_club',      'Megawatt Club',      'Charge a total of 1000 kWh',                               '🏅', 'power', 'total_energy_kwh',   1000,500, 'rare',      50),
  ('gigawatt_club',      'Gigawatt Club',      'Charge a total of 10000 kWh',                              '👑', 'power', 'total_energy_kwh',   10000,5000,'legendary', 51),
  -- Energy sharing
  ('sharer_starter',     'Energy Sharer',      'Participate in energy sharing for the first time',          '🤝', 'eco', 'energy_sharing_count', 1,  50,  'common',    60),
  ('sharer_pro',         'Sharing Champion',   'Participate in energy sharing 20 times',                    '💚', 'eco', 'energy_sharing_count', 20, 500, 'rare',      61)
ON CONFLICT (slug) DO NOTHING;

-- ── Seed Default Rewards ────────────────────────────────────────
INSERT INTO rewards (slug, name, description, category, points_cost, discount_pct, discount_max_amount, valid_days) VALUES
  ('discount_5pct',      '5% Charging Discount',     'Get 5% off your next charging session',        'discount',     200,  5.00,  5.00,  30),
  ('discount_10pct',     '10% Charging Discount',    'Get 10% off your next charging session',       'discount',     400,  10.00, 10.00, 30),
  ('discount_20pct',     '20% Charging Discount',    'Get 20% off your next charging session',       'discount',     750,  20.00, 20.00, 14),
  ('priority_booking',   'Priority Reservation',     'Book premium time slots with priority access',  'reservation',  500,  NULL,  NULL,   7),
  ('skip_queue',         'Skip the Queue',           'Skip the charging queue once at any station',   'reservation',  300,  NULL,  NULL,   3),
  ('partner_coffee',     'Free Coffee Voucher',      'Redeemable at partner cafes near stations',     'partner',      150,  NULL,  NULL,   14),
  ('partner_car_wash',   'Car Wash Discount',        'Get 50% off at partner car wash locations',     'partner',      250,  50.00, 15.00, 30)
ON CONFLICT (slug) DO NOTHING;

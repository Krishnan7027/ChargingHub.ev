'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  useWalletSummary,
  useBadgeCatalog,
  useRewardCatalog,
  useRedeemReward,
  useUserRedemptions,
  usePointsHistory,
  useGamificationLeaderboard,
} from '@/hooks/useIntelligent';
import type {
  Badge, Reward, RewardRedemption, PointsTransaction, LeaderboardEntry,
} from '@/types';

// ── Rarity Colors ─────────────────────────────────────────────

const rarityColors: Record<string, { bg: string; text: string; border: string }> = {
  common:    { bg: 'bg-gray-100',   text: 'text-gray-700',   border: 'border-gray-300' },
  uncommon:  { bg: 'bg-green-50',   text: 'text-green-700',  border: 'border-green-300' },
  rare:      { bg: 'bg-blue-50',    text: 'text-blue-700',   border: 'border-blue-300' },
  epic:      { bg: 'bg-purple-50',  text: 'text-purple-700', border: 'border-purple-300' },
  legendary: { bg: 'bg-yellow-50',  text: 'text-yellow-700', border: 'border-yellow-400' },
};

const categoryIcons: Record<string, string> = {
  eco: '🌿', streak: '🔥', social: '💬', explorer: '🗺️', power: '⚡', milestone: '🏆',
};

// ── Level Progress Bar ────────────────────────────────────────

function LevelProgress({ level, name, progressPct, nextName, nextMin, lifetimePoints }: {
  level: number; name: string; progressPct: number;
  nextName: string | null; nextMin: number | null; lifetimePoints: number;
}) {
  const colors = ['bg-gray-400', 'bg-green-500', 'bg-blue-500', 'bg-purple-500', 'bg-yellow-500', 'bg-red-500'];
  const barColor = colors[level - 1] || colors[0];

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-gray-900">Lv.{level}</span>
          <span className="text-sm font-medium text-gray-700">{name}</span>
        </div>
        {nextName && (
          <span className="text-[10px] text-gray-400">
            {lifetimePoints} / {nextMin} pts to {nextName}
          </span>
        )}
      </div>
      <div className="w-full bg-gray-100 rounded-full h-3">
        <div className={`h-3 rounded-full ${barColor} transition-all duration-700`} style={{ width: `${progressPct}%` }} />
      </div>
    </div>
  );
}

// ── Points Wallet Card ────────────────────────────────────────

function WalletCard({ totalPoints, lifetimePoints, streak, longestStreak, greenSessions, offPeakSessions }: {
  totalPoints: number; lifetimePoints: number; streak: number;
  longestStreak: number; greenSessions: number; offPeakSessions: number;
}) {
  return (
    <div className="bg-gradient-to-r from-primary-600 to-blue-600 rounded-xl p-5 text-white">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs opacity-80">Available Points</p>
          <p className="text-3xl font-bold">{totalPoints.toLocaleString()}</p>
        </div>
        <div className="text-right">
          <p className="text-xs opacity-80">Lifetime Earned</p>
          <p className="text-lg font-semibold">{lifetimePoints.toLocaleString()}</p>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <div className="text-center p-2 bg-white/10 rounded-lg">
          <p className="text-lg font-bold">{streak}</p>
          <p className="text-[9px] opacity-80">Day Streak</p>
        </div>
        <div className="text-center p-2 bg-white/10 rounded-lg">
          <p className="text-lg font-bold">{longestStreak}</p>
          <p className="text-[9px] opacity-80">Best Streak</p>
        </div>
        <div className="text-center p-2 bg-white/10 rounded-lg">
          <p className="text-lg font-bold">{greenSessions}</p>
          <p className="text-[9px] opacity-80">Green</p>
        </div>
        <div className="text-center p-2 bg-white/10 rounded-lg">
          <p className="text-lg font-bold">{offPeakSessions}</p>
          <p className="text-[9px] opacity-80">Off-Peak</p>
        </div>
      </div>
    </div>
  );
}

// ── Badge Card ────────────────────────────────────────────────

function BadgeCard({ badge }: { badge: Badge }) {
  const rarity = rarityColors[badge.rarity] || rarityColors.common;
  return (
    <div className={`border rounded-lg p-3 text-center transition-all ${
      badge.earned
        ? `${rarity.border} ${rarity.bg}`
        : 'border-gray-200 bg-gray-50 opacity-50'
    }`}>
      <div className="text-2xl mb-1">{badge.icon}</div>
      <p className="text-xs font-semibold text-gray-900 leading-tight">{badge.name}</p>
      <p className="text-[9px] text-gray-500 mt-0.5 leading-tight">{badge.description}</p>
      <div className="flex items-center justify-center gap-1 mt-1.5">
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium capitalize ${rarity.bg} ${rarity.text}`}>
          {badge.rarity}
        </span>
        {badge.pointsReward > 0 && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
            +{badge.pointsReward} pts
          </span>
        )}
      </div>
      {badge.earned && badge.earnedAt && (
        <p className="text-[8px] text-green-600 mt-1">
          Earned {new Date(badge.earnedAt).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}

// ── Reward Card ───────────────────────────────────────────────

function RewardCard({ reward, balance, onRedeem, redeeming }: {
  reward: Reward; balance: number; onRedeem: (id: string) => void; redeeming: boolean;
}) {
  const canAfford = balance >= reward.pointsCost;
  const categoryColors: Record<string, string> = {
    discount: 'bg-green-100 text-green-700',
    reservation: 'bg-blue-100 text-blue-700',
    partner: 'bg-purple-100 text-purple-700',
    cosmetic: 'bg-pink-100 text-pink-700',
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-sm font-semibold text-gray-900">{reward.name}</p>
          <p className="text-xs text-gray-500">{reward.description}</p>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${categoryColors[reward.category] || 'bg-gray-100 text-gray-600'}`}>
          {reward.category}
        </span>
      </div>
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-1">
          <span className="text-sm font-bold text-yellow-600">{reward.pointsCost}</span>
          <span className="text-xs text-gray-400">pts</span>
          {reward.validDays && (
            <span className="text-[10px] text-gray-400 ml-1">· {reward.validDays}d valid</span>
          )}
        </div>
        <button
          onClick={() => onRedeem(reward.id)}
          disabled={!canAfford || redeeming}
          className={`text-xs py-1.5 px-4 rounded-lg font-medium transition-colors ${
            canAfford
              ? 'btn-primary'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          {redeeming ? 'Redeeming...' : canAfford ? 'Redeem' : 'Not enough pts'}
        </button>
      </div>
    </div>
  );
}

// ── Redemption Card ───────────────────────────────────────────

function RedemptionCard({ redemption }: { redemption: RewardRedemption }) {
  const isExpired = new Date(redemption.expiresAt) < new Date();
  const statusColor = redemption.status === 'active' && !isExpired
    ? 'bg-green-100 text-green-700'
    : redemption.status === 'used' ? 'bg-blue-100 text-blue-700'
    : 'bg-gray-100 text-gray-500';

  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-white flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-900">{redemption.rewardName}</p>
        <p className="text-[10px] text-gray-500">
          {redemption.pointsSpent} pts · Expires {new Date(redemption.expiresAt).toLocaleDateString()}
        </p>
      </div>
      <div className="text-right">
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
          {isExpired ? 'expired' : redemption.status}
        </span>
        {redemption.code && redemption.status === 'active' && !isExpired && (
          <p className="text-xs font-mono font-bold text-primary-700 mt-1">{redemption.code}</p>
        )}
      </div>
    </div>
  );
}

// ── Transaction Row ───────────────────────────────────────────

function TransactionRow({ tx }: { tx: PointsTransaction }) {
  const isEarned = tx.points > 0;
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-700 truncate">{tx.description}</p>
        <p className="text-[9px] text-gray-400">{new Date(tx.createdAt).toLocaleString()}</p>
      </div>
      <span className={`text-sm font-bold ml-3 ${isEarned ? 'text-green-600' : 'text-red-500'}`}>
        {isEarned ? '+' : ''}{tx.points}
      </span>
    </div>
  );
}

// ── Leaderboard Row ───────────────────────────────────────────

function LeaderboardRow({ entry }: { entry: LeaderboardEntry }) {
  const medals: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
  return (
    <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg bg-white">
      <span className="text-lg font-bold w-8 text-center text-gray-400">
        {medals[entry.rank] || `#${entry.rank}`}
      </span>
      <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-sm font-bold">
        {(entry.userName || 'U')[0].toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{entry.userName}</p>
        <p className="text-[10px] text-gray-500">
          Lv.{entry.level} {entry.levelName} · {entry.badgeCount} badges · {entry.currentStreak}d streak
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold text-yellow-600">{entry.lifetimePoints.toLocaleString()}</p>
        <p className="text-[9px] text-gray-400">pts</p>
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────

export default function AchievementsDashboard() {
  const [tab, setTab] = useState<'overview' | 'badges' | 'rewards' | 'leaderboard'>('overview');
  const wallet = useWalletSummary();
  const badges = useBadgeCatalog();
  const rewards = useRewardCatalog();
  const redemptions = useUserRedemptions();
  const history = usePointsHistory({ limit: 20 });
  const leaderboard = useGamificationLeaderboard(20);
  const redeemReward = useRedeemReward();

  const handleRedeem = async (rewardId: string) => {
    try {
      const result = await redeemReward.mutateAsync(rewardId);
      toast.success(`Reward redeemed! Code: ${result.redemption.code}`);
    } catch (err: any) {
      toast.error(err.message || 'Redemption failed');
    }
  };

  const w = wallet.data;
  const totalPoints = w?.wallet.totalPoints || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-2xl">🏆</span>
        <h2 className="text-2xl font-bold text-gray-900">Rewards & Achievements</h2>
      </div>
      <p className="text-sm text-gray-500">
        Earn points for eco-friendly charging, unlock badges, and redeem rewards.
      </p>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 overflow-x-auto">
        {([
          ['overview', 'Overview'],
          ['badges', 'Badges'],
          ['rewards', 'Rewards Shop'],
          ['leaderboard', 'Leaderboard'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === key ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {wallet.isLoading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
        </div>
      )}

      {/* Overview Tab */}
      {tab === 'overview' && w && (
        <div className="space-y-5">
          {/* Wallet */}
          <WalletCard
            totalPoints={w.wallet.totalPoints}
            lifetimePoints={w.wallet.lifetimePoints}
            streak={w.wallet.currentStreak}
            longestStreak={w.wallet.longestStreak}
            greenSessions={w.wallet.totalGreenSessions}
            offPeakSessions={w.wallet.totalOffPeakSessions}
          />

          {/* Level progress */}
          <LevelProgress
            level={w.level.current.level}
            name={w.level.current.name}
            progressPct={w.level.progressPct}
            nextName={w.level.next?.name || null}
            nextMin={w.level.next?.min || null}
            lifetimePoints={w.wallet.lifetimePoints}
          />

          {/* How to earn */}
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">How to Earn Points</h3>
            <div className="grid sm:grid-cols-2 gap-2">
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                <span className="text-lg">🌙</span>
                <div>
                  <p className="text-xs font-medium text-gray-900">Off-Peak Charging</p>
                  <p className="text-[10px] text-gray-500">+20 pts per session (10pm-6am)</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                <span className="text-lg">🌿</span>
                <div>
                  <p className="text-xs font-medium text-gray-900">Green Energy Stations</p>
                  <p className="text-[10px] text-gray-500">+30 pts (50%+ renewable)</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                <span className="text-lg">🤝</span>
                <div>
                  <p className="text-xs font-medium text-gray-900">Energy Sharing</p>
                  <p className="text-[10px] text-gray-500">+15 pts per participation</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                <span className="text-lg">🔥</span>
                <div>
                  <p className="text-xs font-medium text-gray-900">Daily Streak</p>
                  <p className="text-[10px] text-gray-500">+5 pts x streak days (max 50)</p>
                </div>
              </div>
            </div>
          </div>

          {/* Recent badges */}
          {w.badges.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                Recent Badges ({w.badges.length})
              </h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                {w.badges.slice(0, 6).map((b) => (
                  <BadgeCard key={b.id} badge={{ ...b, earned: true }} />
                ))}
              </div>
              {w.badges.length > 6 && (
                <button onClick={() => setTab('badges')} className="text-xs text-primary-600 hover:underline mt-2">
                  View all {w.badges.length} badges →
                </button>
              )}
            </div>
          )}

          {/* Active redemptions */}
          {w.activeRedemptions.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Active Rewards</h3>
              <div className="space-y-2">
                {w.activeRedemptions.map((r) => (
                  <RedemptionCard key={r.id} redemption={r} />
                ))}
              </div>
            </div>
          )}

          {/* Recent transactions */}
          {w.recentTransactions.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Recent Activity</h3>
              <div>
                {w.recentTransactions.slice(0, 10).map((tx) => (
                  <TransactionRow key={tx.id} tx={tx} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Badges Tab */}
      {tab === 'badges' && (
        <div className="space-y-4">
          {badges.data && (() => {
            const categories = Array.from(new Set(badges.data.badges.map((b) => b.category)));
            return categories.map((cat) => {
              const catBadges = badges.data!.badges.filter((b) => b.category === cat);
              const earned = catBadges.filter((b) => b.earned).length;
              return (
                <div key={cat}>
                  <div className="flex items-center gap-2 mb-2">
                    <span>{categoryIcons[cat] || '🏅'}</span>
                    <h3 className="text-sm font-semibold text-gray-700 capitalize">{cat}</h3>
                    <span className="text-[10px] text-gray-400">{earned}/{catBadges.length}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {catBadges.map((b) => (
                      <BadgeCard key={b.id} badge={b} />
                    ))}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}

      {/* Rewards Tab */}
      {tab === 'rewards' && (
        <div className="space-y-5">
          {/* Balance */}
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl">
            <div>
              <p className="text-xs text-yellow-700">Your Balance</p>
              <p className="text-2xl font-bold text-yellow-800">{totalPoints.toLocaleString()} pts</p>
            </div>
          </div>

          {/* Catalog */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Rewards Catalog</h3>
            <div className="space-y-3">
              {rewards.data?.rewards.map((r) => (
                <RewardCard
                  key={r.id}
                  reward={r}
                  balance={totalPoints}
                  onRedeem={handleRedeem}
                  redeeming={redeemReward.isPending}
                />
              ))}
            </div>
          </div>

          {/* My redemptions */}
          {redemptions.data && redemptions.data.redemptions.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">My Redemptions</h3>
              <div className="space-y-2">
                {redemptions.data.redemptions.map((r) => (
                  <RedemptionCard key={r.id} redemption={r} />
                ))}
              </div>
            </div>
          )}

          {/* Points history */}
          {history.data && history.data.transactions.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Points History</h3>
              {history.data.transactions.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Leaderboard Tab */}
      {tab === 'leaderboard' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">Top earners on the platform</p>
          {leaderboard.isLoading && (
            <div className="flex justify-center py-8">
              <div className="animate-spin w-6 h-6 border-3 border-primary-600 border-t-transparent rounded-full" />
            </div>
          )}
          {leaderboard.data?.leaders.map((entry) => (
            <LeaderboardRow key={entry.userId} entry={entry} />
          ))}
          {leaderboard.data && leaderboard.data.leaders.length === 0 && (
            <div className="card text-center py-8">
              <p className="text-gray-500 text-sm">No one has earned points yet. Be the first!</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

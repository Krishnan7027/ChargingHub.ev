'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  useStationReviews,
  useUserReviews,
  useCreateReview,
  useDeleteReview,
  useVoteHelpful,
  useReliabilityScore,
  useReliabilityLeaderboard,
} from '@/hooks/useIntelligent';
import { stationApi } from '@/lib/api';
import type { StationReview, ReliabilityScore, Station } from '@/types';

// ── Star Rating Input ─────────────────────────────────────────

function StarInput({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div>
      <label className="block text-xs text-gray-600 mb-1">{label}</label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className={`w-7 h-7 rounded text-sm transition-colors ${
              star <= value ? 'bg-yellow-400 text-white' : 'bg-gray-100 text-gray-400 hover:bg-yellow-100'
            }`}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Star Display ──────────────────────────────────────────────

function Stars({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const textSize = size === 'md' ? 'text-base' : 'text-xs';
  return (
    <span className={`${textSize} text-yellow-500`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} className={s <= Math.round(rating) ? '' : 'opacity-30'}>★</span>
      ))}
    </span>
  );
}

// ── Reliability Gauge ─────────────────────────────────────────

function ReliabilityGauge({ score }: { score: number }) {
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : score >= 40 ? '#f97316' : '#ef4444';
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center">
      <svg width="90" height="90" viewBox="0 0 90 90">
        <circle cx="45" cy="45" r={radius} fill="none" stroke="#f3f4f6" strokeWidth="6" />
        <circle
          cx="45" cy="45" r={radius} fill="none"
          stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          transform="rotate(-90 45 45)"
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-lg font-bold" style={{ color }}>{Math.round(score)}%</p>
        <p className="text-[8px] text-gray-400">reliable</p>
      </div>
    </div>
  );
}

// ── Rating Distribution Bar ───────────────────────────────────

function RatingDistribution({ distribution, total }: { distribution: Record<string, number>; total: number }) {
  return (
    <div className="space-y-1">
      {[5, 4, 3, 2, 1].map((star) => {
        const count = distribution[String(star)] || 0;
        const pct = total > 0 ? (count / total) * 100 : 0;
        return (
          <div key={star} className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-4">{star}</span>
            <span className="text-xs text-yellow-500">★</span>
            <div className="flex-1 bg-gray-100 rounded-full h-2">
              <div className="h-2 rounded-full bg-yellow-400 transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[10px] text-gray-400 w-6 text-right">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Dimensional Rating Bars ───────────────────────────────────

function DimensionBar({ label, value, icon }: { label: string; value: number; icon: string }) {
  const pct = (value / 5) * 100;
  const color = value >= 4 ? 'bg-green-500' : value >= 3 ? 'bg-yellow-500' : value >= 2 ? 'bg-orange-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm w-5 text-center">{icon}</span>
      <span className="text-xs text-gray-600 w-24">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className={`h-2 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium text-gray-700 w-8 text-right">{value.toFixed(1)}</span>
    </div>
  );
}

// ── Review Card ───────────────────────────────────────────────

function ReviewCard({ review, onVote, onDelete, isOwn }: {
  review: StationReview;
  onVote: (id: string, helpful: boolean) => void;
  onDelete?: (id: string) => void;
  isOwn: boolean;
}) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-sm font-bold">
            {(review.userName || 'U')[0].toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{review.userName || 'Anonymous'}</p>
            <p className="text-[10px] text-gray-400">
              {review.visitDate
                ? new Date(review.visitDate).toLocaleDateString()
                : new Date(review.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Stars rating={review.rating} />
          <span className="text-sm font-bold text-gray-700 ml-1">{review.rating}</span>
        </div>
      </div>

      {/* Dimensional ratings */}
      {(review.chargingSpeedRating || review.reliabilityRating || review.cleanlinessRating || review.waitTimeRating) && (
        <div className="flex flex-wrap gap-2 mb-2">
          {review.chargingSpeedRating && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
              Speed: {review.chargingSpeedRating}/5
            </span>
          )}
          {review.reliabilityRating && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-700">
              Reliability: {review.reliabilityRating}/5
            </span>
          )}
          {review.cleanlinessRating && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">
              Cleanliness: {review.cleanlinessRating}/5
            </span>
          )}
          {review.waitTimeRating && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-50 text-orange-700">
              Wait: {review.waitTimeRating}/5
            </span>
          )}
        </div>
      )}

      {review.comment && (
        <p className="text-sm text-gray-700 mb-2">{review.comment}</p>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {review.wouldRecommend && (
            <span className="text-[10px] text-green-600 font-medium">👍 Recommends</span>
          )}
          {review.chargingTypeUsed && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">
              {review.chargingTypeUsed.replace('_', ' ')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onVote(review.id, true)}
            className="text-[10px] text-gray-500 hover:text-primary-600 flex items-center gap-0.5"
          >
            👍 {review.helpfulCount > 0 && review.helpfulCount}
          </button>
          {isOwn && onDelete && (
            <button
              onClick={() => onDelete(review.id)}
              className="text-[10px] text-red-500 hover:text-red-700"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Reliability Panel ─────────────────────────────────────────

function ReliabilityPanel({ stationId }: { stationId: string }) {
  const { data: reliability } = useReliabilityScore(stationId);
  if (!reliability) return null;

  const trendIcon = reliability.trend === 'improving' ? '↑' : reliability.trend === 'declining' ? '↓' : '→';
  const trendColor = reliability.trend === 'improving' ? 'text-green-600' : reliability.trend === 'declining' ? 'text-red-600' : 'text-gray-500';

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Reliability Score</h3>
      <div className="flex items-center gap-6">
        <ReliabilityGauge score={reliability.reliabilityScore} />
        <div className="flex-1 space-y-2">
          <DimensionBar label="Charging Speed" value={reliability.avgChargingSpeedRating || reliability.avgOverallRating} icon="⚡" />
          <DimensionBar label="Reliability" value={reliability.avgReliabilityRating || reliability.avgOverallRating} icon="🔧" />
          <DimensionBar label="Cleanliness" value={reliability.avgCleanlinessRating || reliability.avgOverallRating} icon="✨" />
          <DimensionBar label="Wait Time" value={reliability.avgWaitTimeRating || reliability.avgOverallRating} icon="⏱" />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 text-center">
        <div className="p-2 bg-gray-50 rounded">
          <p className="text-xs text-gray-500">Rating</p>
          <p className="text-sm font-bold text-gray-900">{reliability.avgOverallRating.toFixed(1)}/5</p>
        </div>
        <div className="p-2 bg-gray-50 rounded">
          <p className="text-xs text-gray-500">Reviews</p>
          <p className="text-sm font-bold text-gray-900">{reliability.totalReviews}</p>
        </div>
        <div className="p-2 bg-gray-50 rounded">
          <p className="text-xs text-gray-500">Recommend</p>
          <p className="text-sm font-bold text-gray-900">{Math.round(reliability.recommendationRate)}%</p>
        </div>
        <div className="p-2 bg-gray-50 rounded">
          <p className="text-xs text-gray-500">Trend</p>
          <p className={`text-sm font-bold ${trendColor}`}>{trendIcon} {reliability.trend}</p>
        </div>
      </div>
      {reliability.totalReviews > 0 && (
        <div className="mt-3">
          <RatingDistribution distribution={reliability.ratingDistribution} total={reliability.totalReviews} />
        </div>
      )}
    </div>
  );
}

// ── Review Form ───────────────────────────────────────────────

function ReviewForm({ stationId, stationName, onDone }: {
  stationId: string;
  stationName: string;
  onDone: () => void;
}) {
  const createReview = useCreateReview();
  const [rating, setRating] = useState(0);
  const [chargingSpeedRating, setChargingSpeedRating] = useState(0);
  const [reliabilityRating, setReliabilityRating] = useState(0);
  const [cleanlinessRating, setCleanlinessRating] = useState(0);
  const [waitTimeRating, setWaitTimeRating] = useState(0);
  const [comment, setComment] = useState('');
  const [wouldRecommend, setWouldRecommend] = useState(true);
  const [chargingTypeUsed, setChargingTypeUsed] = useState('');

  const handleSubmit = async () => {
    if (rating === 0) { toast.error('Please select an overall rating'); return; }
    try {
      await createReview.mutateAsync({
        stationId,
        data: {
          rating,
          chargingSpeedRating: chargingSpeedRating || undefined,
          reliabilityRating: reliabilityRating || undefined,
          cleanlinessRating: cleanlinessRating || undefined,
          waitTimeRating: waitTimeRating || undefined,
          comment: comment || undefined,
          wouldRecommend,
          chargingTypeUsed: chargingTypeUsed || undefined,
        },
      });
      toast.success('Review submitted!');
      onDone();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit review');
    }
  };

  return (
    <div className="card border-primary-200">
      <h3 className="text-sm font-semibold text-gray-700 mb-1">Review: {stationName}</h3>
      <p className="text-xs text-gray-500 mb-3">Rate your charging experience</p>

      <div className="space-y-3">
        <StarInput value={rating} onChange={setRating} label="Overall Rating *" />

        <div className="grid grid-cols-2 gap-3">
          <StarInput value={chargingSpeedRating} onChange={setChargingSpeedRating} label="Charging Speed Accuracy" />
          <StarInput value={reliabilityRating} onChange={setReliabilityRating} label="Station Reliability" />
          <StarInput value={cleanlinessRating} onChange={setCleanlinessRating} label="Cleanliness & Access" />
          <StarInput value={waitTimeRating} onChange={setWaitTimeRating} label="Wait Time Accuracy" />
        </div>

        <div>
          <label className="block text-xs text-gray-600 mb-1">Comment</label>
          <textarea
            className="input text-sm py-2"
            rows={3}
            placeholder="Share your experience..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={2000}
          />
        </div>

        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Charger Used</label>
            <select className="input text-sm py-1.5" value={chargingTypeUsed}
              onChange={(e) => setChargingTypeUsed(e.target.value)}>
              <option value="">Select</option>
              <option value="level1">Level 1</option>
              <option value="level2">Level 2</option>
              <option value="dc_fast">DC Fast</option>
            </select>
          </div>
          <div className="flex items-end gap-2 pb-1">
            <input type="checkbox" id="recommend" checked={wouldRecommend}
              onChange={(e) => setWouldRecommend(e.target.checked)} />
            <label htmlFor="recommend" className="text-sm text-gray-700">I would recommend this station</label>
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={handleSubmit} disabled={createReview.isPending || rating === 0}
            className="btn-primary text-sm py-2 px-6">
            {createReview.isPending ? 'Submitting...' : 'Submit Review'}
          </button>
          <button onClick={onDone} className="btn-secondary text-sm py-2 px-4">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Leaderboard Card ──────────────────────────────────────────

function LeaderboardCard({ station, rank }: { station: ReliabilityScore; rank: number }) {
  const medalColors: Record<number, string> = { 1: 'text-yellow-500', 2: 'text-gray-400', 3: 'text-orange-400' };
  return (
    <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg bg-white">
      <span className={`text-lg font-bold w-8 text-center ${medalColors[rank] || 'text-gray-400'}`}>
        {rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : `#${rank}`}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{station.stationName}</p>
        <p className="text-[10px] text-gray-500">{station.city} · {station.totalReviews} reviews</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold text-gray-900">{station.avgOverallRating.toFixed(1)} <Stars rating={station.avgOverallRating} /></p>
        <p className={`text-[10px] font-medium ${
          station.reliabilityScore >= 80 ? 'text-green-600' : station.reliabilityScore >= 60 ? 'text-yellow-600' : 'text-red-600'
        }`}>
          {Math.round(station.reliabilityScore)}% reliable
        </p>
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────

export default function StationReviewsDashboard() {
  const [tab, setTab] = useState<'browse' | 'my' | 'leaderboard'>('browse');
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [stationSearch, setStationSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Station[]>([]);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('recent');

  const stationReviews = useStationReviews(selectedStation?.id || '', { page, limit: 10, sort });
  const userReviews = useUserReviews();
  const deleteReview = useDeleteReview();
  const voteHelpful = useVoteHelpful();
  const leaderboard = useReliabilityLeaderboard({ limit: 20 });

  const handleSearch = async () => {
    if (!stationSearch.trim()) return;
    try {
      const result = await stationApi.search({ search: stationSearch, limit: '10' });
      setSearchResults(result.stations || []);
    } catch {
      toast.error('Search failed');
    }
  };

  const handleSelectStation = (station: Station) => {
    setSelectedStation(station);
    setSearchResults([]);
    setStationSearch('');
    setPage(1);
  };

  const handleVote = (reviewId: string, isHelpful: boolean) => {
    voteHelpful.mutate({ reviewId, isHelpful });
  };

  const handleDelete = (reviewId: string) => {
    if (confirm('Delete this review?')) {
      deleteReview.mutate(reviewId, {
        onSuccess: () => toast.success('Review deleted'),
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <svg className="w-6 h-6 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
        <h2 className="text-2xl font-bold text-gray-900">Station Reviews & Reliability</h2>
      </div>
      <p className="text-sm text-gray-500">
        Rate charging stations and help the community find the most reliable chargers.
      </p>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {([['browse', 'Browse & Review'], ['my', 'My Reviews'], ['leaderboard', 'Reliability Leaderboard']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === key ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Browse Tab */}
      {tab === 'browse' && (
        <div className="space-y-4">
          {/* Station search */}
          <div className="card">
            <label className="block text-xs font-medium text-gray-600 mb-1">Find a Station</label>
            <div className="flex gap-2">
              <input
                className="input text-sm py-2 flex-1"
                placeholder="Search by station name or city..."
                value={stationSearch}
                onChange={(e) => setStationSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button onClick={handleSearch} className="btn-primary text-sm py-2 px-4">Search</button>
            </div>

            {searchResults.length > 0 && (
              <div className="mt-2 border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-48 overflow-y-auto">
                {searchResults.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleSelectStation(s)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors"
                  >
                    <p className="text-sm font-medium text-gray-900">{s.name}</p>
                    <p className="text-[10px] text-gray-500">{s.address}, {s.city}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedStation && (
            <>
              {/* Station header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{selectedStation.name}</h3>
                  <p className="text-xs text-gray-500">{selectedStation.address}, {selectedStation.city}</p>
                </div>
                <button
                  onClick={() => setShowReviewForm(!showReviewForm)}
                  className="btn-primary text-sm py-2 px-4"
                >
                  {showReviewForm ? 'Cancel' : 'Write Review'}
                </button>
              </div>

              {/* Review form */}
              {showReviewForm && (
                <ReviewForm
                  stationId={selectedStation.id}
                  stationName={selectedStation.name}
                  onDone={() => setShowReviewForm(false)}
                />
              )}

              {/* Reliability panel */}
              <ReliabilityPanel stationId={selectedStation.id} />

              {/* Reviews list */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700">
                    Reviews {stationReviews.data && `(${stationReviews.data.total})`}
                  </h3>
                  <select className="input text-xs py-1 w-32" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
                    <option value="recent">Most Recent</option>
                    <option value="highest">Highest Rated</option>
                    <option value="lowest">Lowest Rated</option>
                    <option value="helpful">Most Helpful</option>
                  </select>
                </div>

                {stationReviews.isLoading && (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin w-6 h-6 border-3 border-primary-600 border-t-transparent rounded-full" />
                  </div>
                )}

                {stationReviews.data && (
                  <div className="space-y-3">
                    {stationReviews.data.reviews.length === 0 && (
                      <div className="card text-center py-8">
                        <p className="text-gray-500 text-sm">No reviews yet. Be the first to review this station!</p>
                      </div>
                    )}
                    {stationReviews.data.reviews.map((r) => (
                      <ReviewCard
                        key={r.id}
                        review={r}
                        isOwn={false}
                        onVote={handleVote}
                      />
                    ))}

                    {/* Pagination */}
                    {stationReviews.data.totalPages > 1 && (
                      <div className="flex items-center justify-center gap-2 mt-4">
                        <button
                          onClick={() => setPage(Math.max(1, page - 1))}
                          disabled={page === 1}
                          className="btn-secondary text-xs py-1 px-3"
                        >
                          Previous
                        </button>
                        <span className="text-xs text-gray-500">
                          Page {page} of {stationReviews.data.totalPages}
                        </span>
                        <button
                          onClick={() => setPage(Math.min(stationReviews.data!.totalPages, page + 1))}
                          disabled={page >= stationReviews.data.totalPages}
                          className="btn-secondary text-xs py-1 px-3"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {!selectedStation && (
            <div className="card text-center py-12">
              <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="text-gray-500 text-sm">Search for a station to view reviews and reliability scores</p>
            </div>
          )}
        </div>
      )}

      {/* My Reviews Tab */}
      {tab === 'my' && (
        <div className="space-y-3">
          {userReviews.isLoading && (
            <div className="flex justify-center py-8">
              <div className="animate-spin w-6 h-6 border-3 border-primary-600 border-t-transparent rounded-full" />
            </div>
          )}
          {userReviews.data && userReviews.data.reviews.length === 0 && (
            <div className="card text-center py-8">
              <p className="text-gray-500 text-sm">You haven't written any reviews yet.</p>
            </div>
          )}
          {userReviews.data?.reviews.map((r) => (
            <div key={r.id}>
              {r.stationName && (
                <p className="text-xs text-gray-500 mb-1">
                  <span className="font-medium text-gray-700">{r.stationName}</span> · {r.stationCity}
                </p>
              )}
              <ReviewCard
                review={r}
                isOwn={true}
                onVote={handleVote}
                onDelete={handleDelete}
              />
            </div>
          ))}
        </div>
      )}

      {/* Leaderboard Tab */}
      {tab === 'leaderboard' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            Stations ranked by community reliability score (minimum 3 reviews)
          </p>
          {leaderboard.isLoading && (
            <div className="flex justify-center py-8">
              <div className="animate-spin w-6 h-6 border-3 border-primary-600 border-t-transparent rounded-full" />
            </div>
          )}
          {leaderboard.data?.stations.map((s, i) => (
            <LeaderboardCard key={s.stationId} station={s} rank={i + 1} />
          ))}
          {leaderboard.data && leaderboard.data.stations.length === 0 && (
            <div className="card text-center py-8">
              <p className="text-gray-500 text-sm">No stations have enough reviews for the leaderboard yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

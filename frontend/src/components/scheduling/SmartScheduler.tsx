'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  useFindOptimalSchedule,
  useAcceptScheduleRecommendation,
} from '@/hooks/useIntelligent';
import type { ScheduleCandidate, ScheduleResponse } from '@/types';

const congestionColors: Record<string, string> = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

function formatHour(hour: number) {
  const h = hour % 12 || 12;
  const ampm = hour < 12 ? 'AM' : 'PM';
  return `${h}:00 ${ampm}`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// ── Score Dial ───────────────────────────────────────────────────
function ScoreDial({ score }: { score: number }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : score >= 40 ? '#f97316' : '#ef4444';

  return (
    <div className="relative flex items-center justify-center">
      <svg width="70" height="70" viewBox="0 0 70 70">
        <circle cx="35" cy="35" r={radius} fill="none" stroke="#f3f4f6" strokeWidth="5" />
        <circle
          cx="35" cy="35" r={radius} fill="none"
          stroke={color} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          transform="rotate(-90 35 35)"
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-sm font-bold" style={{ color }}>{Math.round(score)}</p>
        <p className="text-[8px] text-gray-400">score</p>
      </div>
    </div>
  );
}

// ── Candidate Card ───────────────────────────────────────────────
function CandidateCard({ candidate, rank, isTop, onAccept, accepting }: {
  candidate: ScheduleCandidate;
  rank: number;
  isTop: boolean;
  onAccept: (c: ScheduleCandidate) => void;
  accepting: boolean;
}) {
  return (
    <div className={`border rounded-lg p-4 transition-all ${
      isTop ? 'border-primary-400 bg-primary-50 ring-1 ring-primary-200' : 'border-gray-200 bg-white'
    }`}>
      <div className="flex items-start gap-3">
        <ScoreDial score={candidate.score} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-gray-900">{candidate.stationName}</span>
            {isTop && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-100 text-primary-700 font-medium">
                Best Match
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mb-2">{candidate.stationAddress}</p>

          {/* Time + Wait */}
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <div className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium text-gray-900">{formatTime(candidate.recommendedStart)}</span>
              <span className="text-xs text-gray-400">-</span>
              <span className="text-sm text-gray-600">{formatTime(candidate.recommendedEnd)}</span>
            </div>
            <div className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-gray-700">~{candidate.predictedWaitMin} min wait</span>
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-1.5">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${congestionColors[candidate.congestionLevel] || 'bg-gray-100 text-gray-600'}`}>
              {candidate.congestionLevel}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
              {Math.round(candidate.predictedOccupancyPct)}% occupancy
            </span>
            {candidate.powerOutputKw && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                {candidate.powerOutputKw} kW
              </span>
            )}
            {candidate.distanceKm > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                {candidate.distanceKm.toFixed(1)} km
              </span>
            )}
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-50 text-gray-400">
              {Math.round(candidate.confidence * 100)}% conf
            </span>
          </div>

          {/* Reason */}
          <p className="text-[11px] text-gray-500 mt-2 italic">{candidate.reason}</p>
        </div>
      </div>

      {/* Book button */}
      {candidate.slotId && (
        <button
          onClick={() => onAccept(candidate)}
          disabled={accepting}
          className={`mt-3 w-full text-sm py-2 rounded-lg font-medium transition-colors ${
            isTop
              ? 'btn-primary'
              : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          {accepting ? 'Booking...' : isTop ? 'Book This Slot' : 'Book'}
        </button>
      )}
    </div>
  );
}

// ── Main Scheduler Component ─────────────────────────────────────
export default function SmartScheduler() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [durationMin, setDurationMin] = useState(60);
  const [flexibilityHours, setFlexibilityHours] = useState(4);
  const [preferredHour, setPreferredHour] = useState<number>(new Date().getHours() + 1);
  const [stationId, setStationId] = useState('');
  const [result, setResult] = useState<ScheduleResponse | null>(null);

  const findSchedule = useFindOptimalSchedule();
  const acceptRec = useAcceptScheduleRecommendation();

  const handleSearch = async () => {
    try {
      const data = await findSchedule.mutateAsync({
        date,
        durationMin,
        flexibilityHours,
        preferredStartHour: preferredHour,
        stationId: stationId || undefined,
      });
      setResult(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to find schedule');
    }
  };

  const handleAccept = async (candidate: ScheduleCandidate) => {
    // For now, use direct reservation since we may not have persisted rec ID in the response
    // The accept endpoint creates the reservation automatically
    try {
      // Use the latest recommendation from the backend
      const recs = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/intelligent/scheduling/my-recommendations?limit=1`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      }).then(r => r.json());

      const latestRec = recs?.recommendations?.[0];
      if (latestRec) {
        await acceptRec.mutateAsync(latestRec.id);
        toast.success('Reservation booked successfully!');
        setResult(null);
      } else {
        toast.error('Could not find recommendation to book');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to book reservation');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <svg className="w-6 h-6 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <h2 className="text-2xl font-bold text-gray-900">Smart Charging Scheduler</h2>
        <span className="text-[10px] bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium">AI</span>
      </div>
      <p className="text-sm text-gray-500">
        Find the best time to charge based on predicted station congestion, wait times, and your preferences.
      </p>

      {/* Search Form */}
      <div className="card">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
              className="input text-sm py-2"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Preferred Time</label>
            <select
              value={preferredHour}
              onChange={(e) => setPreferredHour(Number(e.target.value))}
              className="input text-sm py-2"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>{formatHour(i)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Duration (min)</label>
            <select
              value={durationMin}
              onChange={(e) => setDurationMin(Number(e.target.value))}
              className="input text-sm py-2"
            >
              <option value={30}>30 min</option>
              <option value={60}>1 hour</option>
              <option value={90}>1.5 hours</option>
              <option value={120}>2 hours</option>
              <option value={180}>3 hours</option>
              <option value={240}>4 hours</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Flexibility</label>
            <select
              value={flexibilityHours}
              onChange={(e) => setFlexibilityHours(Number(e.target.value))}
              className="input text-sm py-2"
            >
              <option value={1}>+/- 1 hour</option>
              <option value={2}>+/- 2 hours</option>
              <option value={4}>+/- 4 hours</option>
              <option value={6}>+/- 6 hours</option>
              <option value={8}>+/- 8 hours</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleSearch}
          disabled={findSchedule.isPending}
          className="w-full btn-primary py-2.5 text-sm"
        >
          {findSchedule.isPending ? (
            <span className="flex items-center justify-center gap-2">
              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              Analyzing congestion patterns...
            </span>
          ) : 'Find Best Charging Time'}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div>
          {/* Hero recommendation */}
          {result.recommendation && (
            <div className="mb-6 p-5 bg-gradient-to-r from-primary-50 to-blue-50 border border-primary-200 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-semibold text-primary-800">Recommended Charging Time</span>
              </div>

              <div className="grid grid-cols-3 gap-4 text-center mb-3">
                <div>
                  <p className="text-xs text-gray-500">Best Time</p>
                  <p className="text-2xl font-bold text-gray-900">{formatTime(result.recommendation.recommendedStart)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Expected Wait</p>
                  <p className="text-2xl font-bold text-green-600">{result.recommendation.predictedWaitMin} min</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Station</p>
                  <p className="text-lg font-bold text-gray-900">{result.recommendation.stationName}</p>
                </div>
              </div>

              <p className="text-xs text-gray-600 mb-3">{result.recommendation.reason}</p>

              {result.recommendation.slotId && (
                <button
                  onClick={() => handleAccept(result.recommendation!)}
                  disabled={acceptRec.isPending}
                  className="w-full btn-primary py-2.5"
                >
                  {acceptRec.isPending ? 'Booking...' : 'Book This Time Slot'}
                </button>
              )}
            </div>
          )}

          {/* Search summary */}
          {result.searchParams && (
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {result.searchParams.stationsSearched} stations searched
              </span>
              <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {result.searchParams.candidatesEvaluated} time slots evaluated
              </span>
            </div>
          )}

          {/* Alternatives */}
          {result.alternatives.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Alternative Time Slots</h3>
              <div className="space-y-3">
                {result.alternatives.map((alt, i) => (
                  <CandidateCard
                    key={`${alt.stationId}-${alt.hour}`}
                    candidate={alt}
                    rank={i + 2}
                    isTop={false}
                    onAccept={handleAccept}
                    accepting={acceptRec.isPending}
                  />
                ))}
              </div>
            </div>
          )}

          {/* No results */}
          {!result.recommendation && result.alternatives.length === 0 && (
            <div className="card text-center py-8">
              <p className="text-gray-500">{result.message}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

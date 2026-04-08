'use client';

import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useSlotAllocation, useJoinQueue } from '@/hooks/useIntelligent';
import { useCreateReservation } from '@/hooks/useStations';
import { useAuth } from '@/context/AuthContext';
import type { SlotRanking, SlotAllocationResponse } from '@/types';

const scoreBarColors: Record<string, string> = {
  availability: 'bg-green-500/100',
  chargingSpeed: 'bg-blue-500/100',
  gridLoad: 'bg-yellow-500/100',
  congestion: 'bg-orange-500',
  reservationFit: 'bg-purple-500/100',
  chargeTime: 'bg-indigo-500',
};

const scoreLabels: Record<string, string> = {
  availability: 'Availability',
  chargingSpeed: 'Speed Match',
  gridLoad: 'Grid Load',
  congestion: 'Congestion',
  reservationFit: 'Time Fit',
  chargeTime: 'Charge Time',
};

const typeLabels: Record<string, string> = {
  level1: 'Level 1',
  level2: 'Level 2',
  dc_fast: 'DC Fast',
};

function ScoreBreakdown({ scores }: { scores: SlotRanking['scores'] }) {
  return (
    <div className="grid grid-cols-3 gap-x-3 gap-y-1">
      {Object.entries(scores).map(([key, val]) => (
        <div key={key}>
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[9px] text-theme-muted">{scoreLabels[key] || key}</span>
            <span className="text-[9px] text-theme-secondary">{(val * 100).toFixed(0)}</span>
          </div>
          <div className="h-1 glass rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${scoreBarColors[key] || 'bg-gray-400'}`}
              style={{ width: `${val * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function RankingCard({ ranking, rank, isTop, onReserve }: {
  ranking: SlotRanking;
  rank: number;
  isTop: boolean;
  onReserve: (slotId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`border rounded-lg p-3 transition-all ${
      isTop ? 'border-primary-400 bg-primary-50 ring-1 ring-primary-200' : 'border-glass bg-white'
    }`}>
      <div className="flex items-start gap-3">
        {/* Rank badge */}
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
          rank === 1 ? 'bg-primary-600 text-white' : rank === 2 ? 'bg-gray-200 text-theme-secondary' : 'glass text-theme-muted'
        }`}>
          {rank}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-theme-primary">Slot #{ranking.slotNumber}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
              ranking.status === 'available' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
            }`}>
              {ranking.status === 'available' ? 'Now' : `~${ranking.availableIn} min`}
            </span>
            {isTop && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-100 text-primary-700 font-medium">
                AI Pick
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-theme-secondary">
            <span>{typeLabels[ranking.chargingType] || ranking.chargingType}</span>
            <span>&middot;</span>
            <span>{ranking.connectorType.toUpperCase()}</span>
            <span>&middot;</span>
            <span className="font-medium text-theme-secondary">{ranking.powerOutputKw} kW</span>
            <span>&middot;</span>
            <span>~{ranking.estimatedChargeMinutes} min charge</span>
          </div>

          {/* Expandable score breakdown */}
          {expanded && (
            <div className="mt-2 pt-2 border-t border-glass">
              <ScoreBreakdown scores={ranking.scores} />
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <div className="text-lg font-bold text-primary-600">{Math.round(ranking.totalScore * 100)}</div>
          <p className="text-[9px] text-theme-muted">score</p>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[10px] text-primary-500 hover:text-primary-700"
          >
            {expanded ? 'Less' : 'Details'}
          </button>
        </div>
      </div>

      {/* Reserve CTA for top pick */}
      {isTop && ranking.status === 'available' && (
        <button
          onClick={() => onReserve(ranking.slotId)}
          className="mt-3 w-full btn-primary text-sm py-2"
        >
          Reserve Slot #{ranking.slotNumber} — Start Immediately
        </button>
      )}
    </div>
  );
}

interface SmartSlotAllocationProps {
  stationId: string;
  onSlotSelected: (slotId: string) => void;
}

export default function SmartSlotAllocation({ stationId, onSlotSelected }: SmartSlotAllocationProps) {
  const { user } = useAuth();
  const [batteryPct, setBatteryPct] = useState<number>(20);
  const [targetPct, setTargetPct] = useState<number>(80);
  const [capacityKwh, setCapacityKwh] = useState<number>(60);
  const [activated, setActivated] = useState(false);

  const { data, isLoading, refetch } = useSlotAllocation(stationId, {
    batteryPercentage: activated ? batteryPct : null,
    targetPercentage: targetPct,
    batteryCapacityKwh: capacityKwh,
  });

  const joinQueue = useJoinQueue();

  const handleActivate = useCallback(() => {
    setActivated(true);
  }, []);

  const handleJoinQueue = useCallback(async () => {
    if (!user) {
      toast.error('Please log in to join the queue');
      return;
    }
    try {
      await joinQueue.mutateAsync({
        stationId,
        data: { batteryPercentage: batteryPct, targetPercentage: targetPct, batteryCapacityKwh: capacityKwh },
      });
      toast.success('Added to queue! We\'ll notify you when a slot opens.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to join queue');
    }
  }, [user, stationId, batteryPct, targetPct, capacityKwh, joinQueue]);

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-5 h-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <h3 className="font-semibold text-theme-primary">Smart Slot Assignment</h3>
        <span className="ml-auto text-[10px] bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium">AI</span>
      </div>

      {/* Input form */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div>
          <label className="block text-[11px] text-theme-secondary mb-1">Battery %</label>
          <input
            type="number"
            min={0} max={100}
            value={batteryPct}
            onChange={(e) => { setBatteryPct(Number(e.target.value)); setActivated(false); }}
            className="input text-sm py-1.5"
          />
        </div>
        <div>
          <label className="block text-[11px] text-theme-secondary mb-1">Target %</label>
          <input
            type="number"
            min={1} max={100}
            value={targetPct}
            onChange={(e) => { setTargetPct(Number(e.target.value)); setActivated(false); }}
            className="input text-sm py-1.5"
          />
        </div>
        <div>
          <label className="block text-[11px] text-theme-secondary mb-1">Battery kWh</label>
          <input
            type="number"
            min={10} max={200}
            value={capacityKwh}
            onChange={(e) => { setCapacityKwh(Number(e.target.value)); setActivated(false); }}
            className="input text-sm py-1.5"
          />
        </div>
      </div>

      {!activated ? (
        <button onClick={handleActivate} className="w-full btn-primary text-sm py-2.5">
          Find Best Slot
        </button>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin w-6 h-6 border-3 border-primary-600 border-t-transparent rounded-full" />
          <span className="ml-2 text-sm text-theme-secondary">Analyzing slots...</span>
        </div>
      ) : data ? (
        <div>
          {/* Top recommendation hero */}
          {data.recommendation && (
            <div className="mb-4 p-3 bg-gradient-to-r from-primary-50 to-blue-50 border border-primary-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm font-semibold text-primary-800">AI Recommendation</span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center mb-2">
                <div>
                  <p className="text-xs text-theme-secondary">Recommended</p>
                  <p className="text-lg font-bold text-theme-primary">Slot #{data.recommendation.slotNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-theme-secondary">Start Time</p>
                  <p className="text-lg font-bold text-green-600">
                    {data.recommendation.chargingStartTime === 'immediate' ? 'Now' : `~${data.recommendation.availableIn}m`}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-theme-secondary">Full Charge</p>
                  <p className="text-lg font-bold text-blue-600">{data.recommendation.estimatedChargeMinutes} min</p>
                </div>
              </div>
              <p className="text-xs text-theme-secondary">{data.recommendation.reason}</p>
            </div>
          )}

          {/* Context factors */}
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="text-[10px] glass text-theme-secondary px-2 py-0.5 rounded-full">
              {data.factors.availableSlots}/{data.factors.totalSlots} available
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${
              data.factors.gridStatus === 'normal' ? 'bg-green-100 text-green-600' :
              data.factors.gridStatus === 'warning' ? 'bg-yellow-100 text-yellow-600' : 'bg-red-100 text-red-600'
            }`}>
              Grid: {data.factors.gridStatus}
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${
              data.factors.congestionLevel === 'low' ? 'bg-green-100 text-green-600' :
              data.factors.congestionLevel === 'medium' ? 'bg-yellow-100 text-yellow-600' : 'bg-orange-100 text-orange-600'
            }`}>
              Congestion: {data.factors.congestionLevel}
            </span>
          </div>

          {/* Queue info */}
          {data.queue && (
            <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-200 rounded-lg">
              <p className="text-sm font-medium text-yellow-800 mb-1">All slots occupied</p>
              <p className="text-xs text-yellow-700">{data.queue.message}</p>
              {user && (
                <button
                  onClick={handleJoinQueue}
                  className="mt-2 text-sm font-medium text-yellow-800 bg-yellow-200 hover:bg-yellow-300 px-3 py-1.5 rounded-md transition-colors"
                  disabled={joinQueue.isPending}
                >
                  {joinQueue.isPending ? 'Joining...' : 'Join Queue'}
                </button>
              )}
            </div>
          )}

          {/* Slot rankings */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-theme-secondary font-medium">All Slots Ranked</p>
              <button onClick={() => refetch()} className="text-[10px] text-primary-500 hover:text-primary-700">
                Refresh
              </button>
            </div>
            {data.rankings.map((ranking, i) => (
              <RankingCard
                key={ranking.slotId}
                ranking={ranking}
                rank={i + 1}
                isTop={i === 0}
                onReserve={onSlotSelected}
              />
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-theme-muted text-center py-4">Enter your battery details and click Find Best Slot</p>
      )}
    </div>
  );
}

'use client';

import { useSmartPrediction } from '@/hooks/useIntelligent';
import type { SlotPredictionEntry } from '@/types';

const sourceLabels: Record<string, string> = {
  charging_progress: 'Charging progress',
  charging_near_complete: 'Nearly done charging',
  reservation_schedule: 'Reservation end time',
  historical_average: 'Historical patterns',
  default_estimate: 'Estimated average',
};

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 80 ? 'bg-green-500/100' : pct >= 50 ? 'bg-yellow-500/100' : 'bg-gray-400';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-14 bg-gray-200 rounded-full h-1.5">
        <div className={`${color} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-theme-secondary tabular-nums">{pct}%</span>
    </div>
  );
}

function PredictionRow({ p, isBest }: { p: SlotPredictionEntry; isBest: boolean }) {
  return (
    <div className={`flex items-center justify-between py-2.5 ${isBest ? '' : 'border-t border-glass'}`}>
      <div className="flex items-center gap-3">
        <span className={`text-sm font-semibold tabular-nums ${isBest ? 'text-primary-700' : 'text-theme-primary'}`}>
          #{p.slotNumber}
        </span>
        <div>
          <span className="text-sm text-theme-secondary">
            ~{p.predictedMinutes} min
          </span>
          <span className="text-xs text-theme-muted ml-1.5">
            {sourceLabels[p.source] || p.source}
          </span>
          {p.details.currentPct !== undefined && (
            <span className="text-xs text-theme-muted ml-1">
              ({p.details.currentPct}% → {p.details.targetPct}%)
            </span>
          )}
        </div>
      </div>
      <ConfidenceBar value={p.confidence} />
    </div>
  );
}

export default function PredictionBanner({ stationId }: { stationId: string }) {
  const { data, isLoading, error } = useSmartPrediction(stationId);

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="card animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-48 mb-3" />
        <div className="h-3 bg-gray-200 rounded w-32" />
      </div>
    );
  }

  // Error — fail silently (prediction is supplementary)
  if (error || !data) return null;

  // ── Slots available: green banner ─────────────────────
  if (data.available) {
    return (
      <div className="bg-green-500/10 border border-green-200 rounded-xl p-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="font-medium text-green-800">{data.message}</p>
          </div>
        </div>
        {data.slots && data.slots.length > 0 && (
          <div className="flex flex-wrap gap-2 ml-11">
            {data.slots.map((s) => (
              <span key={s.slotId} className="text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full">
                #{s.slotNumber} &middot; {s.chargingType.replace('_', ' ')} &middot; {s.powerKw} kW
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── No slots available: prediction panel ──────────────
  const predictions = data.predictions || [];
  const best = data.nextAvailable;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold flex items-center gap-2 text-theme-primary">
          <svg className="w-5 h-5 text-accent-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Slot Availability Prediction
        </h3>
        {best && (
          <span className="text-xs text-theme-muted">
            Updates every 30s
          </span>
        )}
      </div>

      {/* Hero prediction */}
      {best && (
        <div className="bg-accent-50 border border-accent-200 rounded-lg p-3 mb-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-accent-800">{data.message}</p>
              <p className="text-sm text-accent-600 mt-0.5">
                Expected at {new Date(best.predictedAvailableAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold text-accent-700 tabular-nums">~{best.predictedMinutes}</span>
              <span className="text-xs text-accent-500 block">min</span>
            </div>
          </div>
        </div>
      )}

      {/* Per-slot breakdown */}
      {predictions.length > 0 && (
        <div>
          <p className="text-xs text-theme-secondary uppercase tracking-wide font-medium mb-1">All slots</p>
          {predictions.slice(0, 6).map((p, i) => (
            <PredictionRow key={p.slotId} p={p} isBest={i === 0} />
          ))}
        </div>
      )}

      {predictions.length === 0 && !best && (
        <p className="text-sm text-theme-secondary py-2">{data.message}</p>
      )}
    </div>
  );
}

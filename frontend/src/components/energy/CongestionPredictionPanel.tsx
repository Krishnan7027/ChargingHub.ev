'use client';

import { useCongestionPredictions } from '@/hooks/useIntelligent';

const levelColors: Record<string, string> = {
  low: 'bg-green-400',
  medium: 'bg-yellow-400',
  high: 'bg-orange-400',
  critical: 'bg-red-500',
};

const levelBadge: Record<string, string> = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

export default function CongestionPredictionPanel({ stationId }: { stationId: string }) {
  const { data, isLoading } = useCongestionPredictions(stationId, 24);

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
        <h3 className="font-semibold text-gray-900">Congestion Forecast</h3>
      </div>

      {isLoading ? (
        <div className="h-24 bg-gray-100 rounded-lg animate-pulse" />
      ) : !data?.predictions?.length ? (
        <p className="text-sm text-gray-400 text-center py-4">No congestion data available</p>
      ) : (
        <>
          {/* Current status */}
          {data.currentOccupancy && (
            <div className="flex items-center justify-between mb-3 p-2 bg-gray-50 rounded-lg">
              <div>
                <p className="text-xs text-gray-500">Current Occupancy</p>
                <p className="text-lg font-bold text-gray-800">{data.currentOccupancy.percentage.toFixed(0)}%</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${levelBadge[data.currentOccupancy.level] || 'bg-gray-100 text-gray-600'}`}>
                {data.currentOccupancy.level}
              </span>
            </div>
          )}

          {/* Best time */}
          {data.bestTimeToVisit && (
            <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-600 font-medium">Best time to visit</p>
              <p className="text-sm font-semibold text-blue-800">
                {String(data.bestTimeToVisit.hour).padStart(2, '0')}:00
                {data.bestTimeToVisit.estimatedWait > 0
                  ? ` (~${data.bestTimeToVisit.estimatedWait} min wait)`
                  : ' (no wait)'}
              </p>
            </div>
          )}

          {/* Hourly heatmap (next 12 hours) */}
          <p className="text-xs text-gray-500 mb-1">Next 12 Hours</p>
          <div className="grid grid-cols-12 gap-0.5">
            {data.predictions.slice(0, 12).map((p, i) => (
              <div key={i} className="text-center">
                <div
                  className={`h-6 rounded-sm ${levelColors[p.congestionLevel] || 'bg-gray-200'}`}
                  title={`${String(p.hour).padStart(2, '0')}:00 — ${p.congestionLevel} (${p.predictedOccupancyPct.toFixed(0)}%)`}
                />
                <p className="text-[8px] text-gray-400 mt-0.5">{p.hour}</p>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex gap-3 mt-2 justify-center">
            {['low', 'medium', 'high', 'critical'].map((level) => (
              <div key={level} className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${levelColors[level]}`} />
                <span className="text-[9px] text-gray-400 capitalize">{level}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

'use client';

import Link from 'next/link';
import type { StationRecommendation } from '@/types';

const speedColors: Record<string, string> = {
  'Ultra Fast': 'bg-purple-100 text-purple-700',
  'Fast': 'bg-blue-100 text-blue-700',
  'Standard': 'bg-gray-100 text-gray-700',
  'Slow': 'bg-yellow-100 text-yellow-700',
};

export default function RecommendationCard({ rec, rank }: { rec: StationRecommendation; rank: number }) {
  return (
    <Link href={`/stations/${rec.stationId}`} className="card hover:shadow-md transition-shadow block">
      <div className="flex items-start gap-3">
        {/* Rank badge */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
          rank === 1 ? 'bg-yellow-100 text-yellow-700' : rank === 2 ? 'bg-gray-100 text-gray-600' : rank === 3 ? 'bg-orange-100 text-orange-700' : 'bg-gray-50 text-gray-400'
        }`}>
          {rank}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-900 truncate">{rec.name}</h3>
            {rank <= 3 && (
              <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full whitespace-nowrap">
                {rec.label}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">{rec.address}, {rec.city}</p>

          <div className="flex flex-wrap gap-2 mt-2">
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {rec.distanceKm} km
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${speedColors[rec.speedLabel] || 'bg-gray-100 text-gray-600'}`}>
              {rec.speedLabel} ({rec.maxPowerKw} kW)
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              rec.availableSlots > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {rec.availableSlots}/{rec.totalSlots} available
            </span>
            {rec.estimatedWaitMin > 0 && (
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                ~{rec.estimatedWaitMin} min wait
              </span>
            )}
          </div>

          {/* Score breakdown */}
          <div className="flex gap-1 mt-2">
            {Object.entries(rec.scoreBreakdown).map(([key, val]) => (
              <div key={key} className="flex-1">
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-primary-400 rounded-full" style={{ width: `${val}%` }} />
                </div>
                <p className="text-[9px] text-gray-400 mt-0.5 text-center capitalize">{key}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <div className="text-lg font-bold text-primary-600">{Math.round(rec.score * 100)}</div>
          <p className="text-[10px] text-gray-400">score</p>
          {rec.rating > 0 && (
            <div className="flex items-center gap-0.5 mt-1 justify-end">
              <svg className="w-3 h-3 text-yellow-500 fill-current" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="text-xs text-gray-600">{rec.rating.toFixed(1)}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

'use client';

import { useStationCarbon } from '@/hooks/useIntelligent';

export default function CarbonFootprintPanel({ stationId }: { stationId: string }) {
  const { data, isLoading } = useStationCarbon(stationId);

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="font-semibold text-gray-900">Carbon Impact</h3>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      ) : !data?.totals ? (
        <p className="text-sm text-gray-400 text-center py-4">No carbon data yet</p>
      ) : (
        <>
          {/* Hero stat */}
          <div className="text-center mb-4 p-3 bg-green-50 rounded-lg">
            <p className="text-3xl font-bold text-green-600">
              {data.totals.carbonSavedKg.toFixed(1)}
            </p>
            <p className="text-xs text-green-700 mt-1">kg CO₂ saved</p>
          </div>

          {/* Metric cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-blue-600">
                {data.totals.energyKwh.toFixed(1)}
              </p>
              <p className="text-[10px] text-gray-500">kWh Delivered</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-emerald-600">
                {data.totals.treesEquivalent.toFixed(1)}
              </p>
              <p className="text-[10px] text-gray-500">Trees Equivalent</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-purple-600">
                {data.totals.milesOffset.toFixed(0)}
              </p>
              <p className="text-[10px] text-gray-500">Gas Miles Offset</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-orange-600">
                {data.totals.sessions}
              </p>
              <p className="text-[10px] text-gray-500">Sessions Tracked</p>
            </div>
          </div>

          {/* Daily trend */}
          {data.dailyTrend && data.dailyTrend.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-gray-500 mb-2">Daily Carbon Savings</p>
              <div className="flex items-end gap-1 h-16">
                {data.dailyTrend.slice(-14).map((d, i) => {
                  const max = Math.max(...data.dailyTrend!.slice(-14).map((x) => x.carbonSavedKg), 0.1);
                  const height = (d.carbonSavedKg / max) * 100;
                  return (
                    <div
                      key={i}
                      className="flex-1 bg-green-400 rounded-t-sm min-h-[2px]"
                      style={{ height: `${Math.max(height, 3)}%` }}
                      title={`${d.day}: ${d.carbonSavedKg.toFixed(2)} kg CO₂`}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

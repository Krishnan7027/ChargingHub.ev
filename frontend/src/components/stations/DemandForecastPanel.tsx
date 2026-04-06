'use client';

import { useTodayDemand } from '@/hooks/useIntelligent';

const demandColors: Record<string, string> = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-red-100 text-red-700',
};

const barColors: Record<string, string> = {
  low: 'bg-green-400',
  medium: 'bg-yellow-400',
  high: 'bg-red-400',
};

export default function DemandForecastPanel({ stationId }: { stationId: string }) {
  const { data, isLoading } = useTodayDemand(stationId);

  if (isLoading || !data?.forecast?.length) return null;

  const today = data.forecast[0];
  if (!today?.hours?.length) return null;

  // Show hours from 6 AM to 11 PM for brevity
  const visibleHours = today.hours.filter((h) => h.hour >= 6 && h.hour <= 23);
  const currentHour = new Date().getHours();

  return (
    <div className="card">
      <h3 className="font-semibold mb-3 flex items-center gap-2">
        <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        Today&apos;s Demand Forecast
      </h3>

      <div className="space-y-1.5">
        {visibleHours.map((h) => (
          <div key={h.hour} className={`flex items-center gap-3 text-sm py-1 px-2 rounded ${h.hour === currentHour ? 'bg-gray-50 ring-1 ring-primary-200' : ''}`}>
            <span className="w-16 text-gray-500 text-xs font-mono">{h.timeRange}</span>
            <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barColors[h.demandLevel]}`}
                style={{ width: `${Math.max(h.avgOccupancyRate, 5)}%` }}
              />
            </div>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${demandColors[h.demandLevel]}`}>
              {h.demandLevel}
            </span>
            {h.hour === currentHour && (
              <span className="text-xs text-primary-600 font-medium">Now</span>
            )}
          </div>
        ))}
      </div>

      {today.peakHour !== null && (
        <p className="text-xs text-gray-500 mt-3">
          Peak hour: {String(today.peakHour).padStart(2, '0')}:00
        </p>
      )}
    </div>
  );
}

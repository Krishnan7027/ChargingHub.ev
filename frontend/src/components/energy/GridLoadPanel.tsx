'use client';

import { useGridLoad } from '@/hooks/useIntelligent';

const statusColors: Record<string, { bg: string; text: string; ring: string }> = {
  normal: { bg: 'bg-green-500/10', text: 'text-green-700', ring: 'stroke-green-500' },
  warning: { bg: 'bg-yellow-500/10', text: 'text-yellow-700', ring: 'stroke-yellow-500' },
  critical: { bg: 'bg-orange-50', text: 'text-orange-700', ring: 'stroke-orange-500' },
  emergency: { bg: 'bg-red-500/10', text: 'text-red-700', ring: 'stroke-red-500' },
};

export default function GridLoadPanel({ stationId }: { stationId: string }) {
  const { data, isLoading } = useGridLoad(stationId);

  if (isLoading) {
    return (
      <div className="card">
        <div className="h-32 glass rounded-lg animate-pulse" />
      </div>
    );
  }

  if (!data) return null;

  const colors = statusColors[data.grid.status] || statusColors.normal;
  const loadPct = data.grid.loadPercentage;
  const circumference = 2 * Math.PI * 40;
  const dashOffset = circumference - (Math.min(loadPct, 100) / 100) * circumference;

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-5 h-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <h3 className="font-semibold text-theme-primary">Grid Load</h3>
        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${colors.bg} ${colors.text}`}>
          {data.grid.status}
        </span>
      </div>

      <div className="flex items-center gap-4">
        {/* Circular gauge */}
        <div className="relative w-24 h-24 flex-shrink-0">
          <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="8" />
            <circle
              cx="50" cy="50" r="40" fill="none"
              className={colors.ring}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              style={{ transition: 'stroke-dashoffset 0.5s' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-lg font-bold ${colors.text}`}>{loadPct.toFixed(0)}%</span>
            <span className="text-[9px] text-theme-muted">load</span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex-1 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-theme-secondary">Current Load</span>
            <span className="font-medium">{data.grid.currentLoadKw.toFixed(0)} kW</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-theme-secondary">Grid Capacity</span>
            <span className="font-medium">{data.grid.capacityKw} kW</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-theme-secondary">Peak Load</span>
            <span className="font-medium">{data.grid.peakLoadKw.toFixed(0)} kW</span>
          </div>
          {data.grid.loadBalancingActive && (
            <p className="text-[10px] text-orange-600 font-medium mt-1">
              ⚡ Load balancing active
            </p>
          )}
        </div>
      </div>

      {/* Slot allocations */}
      {data.slots.length > 0 && (
        <div className="mt-3 pt-3 border-t border-glass">
          <p className="text-xs text-theme-secondary mb-2">Slot Power Draw</p>
          <div className="space-y-1">
            {data.slots.filter((s) => s.isCharging).map((slot) => (
              <div key={slot.slotId} className="flex items-center gap-2">
                <span className="text-[10px] text-theme-muted w-12">Slot {slot.slotNumber}</span>
                <div className="flex-1 glass rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-blue-500/100 rounded-full"
                    style={{ width: `${Math.min((slot.currentPowerKw / slot.maxPowerKw) * 100, 100)}%` }}
                  />
                </div>
                <span className="text-[10px] text-theme-secondary w-14 text-right">
                  {slot.currentPowerKw.toFixed(0)}/{slot.maxPowerKw} kW
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {data.recommendations.length > 0 && (
        <div className="mt-3 pt-3 border-t border-glass">
          <p className="text-xs text-theme-secondary mb-1">Recommendations</p>
          {data.recommendations.slice(0, 2).map((rec, i) => (
            <p key={i} className="text-[11px] text-orange-600 mt-1">
              • {rec.reason}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

import { useStationTwins } from '@/hooks/useIntelligent';
import type { BatteryDigitalTwin } from '@/types';

function TwinCard({ twin }: { twin: BatteryDigitalTwin }) {
  const socPct = twin.battery.currentSoc;
  const targetPct = twin.battery.targetSoc;
  const progressPct = targetPct > 0 ? (socPct / targetPct) * 100 : 0;

  const thermalColor = twin.thermal.thermalStatus === 'derated'
    ? 'text-red-600' : twin.thermal.thermalStatus === 'warm'
      ? 'text-yellow-600' : 'text-green-600';

  return (
    <div className="border border-glass rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-theme-secondary">
          Session {twin.sessionId.slice(0, 8)}…
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          twin.isActive ? 'bg-green-100 text-green-700' : 'glass text-theme-secondary'
        }`}>
          {twin.isActive ? 'Active' : 'Completed'}
        </span>
      </div>

      {/* SoC progress bar */}
      <div className="mb-2">
        <div className="flex justify-between text-xs text-theme-secondary mb-1">
          <span>SoC: {socPct.toFixed(1)}%</span>
          <span>Target: {targetPct}%</span>
        </div>
        <div className="h-3 glass rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full transition-all"
            style={{ width: `${Math.min(progressPct, 100)}%` }}
          />
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-xs text-theme-muted">Power</p>
          <p className="text-sm font-semibold text-blue-600">
            {twin.charging.currentPowerKw.toFixed(1)} kW
          </p>
        </div>
        <div>
          <p className="text-xs text-theme-muted">Efficiency</p>
          <p className="text-sm font-semibold text-purple-600">
            {(twin.charging.efficiency * 100).toFixed(0)}%
          </p>
        </div>
        <div>
          <p className="text-xs text-theme-muted">ETA</p>
          <p className="text-sm font-semibold text-theme-secondary">
            {twin.prediction.minutesRemaining > 0
              ? `${Math.round(twin.prediction.minutesRemaining)} min`
              : 'Done'}
          </p>
        </div>
      </div>

      {/* Thermal + Health row */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-glass">
        <div className="flex items-center gap-1">
          <svg className={`w-3.5 h-3.5 ${thermalColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5.07 19H19a2 2 0 001.75-2.96l-6.93-12a2 2 0 00-3.5 0l-6.93 12A2 2 0 005.07 19z" />
          </svg>
          <span className={`text-xs ${thermalColor}`}>
            {twin.thermal.batteryTempCelsius.toFixed(1)}°C
          </span>
        </div>
        <div className="text-xs text-theme-secondary">
          Health: {twin.battery.healthPct.toFixed(1)}%
        </div>
        <div className="text-xs text-theme-secondary">
          {twin.charging.energyDeliveredKwh.toFixed(1)} kWh
        </div>
      </div>
    </div>
  );
}

export default function BatteryDigitalTwinPanel({ stationId }: { stationId: string }) {
  const { data, isLoading } = useStationTwins(stationId);

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <h3 className="font-semibold text-theme-primary">Battery Digital Twins</h3>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-32 glass rounded-lg animate-pulse" />
          ))}
        </div>
      ) : !data?.twins?.length ? (
        <p className="text-sm text-theme-muted text-center py-4">No active charging sessions</p>
      ) : (
        <div className="space-y-3">
          {data.twins.map((twin) => (
            <TwinCard key={twin.id} twin={twin} />
          ))}
        </div>
      )}
    </div>
  );
}

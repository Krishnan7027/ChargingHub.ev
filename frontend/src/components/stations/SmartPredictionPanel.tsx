'use client';

import { useSmartPrediction } from '@/hooks/useIntelligent';

export default function SmartPredictionPanel({ stationId }: { stationId: string }) {
  const { data, isLoading } = useSmartPrediction(stationId);

  if (isLoading || !data) return null;

  if (data.available) {
    return (
      <div className="bg-green-500/10 border border-green-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-3 h-3 bg-green-500/100 rounded-full animate-pulse" />
          <span className="font-medium text-green-800">{data.message}</span>
        </div>
        {data.slots && (
          <div className="flex flex-wrap gap-2 mt-2">
            {data.slots.map((s: any) => (
              <span key={s.slotId} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                Slot #{s.slotNumber} - {s.chargingType.replace('_', ' ')} ({s.powerKw} kW)
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="font-semibold mb-3 flex items-center gap-2">
        <svg className="w-5 h-5 text-accent-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        Smart Slot Predictions
      </h3>
      {data.nextAvailable && (
        <div className="bg-accent-50 border border-accent-200 rounded-lg p-3 mb-3">
          <p className="font-medium text-accent-800">{data.message}</p>
          <p className="text-sm text-accent-600 mt-1">
            Expected at {new Date(data.nextAvailable.predictedAvailableAt).toLocaleTimeString()}
          </p>
        </div>
      )}
      {data.predictions.length > 0 && (
        <div className="space-y-2">
          {data.predictions.slice(0, 5).map((p, i) => (
            <div key={i} className="flex items-center justify-between text-sm py-2 border-b border-glass last:border-0">
              <div>
                <span className="font-medium">Slot #{p.slotNumber}</span>
                <span className="text-theme-secondary ml-2">~{p.predictedMinutes} min</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-16 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-accent-500 h-2 rounded-full"
                    style={{ width: `${p.confidence * 100}%` }}
                  />
                </div>
                <span className="text-xs text-theme-secondary">{Math.round(p.confidence * 100)}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

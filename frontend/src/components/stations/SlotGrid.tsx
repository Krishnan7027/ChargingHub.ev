'use client';

import type { ChargingSlot } from '@/types';

const statusConfig: Record<string, { bg: string; ring: string; dot: string; label: string }> = {
  available:   { bg: 'bg-green-50',  ring: 'ring-green-500/30', dot: 'bg-green-500', label: 'Available' },
  occupied:    { bg: 'bg-red-50',    ring: 'ring-red-500/30',   dot: 'bg-red-500',   label: 'Charging' },
  reserved:    { bg: 'bg-yellow-50', ring: 'ring-yellow-500/30', dot: 'bg-yellow-500', label: 'Reserved' },
  maintenance: { bg: 'bg-gray-100',  ring: 'ring-gray-400/30',  dot: 'bg-gray-400',  label: 'Offline' },
};

const typeLabel: Record<string, string> = {
  level1: 'L1',
  level2: 'L2',
  dc_fast: 'DC Fast',
};

interface SlotGridProps {
  slots: ChargingSlot[];
  onSelect?: (slot: ChargingSlot) => void;
  selectable?: boolean;
}

export default function SlotGrid({ slots, onSelect, selectable = false }: SlotGridProps) {
  return (
    <div>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4 text-xs text-gray-500">
        {Object.entries(statusConfig).map(([key, cfg]) => (
          <span key={key} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {slots.map((slot) => {
          const isAvailable = slot.status === 'available';
          const canSelect = selectable && isAvailable;
          const cfg = statusConfig[slot.status] || statusConfig.maintenance;
          const session = slot.active_session;

          return (
            <button
              key={slot.id}
              onClick={() => canSelect && onSelect?.(slot)}
              disabled={!canSelect}
              className={`
                relative p-4 sm:p-5 rounded-xl ring-1 ring-inset text-left
                transition-all duration-150
                ${cfg.bg} ${cfg.ring}
                ${canSelect
                  ? 'cursor-pointer hover:shadow-md hover:ring-primary-400 active:scale-[0.98]'
                  : 'cursor-default'
                }
              `}
            >
              {/* Status dot */}
              <span className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full ${cfg.dot} ${slot.status === 'occupied' ? 'animate-pulse' : ''}`} />

              <div className="text-xl font-bold text-gray-900 tabular-nums">#{slot.slot_number}</div>

              <div className="mt-1 text-sm font-medium text-gray-600">
                {typeLabel[slot.charging_type] || slot.charging_type}
              </div>

              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-lg font-semibold text-gray-800 tabular-nums">{slot.power_output_kw}</span>
                <span className="text-xs text-gray-400">kW</span>
              </div>

              <div className="mt-1 text-xs text-gray-400 uppercase tracking-wide">
                {slot.connector_type.replace('_', ' ')}
              </div>

              {/* Active session progress */}
              {session && (
                <div className="mt-3 pt-3 border-t border-black/5">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-500 tabular-nums">{session.current_percentage}%</span>
                    <span className="text-gray-400 tabular-nums">{session.target_percentage}%</span>
                  </div>
                  <div className="w-full bg-black/5 rounded-full h-1.5">
                    <div
                      className="bg-red-400 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min((session.current_percentage / session.target_percentage) * 100, 100)}%` }}
                    />
                  </div>
                  {session.estimated_minutes_remaining != null && (
                    <p className="text-[10px] text-gray-400 mt-1 tabular-nums">
                      ~{session.estimated_minutes_remaining} min left
                    </p>
                  )}
                </div>
              )}

              {/* Selection hint for available slots */}
              {canSelect && (
                <div className="mt-3 text-xs text-primary-600 font-medium">
                  Tap to reserve
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

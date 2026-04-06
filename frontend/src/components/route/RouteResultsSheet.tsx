'use client';

import { useState, useRef, useCallback } from 'react';
import type { RoutePlan, ChargingStop } from '@/types';

interface RouteResultsSheetProps {
  plan: RoutePlan;
  onStopClick?: (stop: ChargingStop) => void;
  onClose: () => void;
}

const STOP_NUMBER_ICONS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`;
}

function BatteryMiniBar({ from, to }: { from: number; to: number }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`font-medium ${from < 20 ? 'text-red-500' : from <= 50 ? 'text-yellow-600' : 'text-green-600'}`}>
        {Math.round(from)}%
      </span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden relative">
        {/* Arrival level */}
        <div
          className={`absolute inset-y-0 left-0 rounded-full ${
            from < 20 ? 'bg-red-300' : from <= 50 ? 'bg-yellow-300' : 'bg-green-300'
          }`}
          style={{ width: `${from}%` }}
        />
        {/* Charged-to level */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-green-500"
          style={{ width: `${to}%` }}
        />
        {/* Re-draw arrival as darker overlay so the "arrive" portion is distinct */}
        <div
          className={`absolute inset-y-0 left-0 rounded-full ${
            from < 20 ? 'bg-red-400' : from <= 50 ? 'bg-yellow-400' : 'bg-green-400'
          }`}
          style={{ width: `${from}%` }}
        />
      </div>
      <span className="font-medium text-green-600">{Math.round(to)}%</span>
    </div>
  );
}

export default function RouteResultsSheet({
  plan,
  onStopClick,
  onClose,
}: RouteResultsSheetProps) {
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const dragStartY = useRef<number | null>(null);

  const handleDragStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const y = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragStartY.current = y;
  }, []);

  const handleDragEnd = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (dragStartY.current === null) return;
    const y = 'changedTouches' in e ? e.changedTouches[0].clientY : e.clientY;
    const delta = dragStartY.current - y;
    if (delta > 40) setSheetExpanded(true);
    else if (delta < -40) setSheetExpanded(false);
    dragStartY.current = null;
  }, []);

  const summaryContent = (
    <div className="grid grid-cols-4 gap-2 text-center">
      <div>
        <div className="text-lg font-bold text-gray-900">
          {Math.round(plan.totalDistanceKm)}
        </div>
        <div className="text-[10px] text-gray-500 uppercase tracking-wide">km</div>
      </div>
      <div>
        <div className="text-lg font-bold text-gray-900">{plan.totalStops}</div>
        <div className="text-[10px] text-gray-500 uppercase tracking-wide">stops</div>
      </div>
      <div>
        <div className="text-lg font-bold text-gray-900">
          {formatDuration(plan.estimatedTotalChargingMin)}
        </div>
        <div className="text-[10px] text-gray-500 uppercase tracking-wide">charging</div>
      </div>
      <div>
        <div className="text-lg font-bold text-gray-900">
          {formatCost(plan.estimatedTotalCost)}
        </div>
        <div className="text-[10px] text-gray-500 uppercase tracking-wide">est. cost</div>
      </div>
    </div>
  );

  const stopsList = (
    <div className="space-y-3">
      {plan.stops.map((stop) => (
        <button
          key={stop.stopNumber}
          type="button"
          onClick={() => onStopClick?.(stop)}
          className="card w-full text-left hover:shadow-md hover:border-gray-300 active:shadow-sm transition-all cursor-pointer p-4"
        >
          <div className="flex items-start gap-3">
            {/* Stop number badge */}
            <span className="badge-blue text-base flex-shrink-0 mt-0.5">
              {STOP_NUMBER_ICONS[stop.stopNumber - 1] ?? `#${stop.stopNumber}`}
            </span>

            <div className="flex-1 min-w-0">
              {/* Station info */}
              <h4 className="font-semibold text-gray-900 text-sm truncate">
                {stop.stationName}
              </h4>
              <p className="text-xs text-gray-500 truncate">{stop.address}</p>

              {/* Battery visualization */}
              <div className="mt-2">
                <div className="text-[11px] text-gray-500 mb-1">
                  Arrive {Math.round(stop.arrivalBatteryPct)}% &rarr; Charge to{' '}
                  {Math.round(stop.departureBatteryPct)}%
                </div>
                <BatteryMiniBar from={stop.arrivalBatteryPct} to={stop.departureBatteryPct} />
              </div>

              {/* Timing & cost row */}
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
                <span className="badge-green">
                  {formatDuration(stop.estimatedChargingMin)}
                </span>
                {stop.estimatedWaitMin > 0 && (
                  <span className="badge-blue">
                    ~{Math.round(stop.estimatedWaitMin)}min wait
                  </span>
                )}
                <span className="ml-auto font-medium text-gray-700">
                  {formatCost(stop.estimatedCost)}
                </span>
              </div>
            </div>
          </div>
        </button>
      ))}

      {/* Arrival banner */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
          <svg
            className="w-5 h-5 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <div className="text-sm font-semibold text-green-800">
            Arrive with {Math.round(plan.arrivalBatteryPct)}% battery
          </div>
          <div className="text-xs text-green-600">Destination reached</div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Large screens: side panel ── */}
      <div className="hidden lg:flex flex-col absolute right-0 top-0 bottom-0 w-[400px] bg-white border-l border-gray-200 shadow-xl z-30 animate-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">Route Plan</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Summary */}
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
          {summaryContent}
        </div>

        {/* Scrollable stops */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
          {stopsList}
        </div>
      </div>

      {/* ── Small screens: bottom sheet ── */}
      <div
        className={`lg:hidden absolute left-0 right-0 bottom-0 bg-white rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.12)] transition-all duration-300 ease-in-out z-30 flex flex-col animate-in ${
          sheetExpanded ? 'max-h-[85vh]' : 'max-h-[45vh]'
        }`}
      >
        {/* Drag handle */}
        <div
          className="flex-shrink-0 flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none"
          onTouchStart={handleDragStart}
          onTouchEnd={handleDragEnd}
          onMouseDown={handleDragStart}
          onMouseUp={handleDragEnd}
        >
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header with close */}
        <div className="flex items-center justify-between px-4 pb-3">
          <h3 className="text-sm font-semibold text-gray-900">Route Plan</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Summary */}
        <div className="px-4 pb-3 border-b border-gray-100">
          {summaryContent}
        </div>

        {/* Scrollable stops */}
        <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
          {stopsList}
        </div>
      </div>
    </>
  );
}

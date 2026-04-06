'use client';

import { useState, useEffect, useCallback } from 'react';

interface VehiclePanelProps {
  batteryPct: number;
  onBatteryChange: (pct: number) => void;
  rangeKm: number;
  onRangeChange: (km: number) => void;
  capacityKwh: number;
  onCapacityChange: (kwh: number) => void;
  onPlanRoute: () => void;
  isPending: boolean;
  canPlan: boolean;
}

const STORAGE_KEY = 'ev-route-vehicle';

interface StoredVehicle {
  batteryPct: number;
  rangeKm: number;
  capacityKwh: number;
}

function getBatteryColor(pct: number): string {
  if (pct < 20) return 'text-red-500';
  if (pct <= 50) return 'text-yellow-500';
  return 'text-green-500';
}

function getBatteryTrackGradient(pct: number): string {
  if (pct < 20) return 'from-red-500 to-red-400';
  if (pct <= 50) return 'from-yellow-500 to-yellow-400';
  return 'from-green-500 to-green-400';
}

export default function VehiclePanel({
  batteryPct,
  onBatteryChange,
  rangeKm,
  onRangeChange,
  capacityKwh,
  onCapacityChange,
  onPlanRoute,
  isPending,
  canPlan,
}: VehiclePanelProps) {
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Read initial values from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: StoredVehicle = JSON.parse(stored);
        if (typeof parsed.batteryPct === 'number') onBatteryChange(parsed.batteryPct);
        if (typeof parsed.rangeKm === 'number') onRangeChange(parsed.rangeKm);
        if (typeof parsed.capacityKwh === 'number') onCapacityChange(parsed.capacityKwh);
      }
    } catch {
      // Ignore parse errors
    }
    setMounted(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist to localStorage on change
  const persist = useCallback((battery: number, range: number, capacity: number) => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ batteryPct: battery, rangeKm: range, capacityKwh: capacity })
      );
    } catch {
      // Ignore storage errors
    }
  }, []);

  const handleBatteryChange = (pct: number) => {
    onBatteryChange(pct);
    persist(pct, rangeKm, capacityKwh);
  };

  const handleRangeChange = (km: number) => {
    onRangeChange(km);
    persist(batteryPct, km, capacityKwh);
  };

  const handleCapacityChange = (kwh: number) => {
    onCapacityChange(kwh);
    persist(batteryPct, rangeKm, kwh);
  };

  if (!mounted) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200/80 p-4 sm:p-6 animate-in">
      {/* Battery slider section */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex-1 min-w-0">
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            Current Battery
          </label>
          <div className="relative">
            <input
              type="range"
              min={0}
              max={100}
              value={batteryPct}
              onChange={(e) => handleBatteryChange(Number(e.target.value))}
              className="vehicle-battery-slider w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, ${
                  batteryPct < 20 ? '#ef4444' : batteryPct <= 50 ? '#eab308' : '#22c55e'
                } 0%, ${
                  batteryPct < 20 ? '#f87171' : batteryPct <= 50 ? '#facc15' : '#4ade80'
                } ${batteryPct}%, #e5e7eb ${batteryPct}%, #e5e7eb 100%)`,
              }}
            />
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <span className={`text-3xl font-bold tabular-nums ${getBatteryColor(batteryPct)}`}>
            {batteryPct}
          </span>
          <span className={`text-lg font-medium ${getBatteryColor(batteryPct)}`}>%</span>
        </div>
      </div>

      {/* Mobile: expandable vehicle settings */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setSettingsExpanded(!settingsExpanded)}
          className="flex items-center justify-between w-full text-sm text-gray-600 hover:text-gray-900 py-2 transition-colors"
        >
          <span className="font-medium">Vehicle settings</span>
          <svg
            className={`w-4 h-4 transition-transform duration-200 ${
              settingsExpanded ? 'rotate-180' : ''
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {settingsExpanded && (
          <div className="flex gap-3 mt-2 animate-in">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Range (km)</label>
              <input
                type="number"
                min={50}
                max={1000}
                value={rangeKm}
                onChange={(e) => handleRangeChange(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Capacity (kWh)
              </label>
              <input
                type="number"
                min={10}
                max={200}
                value={capacityKwh}
                onChange={(e) => handleCapacityChange(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow"
              />
            </div>
          </div>
        )}
      </div>

      {/* Desktop: always visible range/capacity row */}
      <div className="hidden lg:flex gap-3 mb-4">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-500 mb-1">Range (km)</label>
          <input
            type="number"
            min={50}
            max={1000}
            value={rangeKm}
            onChange={(e) => handleRangeChange(Number(e.target.value))}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-500 mb-1">Capacity (kWh)</label>
          <input
            type="number"
            min={10}
            max={200}
            value={capacityKwh}
            onChange={(e) => handleCapacityChange(Number(e.target.value))}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow"
          />
        </div>
      </div>

      {/* Plan Route button */}
      <button
        type="button"
        onClick={onPlanRoute}
        disabled={!canPlan || isPending}
        className="btn-primary w-full mt-3 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isPending ? (
          <>
            <svg
              className="animate-spin h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Planning...
          </>
        ) : (
          'Plan Route'
        )}
      </button>

      {!canPlan && (
        <p className="text-xs text-gray-400 text-center mt-2">
          Set start and end locations to plan a route
        </p>
      )}

      {/* Custom slider styles */}
      <style jsx>{`
        .vehicle-battery-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: white;
          border: 3px solid ${batteryPct < 20 ? '#ef4444' : batteryPct <= 50 ? '#eab308' : '#22c55e'};
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
          cursor: pointer;
          transition: border-color 0.15s;
        }
        .vehicle-battery-slider::-webkit-slider-thumb:hover {
          transform: scale(1.15);
        }
        .vehicle-battery-slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: white;
          border: 3px solid ${batteryPct < 20 ? '#ef4444' : batteryPct <= 50 ? '#eab308' : '#22c55e'};
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}

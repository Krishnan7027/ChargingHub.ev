'use client';

import { useState, useCallback } from 'react';
import type { OperatingHours, DayKey, DaySchedule } from '@/types';

const DAYS: { key: DayKey; label: string; short: string }[] = [
  { key: 'mon', label: 'Monday', short: 'Mon' },
  { key: 'tue', label: 'Tuesday', short: 'Tue' },
  { key: 'wed', label: 'Wednesday', short: 'Wed' },
  { key: 'thu', label: 'Thursday', short: 'Thu' },
  { key: 'fri', label: 'Friday', short: 'Fri' },
  { key: 'sat', label: 'Saturday', short: 'Sat' },
  { key: 'sun', label: 'Sunday', short: 'Sun' },
];

const DEFAULT_TIME: DaySchedule = { open: '09:00', close: '21:00' };

interface Props {
  value: OperatingHours;
  onChange: (value: OperatingHours) => void;
}

export default function OperatingHoursEditor({ value, onChange }: Props) {
  const [applyAll, setApplyAll] = useState(true);
  const [sharedTime, setSharedTime] = useState<DaySchedule>(DEFAULT_TIME);

  const isScheduled = value.type === 'SCHEDULED';
  const schedule = value.schedule || {};

  const setType = useCallback((type: 'ALWAYS_OPEN' | 'SCHEDULED') => {
    if (type === 'ALWAYS_OPEN') {
      onChange({ type: 'ALWAYS_OPEN', schedule: null });
    } else {
      // Initialize with weekdays selected
      const initial: Partial<Record<DayKey, DaySchedule>> = {};
      for (const d of DAYS.slice(0, 5)) {
        initial[d.key] = { ...DEFAULT_TIME };
      }
      onChange({ type: 'SCHEDULED', schedule: initial });
    }
  }, [onChange]);

  const toggleDay = useCallback((day: DayKey) => {
    const next = { ...schedule };
    if (next[day]) {
      delete next[day];
    } else {
      next[day] = applyAll ? { ...sharedTime } : { ...DEFAULT_TIME };
    }
    onChange({ type: 'SCHEDULED', schedule: next });
  }, [schedule, onChange, applyAll, sharedTime]);

  const updateDayTime = useCallback((day: DayKey, field: 'open' | 'close', val: string) => {
    const next = { ...schedule };
    if (!next[day]) return;
    next[day] = { ...next[day]!, [field]: val };
    onChange({ type: 'SCHEDULED', schedule: next });
  }, [schedule, onChange]);

  const applySharedTime = useCallback(() => {
    const next: Partial<Record<DayKey, DaySchedule>> = {};
    for (const day of Object.keys(schedule) as DayKey[]) {
      next[day] = { ...sharedTime };
    }
    onChange({ type: 'SCHEDULED', schedule: next });
  }, [schedule, sharedTime, onChange]);

  const selectedDays = Object.keys(schedule) as DayKey[];

  return (
    <div className="space-y-4">
      {/* Type selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Operating Hours</label>
        <select
          className="input"
          value={value.type}
          onChange={(e) => setType(e.target.value as 'ALWAYS_OPEN' | 'SCHEDULED')}
        >
          <option value="ALWAYS_OPEN">Always Open (24/7)</option>
          <option value="SCHEDULED">Scheduled</option>
        </select>
      </div>

      {isScheduled && (
        <div className="bg-gray-50 rounded-xl p-4 space-y-4 border border-gray-200">
          {/* Day selector */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Open days</p>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((d) => {
                const active = !!schedule[d.key];
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => toggleDay(d.key)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? 'bg-primary-600 text-white shadow-sm'
                        : 'bg-white text-gray-500 border border-gray-300 hover:border-primary-400'
                    }`}
                  >
                    {d.short}
                  </button>
                );
              })}
            </div>
          </div>

          {selectedDays.length > 0 && (
            <>
              {/* Apply same time toggle */}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyAll}
                    onChange={(e) => setApplyAll(e.target.checked)}
                    className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-600">Same hours for all days</span>
                </label>
              </div>

              {applyAll ? (
                /* Shared time picker */
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Open</label>
                    <input
                      type="time"
                      className="input"
                      value={sharedTime.open}
                      onChange={(e) => {
                        setSharedTime({ ...sharedTime, open: e.target.value });
                      }}
                    />
                  </div>
                  <span className="pb-2.5 text-gray-400">—</span>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Close</label>
                    <input
                      type="time"
                      className="input"
                      value={sharedTime.close}
                      onChange={(e) => {
                        setSharedTime({ ...sharedTime, close: e.target.value });
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={applySharedTime}
                    className="btn-secondary text-sm py-2 px-3 whitespace-nowrap"
                  >
                    Apply
                  </button>
                </div>
              ) : (
                /* Per-day time pickers */
                <div className="space-y-2">
                  {DAYS.filter((d) => schedule[d.key]).map((d) => (
                    <div key={d.key} className="flex items-center gap-3">
                      <span className="w-10 text-sm font-medium text-gray-600">{d.short}</span>
                      <input
                        type="time"
                        className="input flex-1"
                        value={schedule[d.key]?.open || '09:00'}
                        onChange={(e) => updateDayTime(d.key, 'open', e.target.value)}
                      />
                      <span className="text-gray-400">—</span>
                      <input
                        type="time"
                        className="input flex-1"
                        value={schedule[d.key]?.close || '21:00'}
                        onChange={(e) => updateDayTime(d.key, 'close', e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Summary */}
              <p className="text-xs text-gray-400">
                {selectedDays.length} day{selectedDays.length !== 1 ? 's' : ''} selected
              </p>
            </>
          )}

          {selectedDays.length === 0 && (
            <p className="text-sm text-red-500">Select at least one day</p>
          )}
        </div>
      )}
    </div>
  );
}

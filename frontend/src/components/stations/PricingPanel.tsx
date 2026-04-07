'use client';

import { useCurrentPrice, usePricingSchedule } from '@/hooks/useIntelligent';
import { useCountry } from '@/context/CountryContext';
import { formatPricePerKwh } from '@/lib/formatCurrency';

export default function PricingPanel({ stationId }: { stationId: string }) {
  const { data: current } = useCurrentPrice(stationId);
  const { data: schedule } = usePricingSchedule(stationId);

  const { country } = useCountry();

  if (!current && !schedule) return null;

  return (
    <div className="card">
      <h3 className="font-semibold mb-3 flex items-center gap-2">
        <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Pricing
      </h3>

      {current && (
        <div className="bg-green-500/10 border border-green-200 rounded-lg p-3 mb-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-theme-secondary">Current Rate</span>
            <span className="text-lg font-bold text-green-700">{formatPricePerKwh(current.pricePerKwh, country)}</span>
          </div>
          <p className="text-xs text-green-600 mt-1">{current.ruleName}</p>
        </div>
      )}

      {schedule?.rules && schedule.rules.length > 1 && (
        <div>
          <p className="text-sm font-medium text-theme-secondary mb-2">Price Schedule</p>
          <div className="space-y-1.5">
            {schedule.rules.map((rule) => (
              <div key={rule.id} className="flex items-center justify-between text-sm py-1.5 border-b border-glass last:border-0">
                <div>
                  <span className="font-medium">{rule.name}</span>
                  <span className="text-theme-muted ml-2 text-xs">
                    {rule.startTime}–{rule.endTime} ({rule.days.join(', ')})
                  </span>
                </div>
                <span className="font-semibold">{formatPricePerKwh(rule.pricePerKwh, country)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

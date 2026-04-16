'use client';

import { useState } from 'react';
import Navbar from '@/components/layout/Navbar';
import PageTransition from '@/components/ui/PageTransition';
import HeatmapMap from '@/components/mobility/HeatmapMap';
import InfrastructurePlanningPanel from '@/components/mobility/InfrastructurePlanningPanel';
import ChargingBehaviorPanel from '@/components/mobility/ChargingBehaviorPanel';
import { useHeatmapData, useCityTrends, useAvailableCities } from '@/hooks/useIntelligent';
import type { CityEvTrend } from '@/types';

function GrowthBadge({ value }: { value: number }) {
  const v = Number(value);
  if (v === 0) return <span className="text-[10px] text-theme-muted">--</span>;
  const positive = v > 0;
  return (
    <span className={`text-[10px] font-medium ${positive ? 'text-green-600' : 'text-red-600'}`}>
      {positive ? '+' : ''}{v.toFixed(1)}%
    </span>
  );
}

function CityTrendCard({ trend }: { trend: CityEvTrend }) {
  return (
    <div className="border border-glass rounded-lg p-4 bg-white">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-theme-primary">{trend.city}</h4>
        <span className="text-[10px] text-theme-muted">{new Date(trend.stat_month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <div>
          <p className="text-[10px] text-theme-secondary">Active Users</p>
          <p className="text-lg font-bold text-theme-primary">{trend.active_users}</p>
          <GrowthBadge value={trend.user_growth_pct} />
        </div>
        <div>
          <p className="text-[10px] text-theme-secondary">Sessions</p>
          <p className="text-lg font-bold text-blue-600">{trend.total_sessions}</p>
          <GrowthBadge value={trend.session_growth_pct} />
        </div>
        <div>
          <p className="text-[10px] text-theme-secondary">Energy (kWh)</p>
          <p className="text-lg font-bold text-green-600">{Number(trend.total_energy_kwh).toFixed(0)}</p>
          <GrowthBadge value={trend.energy_growth_pct} />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        <div className="p-1.5 bg-theme-secondary rounded">
          <p className="text-xs font-medium text-theme-secondary">{trend.total_stations}</p>
          <p className="text-[9px] text-theme-muted">Stations</p>
        </div>
        <div className="p-1.5 bg-theme-secondary rounded">
          <p className="text-xs font-medium text-theme-secondary">{trend.total_slots}</p>
          <p className="text-[9px] text-theme-muted">Slots</p>
        </div>
        <div className="p-1.5 bg-theme-secondary rounded">
          <p className="text-xs font-medium text-theme-secondary">${Number(trend.total_revenue).toFixed(0)}</p>
          <p className="text-[9px] text-theme-muted">Revenue</p>
        </div>
        <div className="p-1.5 bg-theme-secondary rounded">
          <p className="text-xs font-medium text-green-600">{Number(trend.total_carbon_saved_kg).toFixed(0)}</p>
          <p className="text-[9px] text-theme-muted">kg CO2</p>
        </div>
      </div>
    </div>
  );
}

export default function SmartCityDashboard() {
  const [heatmapMode, setHeatmapMode] = useState<'demand' | 'gap'>('demand');
  const [selectedCity, setSelectedCity] = useState<string>('');

  const { data: citiesData } = useAvailableCities();
  const { data: heatmapData, isLoading: heatmapLoading } = useHeatmapData();
  const { data: trendsData, isLoading: trendsLoading } = useCityTrends({
    city: selectedCity || undefined,
  });

  return (
    <>
      <Navbar />
      <PageTransition>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-theme-primary">Smart City Dashboard</h1>
          <p className="text-theme-secondary mt-1">EV mobility intelligence, infrastructure planning, and adoption trends</p>
        </div>

        {/* Heatmap Section */}
        <div className="card mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
              </svg>
              <h2 className="text-xl font-bold text-theme-primary">EV Charging Heatmap</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setHeatmapMode('demand')}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                  heatmapMode === 'demand' ? 'bg-primary-600 text-white' : 'glass text-theme-secondary hover:bg-[var(--border-default)]'
                }`}
              >
                Demand
              </button>
              <button
                onClick={() => setHeatmapMode('gap')}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                  heatmapMode === 'gap' ? 'bg-red-600 text-white' : 'glass text-theme-secondary hover:bg-[var(--border-default)]'
                }`}
              >
                Infrastructure Gap
              </button>
            </div>
          </div>

          {heatmapLoading ? (
            <div className="flex items-center justify-center h-[400px]">
              <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
            </div>
          ) : heatmapData && heatmapData.cells.length > 0 ? (
            <HeatmapMap
              cells={heatmapData.cells}
              mode={heatmapMode}
              className="h-[450px]"
            />
          ) : (
            <div className="flex items-center justify-center h-[400px] bg-theme-secondary rounded-lg">
              <div className="text-center">
                <p className="text-theme-secondary mb-2">No heatmap data available yet</p>
                <p className="text-xs text-theme-muted">Run heatmap aggregation to generate charging density visualization</p>
              </div>
            </div>
          )}
        </div>

        {/* City Trends + Behavior side by side */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* City EV Adoption Trends */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                <h3 className="font-semibold text-theme-primary">EV Adoption Trends</h3>
              </div>
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="input text-sm py-1.5 w-40"
              >
                <option value="">All Cities</option>
                {citiesData?.cities?.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {trendsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin w-6 h-6 border-3 border-primary-600 border-t-transparent rounded-full" />
              </div>
            ) : trendsData && trendsData.trends.length > 0 ? (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {trendsData.trends.map((t) => (
                  <CityTrendCard key={`${t.city}-${t.stat_month}`} trend={t} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-theme-muted text-center py-12">
                No trend data available. Run monthly aggregation to generate city-level adoption metrics.
              </p>
            )}
          </div>

          {/* Charging Behavior */}
          <ChargingBehaviorPanel />
        </div>

        {/* Infrastructure Planning */}
        <div className="mb-8">
          <InfrastructurePlanningPanel />
        </div>
      </div>
      </PageTransition>
    </>
  );
}

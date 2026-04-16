'use client';

import { useState } from 'react';
import Navbar from '@/components/layout/Navbar';
import PageTransition from '@/components/ui/PageTransition';
import ProtectedRoute from '@/components/ui/ProtectedRoute';
import { usePlatformCarbon, usePlatformOptimization } from '@/hooks/useIntelligent';

function StatCard({ label, value, unit, color }: { label: string; value: string | number; unit?: string; color: string }) {
  return (
    <div className="card">
      <p className="text-xs text-theme-secondary">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>
        {value}{unit && <span className="text-sm font-normal ml-1">{unit}</span>}
      </p>
    </div>
  );
}

export default function EnergyDashboardPage() {
  const { data: carbon, isLoading: carbonLoading } = usePlatformCarbon();
  const { data: optimization, isLoading: optLoading } = usePlatformOptimization();

  const isLoading = carbonLoading || optLoading;

  return (
    <ProtectedRoute roles={['admin']}>
      <Navbar />
      <PageTransition>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Energy Intelligence</h1>
          <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">
            Smart Energy Platform
          </span>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <div key={i} className="card h-24 animate-pulse glass" />)}
          </div>
        ) : (
          <>
            {/* Carbon Impact Summary */}
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Carbon Impact
            </h2>
            {carbon?.totals ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <StatCard label="Total CO₂ Saved" value={carbon.totals.carbonSavedKg.toFixed(1)} unit="kg" color="text-green-600" />
                <StatCard label="Total Energy" value={carbon.totals.energyKwh.toFixed(0)} unit="kWh" color="text-blue-600" />
                <StatCard label="Trees Equivalent" value={carbon.totals.treesEquivalent.toFixed(1)} color="text-emerald-600" />
                <StatCard label="Gas Miles Offset" value={carbon.totals.milesOffset.toFixed(0)} unit="mi" color="text-purple-600" />
              </div>
            ) : (
              <div className="card text-center py-6 text-theme-muted text-sm mb-8">No carbon data yet</div>
            )}

            {/* Grid Status Overview */}
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Grid Status Overview
            </h2>
            {optimization?.gridOverview && optimization.gridOverview.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {optimization.gridOverview.map((g) => (
                  <div key={g.grid_status} className="card">
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-3 h-3 rounded-full ${
                        g.grid_status === 'normal' ? 'bg-green-500' :
                        g.grid_status === 'warning' ? 'bg-yellow-500' :
                        g.grid_status === 'critical' ? 'bg-orange-500' : 'bg-red-500'
                      }`} />
                      <span className="text-xs text-theme-secondary capitalize">{g.grid_status}</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-800">{g.count}</p>
                    <p className="text-[10px] text-theme-muted">stations &middot; avg {g.avg_load_pct}% load</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card text-center py-6 text-theme-muted text-sm mb-8">No grid data yet</div>
            )}

            {/* Optimization Recommendations */}
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Active Recommendations
            </h2>
            {optimization?.recommendations && optimization.recommendations.length > 0 ? (
              <div className="space-y-3">
                {optimization.recommendations.map((rec, i) => (
                  <div key={i} className="card flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      rec.priority === 'critical' ? 'bg-red-100 text-red-600' :
                      rec.priority === 'high' ? 'bg-orange-100 text-orange-600' :
                      rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-600' : 'glass text-theme-secondary'
                    }`}>
                      <span className="text-sm font-bold">{rec.count}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800 capitalize">
                        {rec.recommendation_type.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-theme-secondary">
                        Priority: {rec.priority} &middot;
                        {Number(rec.total_savings_kwh) > 0 && ` ${Number(rec.total_savings_kwh).toFixed(0)} kWh savings &middot;`}
                        {Number(rec.total_cost_savings) > 0 && ` $${Number(rec.total_cost_savings).toFixed(2)} cost savings`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card text-center py-6 text-theme-muted text-sm">No active recommendations</div>
            )}
          </>
        )}
      </div>
      </PageTransition>
    </ProtectedRoute>
  );
}

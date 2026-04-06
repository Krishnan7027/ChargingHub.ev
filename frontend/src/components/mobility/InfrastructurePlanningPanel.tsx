'use client';

import { useState } from 'react';
import { useInfraRecommendations, useGenerateInfraRecommendations, useAvailableCities } from '@/hooks/useIntelligent';
import type { InfraRecommendation } from '@/types';

const statusColors: Record<string, string> = {
  proposed: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  built: 'bg-purple-100 text-purple-700',
};

function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between mb-0.5">
        <span className="text-[10px] text-gray-500">{label}</span>
        <span className="text-[10px] font-medium text-gray-700">{Math.round(score)}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function RecommendationCard({ rec }: { rec: InfraRecommendation }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-gray-900">{rec.city || 'Unknown'}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColors[rec.status] || 'bg-gray-100 text-gray-600'}`}>
              {rec.status}
            </span>
          </div>
          <p className="text-xs text-gray-500">
            {rec.latitude.toFixed(4)}, {rec.longitude.toFixed(4)}
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-primary-600">{Math.round(rec.overall_score)}</div>
          <p className="text-[9px] text-gray-400">score</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <ScoreBar label="Demand" score={rec.demand_score} color="bg-orange-500" />
        <ScoreBar label="Coverage Gap" score={rec.coverage_gap_score} color="bg-red-500" />
        <ScoreBar label="Traffic" score={rec.traffic_score} color="bg-blue-500" />
      </div>

      <div className="flex flex-wrap gap-2 mb-2 text-[11px] text-gray-600">
        <span>{rec.recommended_slots} slots recommended</span>
        <span>&middot;</span>
        <span>~{rec.estimated_daily_sessions} sessions/day</span>
        {rec.nearest_station_km && (
          <>
            <span>&middot;</span>
            <span>{rec.nearest_station_km.toFixed(1)} km to nearest</span>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-1 mb-2">
        {rec.recommended_charger_types?.map((t) => (
          <span key={t} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
            {t.replace('_', ' ')}
          </span>
        ))}
      </div>

      {expanded && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <p className="text-xs text-gray-600 mb-1">{rec.area_description}</p>
          <p className="text-xs text-gray-500 italic">{rec.reason}</p>
        </div>
      )}

      <button
        onClick={() => setExpanded(!expanded)}
        className="text-[11px] text-primary-500 hover:text-primary-700 mt-1"
      >
        {expanded ? 'Show less' : 'Show details'}
      </button>
    </div>
  );
}

export default function InfrastructurePlanningPanel() {
  const { data: citiesData } = useAvailableCities();
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data, isLoading } = useInfraRecommendations({
    city: selectedCity || undefined,
    status: statusFilter || undefined,
    limit: 20,
  });

  const generate = useGenerateInfraRecommendations();

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <h3 className="font-semibold text-gray-900">Infrastructure Planning</h3>
        </div>
        <button
          onClick={() => generate.mutate({ city: selectedCity || undefined })}
          disabled={generate.isPending}
          className="btn-primary text-xs py-1.5 px-3"
        >
          {generate.isPending ? 'Analyzing...' : 'Generate Recommendations'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <select
          value={selectedCity}
          onChange={(e) => setSelectedCity(e.target.value)}
          className="input text-sm py-1.5 flex-1"
        >
          <option value="">All Cities</option>
          {citiesData?.cities?.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input text-sm py-1.5 w-36"
        >
          <option value="">All Statuses</option>
          <option value="proposed">Proposed</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="built">Built</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin w-6 h-6 border-3 border-primary-600 border-t-transparent rounded-full" />
        </div>
      ) : data && data.recommendations.length > 0 ? (
        <div className="space-y-3">
          {data.recommendations.map((rec) => (
            <RecommendationCard key={rec.id} rec={rec} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400 text-center py-8">
          No infrastructure recommendations yet. Click &quot;Generate Recommendations&quot; to analyze coverage gaps.
        </p>
      )}
    </div>
  );
}

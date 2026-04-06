'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import StationCard from '@/components/stations/StationCard';
import RecommendationCard from '@/components/stations/RecommendationCard';
import StationMap from '@/components/map/StationMap';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useNearbyStations, useSearchStations } from '@/hooks/useStations';
import { useRecommendations } from '@/hooks/useIntelligent';
import { useCountry } from '@/context/CountryContext';

export default function MapPage() {
  const router = useRouter();
  const { country } = useCountry();
  const { position, error: geoError, loading: geoLoading, refresh: refreshGeo } = useGeolocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchParams, setSearchParams] = useState<Record<string, string>>({});
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [useFallback, setUseFallback] = useState(false);

  const hasPosition = !!position;
  const center = position
    ? { lat: position.latitude, lng: position.longitude }
    : country.defaultCenter;

  const { data: nearbyStations, isLoading: nearbyLoading } = useNearbyStations(
    hasPosition ? position.latitude : (useFallback ? country.defaultCenter.lat : null),
    hasPosition ? position.longitude : (useFallback ? country.defaultCenter.lng : null),
  );

  const { data: searchResult, isLoading: searchLoading } = useSearchStations(searchParams);
  const { data: recommendations } = useRecommendations({
    latitude: position?.latitude ?? (useFallback ? country.defaultCenter.lat : null),
    longitude: position?.longitude ?? (useFallback ? country.defaultCenter.lng : null),
  });

  const stations = searchParams.query ? (searchResult?.stations ?? []) : (nearbyStations ?? []);
  const loading = searchParams.query ? searchLoading : nearbyLoading;

  const handleSearch = useCallback(() => {
    if (!searchQuery.trim()) return;
    setSearchParams({ query: searchQuery.trim() });
  }, [searchQuery]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchParams({});
  }, []);

  const showLocating = geoLoading && !useFallback;
  const showGeoError = geoError && !useFallback && !geoLoading;
  const showMap = !showLocating && !showGeoError;

  // ── Station list content (shared between layouts) ──────
  const stationList = (
    <div className="space-y-3">
      {/* Nearby / Smart Picks toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowRecommendations(false)}
          className={`text-sm font-medium px-3 py-1.5 rounded-full transition-colors ${
            !showRecommendations ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Nearby
        </button>
        <button
          onClick={() => setShowRecommendations(true)}
          className={`text-sm font-medium px-3 py-1.5 rounded-full transition-colors ${
            showRecommendations ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Smart Picks
        </button>
      </div>

      {/* AI top pick banner */}
      {recommendations?.topPick && !showRecommendations && (
        <button
          onClick={() => setShowRecommendations(true)}
          className="w-full bg-primary-50 border border-primary-200 rounded-xl p-3 text-left hover:bg-primary-100 transition-colors"
        >
          <p className="text-xs text-primary-600 font-medium mb-0.5">AI Recommended</p>
          <p className="font-semibold text-sm">{recommendations.topPick.name}</p>
          <p className="text-xs text-gray-500">
            {recommendations.topPick.distanceKm} km &middot; {recommendations.topPick.speedLabel} &middot;{' '}
            {recommendations.topPick.estimatedWaitMin === 0 ? 'No wait' : `~${recommendations.topPick.estimatedWaitMin} min wait`}
          </p>
        </button>
      )}

      {/* Count */}
      <p className="text-xs text-gray-400">
        {showRecommendations
          ? `${recommendations?.recommendations?.length ?? 0} recommendations`
          : `${stations.length} station${stations.length !== 1 ? 's' : ''} found`}
      </p>

      {/* Station cards */}
      {showRecommendations ? (
        recommendations?.recommendations?.length ? (
          recommendations.recommendations.map((rec, i) => (
            <RecommendationCard key={rec.stationId} rec={rec} rank={i + 1} />
          ))
        ) : (
          <EmptyList message="Enable location to get smart recommendations" />
        )
      ) : loading ? (
        <LoadingSkeleton />
      ) : stations.length === 0 ? (
        <EmptyList message="No stations found in this area" />
      ) : (
        stations.map((station) => (
          <StationCard key={station.id} station={station} userLocation={position ? { lat: position.latitude, lng: position.longitude } : null} />
        ))
      )}
    </div>
  );

  return (
    <>
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* ── Page header + Search ──────────────────────────── */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Find Charging Stations</h1>
          <p className="text-sm text-gray-500">Discover nearby EV charging stations</p>
        </div>

        {/* Search bar */}
        <div className="mb-6">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                className="input pl-10 pr-9 rounded-xl"
                placeholder="Search by city, station name, or address..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (!e.target.value.trim()) setSearchParams({});
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchQuery && (
                <button onClick={clearSearch} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <button onClick={handleSearch} className="btn-primary hidden sm:block">Search</button>
          </div>
        </div>

        {/* ── Location banner (error / denied) ─────────────── */}
        {showGeoError && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-800">Location access denied</p>
              <p className="text-xs text-yellow-600 mt-0.5">Showing default area (San Francisco). Allow location for better results.</p>
            </div>
            <button onClick={() => setUseFallback(true)} className="btn-primary text-sm py-1.5 px-3 whitespace-nowrap">
              Use Default
            </button>
          </div>
        )}

        {/* ── Main layout: Map + Station List ──────────────── */}
        <div className="flex flex-col lg:flex-row gap-6">

          {/* ── Map container ────────────────────────────────── */}
          <div className="lg:w-[65%] lg:flex-shrink-0">
            <div className="bg-white rounded-2xl shadow-md overflow-hidden border border-gray-200 relative">
              {showLocating ? (
                <div className="flex items-center justify-center h-[280px] sm:h-[380px] lg:h-[520px] bg-gray-50">
                  <div className="text-center">
                    <svg className="w-10 h-10 mx-auto mb-3 text-primary-600 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <p className="text-gray-600 font-medium text-sm">Detecting your location...</p>
                    <p className="text-gray-400 text-xs mt-1">This may take a moment</p>
                  </div>
                </div>
              ) : (
                <StationMap
                  stations={stations}
                  center={center}
                  onStationClick={(s) => router.push(`/stations/${s.id}`)}
                  className="h-[280px] sm:h-[380px] lg:h-[520px]"
                  currencySymbol={country.currencySymbol}
                />
              )}

              {/* Re-center / My Location button */}
              {showMap && (
                <button
                  onClick={() => {
                    if (position) {
                      refreshGeo();
                    } else {
                      setUseFallback(true);
                    }
                  }}
                  className="absolute bottom-4 right-4 z-[500] bg-white shadow-lg border border-gray-200 rounded-xl px-3 py-2 flex items-center gap-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  title={position ? 'Re-center on your location' : 'Use current location'}
                >
                  <svg className="w-4 h-4 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {position ? 'Re-center' : 'My Location'}
                </button>
              )}
            </div>

            {/* Location status chip below map */}
            {showMap && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-400">
                <span className={`w-1.5 h-1.5 rounded-full ${position ? 'bg-green-500' : 'bg-yellow-500'}`} />
                {position ? 'Using your location' : `Using default location (${country.name})`}
              </div>
            )}
          </div>

          {/* ── Station list sidebar ─────────────────────────── */}
          <div className="lg:w-[35%] lg:max-h-[560px] lg:overflow-y-auto lg:scrollbar-hide">
            {stationList}
          </div>
        </div>
      </main>
    </>
  );
}

// ── Small helper components ──────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="card animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
          <div className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
          <div className="h-3 bg-gray-200 rounded w-1/3" />
        </div>
      ))}
    </div>
  );
}

function EmptyList({ message }: { message: string }) {
  return (
    <div className="text-center py-10 text-gray-500">
      <svg className="w-10 h-10 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      </svg>
      <p className="text-sm">{message}</p>
    </div>
  );
}

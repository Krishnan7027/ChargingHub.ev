'use client';

import Link from 'next/link';
import { useCountry } from '@/context/CountryContext';
import { formatPricePerKwh } from '@/lib/formatCurrency';
import type { Station } from '@/types';

interface StationCardProps {
  station: Station;
  userLocation?: { lat: number; lng: number } | null;
}

export default function StationCard({ station, userLocation }: StationCardProps) {
  const { country } = useCountry();
  const distanceKm = station.distance_meters
    ? (station.distance_meters / 1000).toFixed(1)
    : null;
  const available = station.available_slots ?? 0;
  const total = station.total_slots ?? 0;
  const hasSlots = available > 0;

  const hasCoords = station.latitude != null && station.longitude != null;

  function handleGetDirections(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const dest = `${station.latitude},${station.longitude}`;
    let url: string;

    if (userLocation) {
      url = `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${dest}&travelmode=driving`;
    } else {
      // Fallback: destination only (Google Maps will use device location)
      url = `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
    }

    window.open(url, '_blank');
  }

  return (
    <Link
      href={`/stations/${station.id}`}
      className="card-interactive group block"
    >
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 truncate">{station.name}</h3>
            {station.rating > 0 && (
              <span className="flex items-center gap-0.5 text-sm text-yellow-600 flex-shrink-0">
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                {Number(station.rating).toFixed(1)}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5 truncate">{station.address}, {station.city}</p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {distanceKm && (
            <span className="text-xs text-gray-400 tabular-nums">{distanceKm} km</span>
          )}
          <svg className="w-4 h-4 text-gray-300 group-hover:text-primary-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${hasSlots ? 'text-green-600' : 'text-red-500'}`}>
            <span className={`w-2 h-2 rounded-full ${hasSlots ? 'bg-green-500' : 'bg-red-400'}`} />
            {available}/{total} available
          </span>
          {station.pricing_per_kwh && (
            <span className="text-sm text-gray-400">{formatPricePerKwh(station.pricing_per_kwh, country)}</span>
          )}
        </div>

        {hasCoords && (
          <button
            onClick={handleGetDirections}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-xl px-3 py-1.5 transition-colors"
            title="Open in Google Maps"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="hidden sm:inline">Directions</span>
          </button>
        )}
      </div>
    </Link>
  );
}

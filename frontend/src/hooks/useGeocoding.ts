'use client';

import { useState, useRef, useCallback } from 'react';

export interface GeocodingResult {
  displayName: string;
  shortName: string;
  lat: number;
  lng: number;
}

interface UseGeocodingReturn {
  results: GeocodingResult[];
  isSearching: boolean;
  error: string | null;
  search: (query: string) => void;
  clear: () => void;
}

/**
 * Debounced geocoding via OpenStreetMap Nominatim.
 * Free, no API key, 1 req/s rate limit (enforced by 300ms debounce + abort).
 */
export function useGeocoding(debounceMs = 300, countryCode = 'in'): UseGeocodingReturn {
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback((query: string) => {
    // Clear previous
    if (timerRef.current) clearTimeout(timerRef.current);
    if (abortRef.current) abortRef.current.abort();

    if (!query || query.trim().length < 3) {
      setResults([]);
      setIsSearching(false);
      setError(null);
      return;
    }

    setIsSearching(true);
    setError(null);

    timerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const params = new URLSearchParams({
          q: query.trim(),
          format: 'json',
          limit: '5',
          countrycodes: countryCode.toLowerCase(),
          addressdetails: '1',
        });

        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?${params}`,
          {
            signal: controller.signal,
            headers: { 'Accept-Language': 'en' },
          },
        );

        if (!res.ok) {
          if (res.status === 429) {
            setError('Too many searches — wait a moment');
          } else {
            setError('Search failed');
          }
          setResults([]);
          setIsSearching(false);
          return;
        }

        const data = await res.json();

        const mapped: GeocodingResult[] = data.map((item: any) => {
          const addr = item.address || {};
          const parts = [
            addr.road || addr.pedestrian || addr.neighbourhood,
            addr.city || addr.town || addr.village,
            addr.state,
          ].filter(Boolean);

          return {
            displayName: item.display_name,
            shortName: parts.join(', ') || item.display_name.split(',').slice(0, 2).join(','),
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
          };
        });

        setResults(mapped);
        setError(null);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setError('Search failed — check your connection');
          setResults([]);
        }
      } finally {
        setIsSearching(false);
      }
    }, debounceMs);
  }, [debounceMs, countryCode]);

  const clear = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (abortRef.current) abortRef.current.abort();
    setResults([]);
    setIsSearching(false);
    setError(null);
  }, []);

  return { results, isSearching, error, search, clear };
}

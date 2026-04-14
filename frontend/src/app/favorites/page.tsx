'use client';

import { useFavorites } from '@/hooks/useFavorites';
import { useToggleFavorite } from '@/hooks/useFavorites';
import Link from 'next/link';

export default function FavoritesPage() {
  const { data: favorites, isLoading, error } = useFavorites();
  const { remove, isLoading: removing } = useToggleFavorite();

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6 dark:text-white">My Favorite Stations</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6 dark:text-white">My Favorite Stations</h1>
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl p-6">
          Failed to load favorites. Please try again.
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6 dark:text-white">My Favorite Stations</h1>

      {!favorites || favorites.length === 0 ? (
        <div className="text-center py-16">
          <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
          <p className="text-gray-500 dark:text-gray-400 text-lg mb-2">No favorites yet</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mb-6">
            Tap the heart icon on any station to save it here
          </p>
          <Link
            href="/map"
            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            Explore Stations
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {favorites.map((fav) => (
            <div
              key={fav.id}
              className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-3">
                <Link href={`/stations/${fav.station_id}`} className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 dark:text-white truncate hover:text-green-600 dark:hover:text-green-400 transition">
                    {fav.station_name}
                  </h3>
                </Link>
                <button
                  type="button"
                  onClick={() => remove.mutate(fav.station_id)}
                  disabled={removing}
                  className="ml-2 w-8 h-8 flex items-center justify-center rounded-full bg-red-50 text-red-500 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 transition"
                  aria-label="Remove from favorites"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                  </svg>
                </button>
              </div>

              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{fav.station_address}</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mb-3">{fav.station_city}</p>

              <div className="flex items-center justify-between">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  fav.station_status === 'approved'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                }`}>
                  {fav.station_status === 'approved' ? 'Active' : fav.station_status}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {fav.available_slots}/{fav.total_slots} slots free
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

import { useFavoriteStatus, useToggleFavorite } from '@/hooks/useFavorites';

interface FavoriteButtonProps {
  stationId: string;
  size?: 'sm' | 'md' | 'lg';
  showCount?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
};

const iconSizes = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
};

export default function FavoriteButton({
  stationId,
  size = 'md',
  showCount = false,
  className = '',
}: FavoriteButtonProps) {
  const { data: status, isLoading: statusLoading } = useFavoriteStatus(stationId);
  const { toggle, isLoading: toggling } = useToggleFavorite();

  const isFavorited = status?.isFavorited ?? false;
  const totalFavorites = status?.totalFavorites ?? 0;

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!statusLoading && !toggling) {
            toggle(stationId, isFavorited);
          }
        }}
        disabled={statusLoading || toggling}
        className={`
          ${sizeClasses[size]} rounded-full flex items-center justify-center
          transition-all duration-200 ease-in-out
          ${isFavorited
            ? 'bg-red-50 text-red-500 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30'
            : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-red-400 dark:bg-gray-800 dark:hover:bg-gray-700'
          }
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
        aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
        title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
      >
        {toggling ? (
          <svg className={`${iconSizes[size]} animate-spin`} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg
            className={`${iconSizes[size]} transition-transform ${isFavorited ? 'scale-110' : 'scale-100'}`}
            fill={isFavorited ? 'currentColor' : 'none'}
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
            />
          </svg>
        )}
      </button>
      {showCount && totalFavorites > 0 && (
        <span className="text-xs text-gray-500 dark:text-gray-400">{totalFavorites}</span>
      )}
    </div>
  );
}

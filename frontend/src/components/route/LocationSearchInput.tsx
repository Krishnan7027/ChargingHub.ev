'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useGeocoding } from '@/hooks/useGeocoding';
import { useCountry } from '@/context/CountryContext';

interface LocationSearchInputProps {
  label: string;
  placeholder: string;
  value: { displayName: string; lat: number; lng: number } | null;
  onChange: (location: { displayName: string; lat: number; lng: number } | null) => void;
  onUseMyLocation?: () => void;
  icon?: 'start' | 'end';
}

export default function LocationSearchInput({
  label,
  placeholder,
  value,
  onChange,
  onUseMyLocation,
  icon,
}: LocationSearchInputProps) {
  const { country } = useCountry();
  const { results, isSearching, error, search, clear } = useGeocoding(300, country.code);
  const [inputText, setInputText] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync input text when value changes externally (e.g. "Use my location")
  useEffect(() => {
    if (value) {
      setInputText(value.displayName);
    } else {
      setInputText('');
    }
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        clear();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [clear]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const text = e.target.value;
      setInputText(text);
      setHighlightedIndex(-1);

      if (text.trim().length >= 3) {
        search(text);
        setIsOpen(true);
      } else {
        clear();
        setIsOpen(false);
      }

      // If user edits text after selecting, clear the selected value
      if (value) {
        onChange(null);
      }
    },
    [search, clear, value, onChange],
  );

  const handleSelect = useCallback(
    (result: { displayName: string; shortName: string; lat: number; lng: number }) => {
      onChange({ displayName: result.displayName, lat: result.lat, lng: result.lng });
      setInputText(result.shortName);
      setIsOpen(false);
      setHighlightedIndex(-1);
      clear();
    },
    [onChange, clear],
  );

  const handleClear = useCallback(() => {
    setInputText('');
    onChange(null);
    clear();
    setIsOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  }, [onChange, clear]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen || results.length === 0) {
        if (e.key === 'Escape') {
          setIsOpen(false);
          clear();
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < results.length) {
            handleSelect(results[highlightedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          clear();
          break;
      }
    },
    [isOpen, results, highlightedIndex, handleSelect, clear],
  );

  const showDropdown = isOpen && (isSearching || results.length > 0 || error || inputText.trim().length >= 3);

  return (
    <div ref={containerRef} className="relative w-full">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>

      <div className="relative">
        {/* Left icon */}
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            {icon === 'start' ? (
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <circle cx="7" cy="7" r="6" fill="#22c55e" stroke="#16a34a" strokeWidth="1" />
              </svg>
            ) : (
              <svg width="14" height="18" viewBox="0 0 14 18" aria-hidden="true">
                <path
                  d="M7 0C3.13 0 0 3.13 0 7c0 5.25 7 11 7 11s7-5.75 7-11c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"
                  fill="#ef4444"
                />
              </svg>
            )}
          </div>
        )}

        <input
          ref={inputRef}
          type="text"
          className={`input rounded-xl w-full ${icon ? 'pl-10' : ''} pr-10`}
          placeholder={placeholder}
          value={inputText}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          autoComplete="off"
        />

        {/* Clear button */}
        {inputText && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
            aria-label="Clear"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
            </svg>
          </button>
        )}
      </div>

      {/* Use my location link */}
      {onUseMyLocation && (
        <button
          type="button"
          onClick={onUseMyLocation}
          className="mt-1 text-xs text-primary-600 hover:text-primary-800 hover:underline focus:outline-none"
        >
          Use my location
        </button>
      )}

      {/* Dropdown */}
      {showDropdown && (
        <ul className="absolute z-50 w-full bg-white rounded-xl shadow-lg border border-gray-200 mt-1 max-h-60 overflow-y-auto">
          {isSearching && (
            <li className="px-4 py-3 text-sm text-gray-500">Searching...</li>
          )}

          {error && (
            <li className="px-4 py-3 text-sm text-red-500">{error}</li>
          )}

          {!isSearching && !error && results.length === 0 && inputText.trim().length >= 3 && (
            <li className="px-4 py-3 text-sm text-gray-500">No locations found</li>
          )}

          {!isSearching &&
            results.map((result, index) => (
              <li
                key={`${result.lat}-${result.lng}-${index}`}
                className={`px-4 py-3 cursor-pointer text-sm truncate ${
                  index === highlightedIndex ? 'bg-primary-50' : 'hover:bg-gray-50'
                }`}
                onMouseEnter={() => setHighlightedIndex(index)}
                onMouseDown={(e) => {
                  e.preventDefault(); // Prevent blur before click registers
                  handleSelect(result);
                }}
              >
                {result.displayName}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

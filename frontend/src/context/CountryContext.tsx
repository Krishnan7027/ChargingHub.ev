'use client';

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { COUNTRIES, DEFAULT_COUNTRY_CODE, getCountry, type CountryConfig } from '@/lib/countries';

const STORAGE_KEY = 'ev-country';

interface CountryState {
  country: CountryConfig;
  setCountryCode: (code: string) => void;
}

const CountryContext = createContext<CountryState | null>(null);

export function CountryProvider({ children }: { children: ReactNode }) {
  const [countryCode, setCountryCodeState] = useState(DEFAULT_COUNTRY_CODE);

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && COUNTRIES[stored]) {
        setCountryCodeState(stored);
      }
    } catch {}
  }, []);

  const setCountryCode = useCallback((code: string) => {
    if (COUNTRIES[code]) {
      setCountryCodeState(code);
      try {
        localStorage.setItem(STORAGE_KEY, code);
      } catch {}
    }
  }, []);

  const country = getCountry(countryCode);

  return (
    <CountryContext.Provider value={{ country, setCountryCode }}>
      {children}
    </CountryContext.Provider>
  );
}

export function useCountry() {
  const ctx = useContext(CountryContext);
  if (!ctx) throw new Error('useCountry must be used inside <CountryProvider>');
  return ctx;
}

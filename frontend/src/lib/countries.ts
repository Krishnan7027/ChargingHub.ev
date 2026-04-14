export interface CountryConfig {
  code: string;
  name: string;
  flag: string;
  currency: string;
  currencySymbol: string;
  defaultCenter: { lat: number; lng: number };
  defaultZoom: number;
  locale: string;
}

export const COUNTRIES: Record<string, CountryConfig> = {
  IN: {
    code: 'IN',
    name: 'India',
    flag: '🇮🇳',
    currency: 'INR',
    currencySymbol: '₹',
    defaultCenter: { lat: 12.9716, lng: 77.5946 },
    defaultZoom: 12,
    locale: 'en-IN',
  },
  US: {
    code: 'US',
    name: 'United States',
    flag: '🇺🇸',
    currency: 'USD',
    currencySymbol: '$',
    defaultCenter: { lat: 37.0902, lng: -95.7129 },
    defaultZoom: 4,
    locale: 'en-US',
  },
  GB: {
    code: 'GB',
    name: 'United Kingdom',
    flag: '🇬🇧',
    currency: 'GBP',
    currencySymbol: '£',
    defaultCenter: { lat: 55.3781, lng: -3.4360 },
    defaultZoom: 6,
    locale: 'en-GB',
  },
  DE: {
    code: 'DE',
    name: 'Germany',
    flag: '🇩🇪',
    currency: 'EUR',
    currencySymbol: '€',
    defaultCenter: { lat: 51.1657, lng: 10.4515 },
    defaultZoom: 6,
    locale: 'de-DE',
  },
};

export const DEFAULT_COUNTRY_CODE = 'IN';

export function getCountry(code: string): CountryConfig {
  return COUNTRIES[code] ?? COUNTRIES[DEFAULT_COUNTRY_CODE];
}

export function getCountryList(): CountryConfig[] {
  return Object.values(COUNTRIES);
}

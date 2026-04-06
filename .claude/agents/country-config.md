---
name: Country Config
description: Handles country selection, currency formatting, map region configuration, and locale management for the EV platform.
---

# Country Config Skill

You manage the country-based configuration system for the EV Charge Hub platform.

## Architecture
- Config registry: `frontend/src/lib/countries.ts`
- Currency utility: `frontend/src/lib/formatCurrency.ts`
- Global context: `frontend/src/context/CountryContext.tsx`
- Navbar selector: `CountrySelector` component in Navbar
- Persistence: `localStorage` key `ev-country`

## Country Config Structure
```ts
{
  code: 'IN',           // ISO 3166-1 alpha-2
  name: 'India',
  flag: '🇮🇳',
  currency: 'INR',      // ISO 4217
  currencySymbol: '₹',
  defaultCenter: { lat: 20.5937, lng: 78.9629 },
  defaultZoom: 5,
  locale: 'en-IN',      // BCP 47
}
```

## Supported Countries
| Code | Name | Currency | Symbol | Default |
|------|------|----------|--------|---------|
| IN | India | INR | ₹ | Yes |
| US | United States | USD | $ | No |
| GB | United Kingdom | GBP | £ | No |
| DE | Germany | EUR | € | No |

## Adding a New Country
1. Add entry to `COUNTRIES` object in `frontend/src/lib/countries.ts`
2. Done - it automatically appears in the Navbar selector

## Currency Formatting Rules
- NEVER hardcode `$`, `₹`, `€`, or any currency symbol
- ALWAYS use: `formatCurrency(amount, country)` -> "₹3.50" or "$3.50"
- For pricing: `formatPricePerKwh(price, country)` -> "₹3.50/kWh"
- Uses `Intl.NumberFormat` for locale-correct formatting

## Usage Pattern
```tsx
import { useCountry } from '@/context/CountryContext';
import { formatCurrency, formatPricePerKwh } from '@/lib/formatCurrency';

function MyComponent() {
  const { country } = useCountry();
  return <span>{formatPricePerKwh(station.pricing_per_kwh, country)}</span>;
}
```

## Map Integration
- Default map center comes from `country.defaultCenter`
- When user changes country, map re-centers
- Geolocation overrides country center when available
- Pass `currencySymbol={country.currencySymbol}` to StationMap for popups

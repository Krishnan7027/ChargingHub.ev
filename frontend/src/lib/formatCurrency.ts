import type { CountryConfig } from './countries';

/**
 * Exchange rates from INR (base currency) to other currencies.
 * All prices in the DB are stored in INR. These are approximate rates
 * that can be replaced with a live API (e.g., Open Exchange Rates) later.
 */
const EXCHANGE_RATES_FROM_INR: Record<string, number> = {
  INR: 1,
  USD: 0.012,
  GBP: 0.0095,
  EUR: 0.011,
};

/**
 * Convert an amount from INR (base/stored currency) to the target currency.
 * Returns the converted numeric value.
 */
export function convertFromINR(amount: number, targetCurrency: string): number {
  const rate = EXCHANGE_RATES_FROM_INR[targetCurrency] ?? 1;
  return amount * rate;
}

/**
 * Format a number as currency using the country's locale and currency code.
 * Automatically converts from INR (base) to the selected currency.
 *
 * Examples:
 *   formatCurrency(350, indiaConfig) → "₹350.00"
 *   formatCurrency(350, usConfig)    → "$4.20"
 */
export function formatCurrency(amount: number | string | null | undefined, country: CountryConfig): string {
  if (amount == null) return `${country.currencySymbol}0.00`;

  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return `${country.currencySymbol}0.00`;

  const converted = convertFromINR(num, country.currency);

  return new Intl.NumberFormat(country.locale, {
    style: 'currency',
    currency: country.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(converted);
}

/**
 * Format price per kWh with automatic currency conversion: "₹3.50/kWh"
 */
export function formatPricePerKwh(price: number | string | null | undefined, country: CountryConfig): string {
  return `${formatCurrency(price, country)}/kWh`;
}

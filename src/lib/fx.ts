import type { CurrencyCode } from './currency';

// Integer-scaled rates avoid float drift. All rates here express "1 EUR = N quote",
// scaled by 1_000_000.

export const RATE_SCALE = 1_000_000 as const;

// BGN is pegged to EUR by Bulgarian National Bank policy: 1 EUR = 1.95583 BGN.
// We force-pin this on every refresh; never overwrite from API responses.
export const BGN_PEGGED_RATE_X1E6 = 1_955_830 as const;

// Hardcoded fallback for cold-start (no network, empty cache). Snapshotted 2026-05.
// Used only when fx_rates table is empty.
export const FALLBACK_RATES_X1E6: Record<Exclude<CurrencyCode, 'EUR'>, number> = {
  USD: 1_080_000, // 1 EUR ≈ 1.08 USD
  GBP:   850_000, // 1 EUR ≈ 0.85 GBP
  BGN: BGN_PEGGED_RATE_X1E6,
};

export type FxRate = {
  base: 'EUR';
  quote: CurrencyCode;
  rateX1e6: number;
  fetchedAt: number; // unix ms
};

// rateLookup: given a map of EUR→quote rates, return the EUR→quote rate for `code`.
// For EUR returns 1_000_000. Falls back to the hardcoded table if missing from `rates`.
export function rateLookup(
  rates: Record<string, number>, // keyed by quote code
  code: CurrencyCode,
): number {
  if (code === 'EUR') return RATE_SCALE;
  const cached = rates[code];
  if (cached && cached > 0) return cached;
  const fallback = FALLBACK_RATES_X1E6[code as Exclude<CurrencyCode, 'EUR'>];
  // Unknown/unsupported code: fall back to 1:1 rather than returning undefined, which
  // would propagate as NaN through every amount calculation and silently corrupt totals.
  if (!fallback || fallback <= 0) {
    if (__DEV__) console.warn(`rateLookup: no rate for "${code}", defaulting to 1:1`);
    return RATE_SCALE;
  }
  return fallback;
}

// Convert entryCurrency → EUR. Rate is stored at write-time.
// Stored rate is rateToBase = entryCurrency → EUR, x1_000_000.
//
// Caller derives this rate from the cache via:
//   rateToBase(entryCurrency) = entryCurrency === 'EUR' ? 1_000_000
//                             : round(1e12 / cache[EUR→entryCurrency])
export function deriveRateToBaseX1e6(
  ratesEurToQuote: Record<string, number>,
  entryCurrency: CurrencyCode,
): number {
  if (entryCurrency === 'EUR') return RATE_SCALE;
  const eurToEntry = rateLookup(ratesEurToQuote, entryCurrency);
  // 1e12 / rate gives the inverse, still scaled by 1e6
  return Math.round(1_000_000_000_000 / eurToEntry);
}

// amountInBaseCents: deterministic per row — uses ONLY the row's snapshotted rate.
export function amountInBaseCents(row: {
  amountCents: number;
  rateToBaseX1e6: number;
}): number {
  return Math.round((row.amountCents * row.rateToBaseX1e6) / RATE_SCALE);
}

// amountInDisplayCents: uses current cached rate for the EUR→display leg.
export function amountInDisplayCents(
  row: { amountCents: number; rateToBaseX1e6: number },
  displayCurrency: CurrencyCode,
  currentRatesEurToQuote: Record<string, number>,
): number {
  const baseCents = amountInBaseCents(row);
  if (displayCurrency === 'EUR') return baseCents;
  const eurToDisplay = rateLookup(currentRatesEurToQuote, displayCurrency);
  return Math.round((baseCents * eurToDisplay) / RATE_SCALE);
}

// Total helper for aggregations: sum of base-cents then convert once.
export function totalInDisplayCents(
  rows: Array<{ amountCents: number; rateToBaseX1e6: number }>,
  displayCurrency: CurrencyCode,
  currentRatesEurToQuote: Record<string, number>,
): number {
  let baseSum = 0;
  for (const r of rows) baseSum += amountInBaseCents(r);
  if (displayCurrency === 'EUR') return baseSum;
  const eurToDisplay = rateLookup(currentRatesEurToQuote, displayCurrency);
  return Math.round((baseSum * eurToDisplay) / RATE_SCALE);
}

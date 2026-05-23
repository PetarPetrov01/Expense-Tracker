import { BGN_PEGGED_RATE_X1E6, RATE_SCALE } from './fx';
import type { CurrencyCode } from './currency';

// Frankfurter response shape (only fields we use):
//   { "amount": 1, "base": "EUR", "date": "2026-05-22",
//     "rates": { "USD": 1.0823, "GBP": 0.8512, "BGN": 1.95583 } }

type FrankfurterResponse = {
  base: string;
  rates: Partial<Record<string, number>>;
};

export type FetchedRates = Record<Exclude<CurrencyCode, 'EUR'>, number>; // x1_000_000

const ENDPOINT = 'https://api.frankfurter.app/latest?from=EUR&to=USD,GBP,BGN';
const TIMEOUT_MS = 8000;

// Throws on network failure, non-2xx, or missing required quotes.
// BGN is ALWAYS the pegged value, regardless of what the API returns.
export async function fetchFrankfurterRates(): Promise<FetchedRates> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(ENDPOINT, { signal: ctrl.signal });
    if (!resp.ok) throw new Error(`frankfurter: HTTP ${resp.status}`);
    const body = (await resp.json()) as FrankfurterResponse;
    if (body.base !== 'EUR') throw new Error(`frankfurter: unexpected base ${body.base}`);
    const usd = body.rates?.USD;
    const gbp = body.rates?.GBP;
    if (typeof usd !== 'number' || typeof gbp !== 'number') {
      throw new Error('frankfurter: missing USD or GBP');
    }
    return {
      USD: Math.round(usd * RATE_SCALE),
      GBP: Math.round(gbp * RATE_SCALE),
      BGN: BGN_PEGGED_RATE_X1E6, // force-pin
    };
  } finally {
    clearTimeout(timer);
  }
}

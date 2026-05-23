# Currency Conversion + Amount Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship two features from `docs/superpowers/specs/2026-05-18-currency-and-amount-input-design.md` —
(1) per-entry currency with rate snapshotting and a cached FX table that drives a global display currency, and
(2) a forgiving `AmountInput` that silently clamps to ≤2 decimals while typing and pads to `x.xx` on blur.

**Architecture:** EUR is the internal anchor. Each expense persists its entry `currency` (ISO code) and `rate_to_base_x1e6` (snapshotted at write time, integer-scaled). A new `fx_rates` table caches `EUR → {USD,GBP,BGN}` rates from `frankfurter.app`, refreshed in the background when older than 3 days. BGN is force-pinned to the BNB peg (`1_955_830`). A hardcoded fallback table covers offline cold-start. Display currency is a single setting; switching it triggers a pure re-render via cached rates — no data writes. Amount input behavior is implemented with two pure helpers and a small state change inside `AmountInput`; no new error UI.

**Tech Stack:**
- `drizzle-orm` + `drizzle-kit` (schema + migration)
- `zustand` (existing settings store, new `fxRates` store)
- `fetch` (built-in — no new deps)
- React Native `Modal` (reuse `CategoryPickerSheet` shell)

**Scope decisions (locked):**
- Two sub-features in one plan because both touch `AmountInput.tsx`. Phase 1 (amount input UX) is independent and ships first.
- ISO codes throughout the data layer (`EUR`, `USD`, `GBP`, `BGN`). Symbols are display-only via a mapping helper.
- Settings key rename `currency → displayCurrency` migrates the value from symbol to ISO code in the same step.
- Per the spec, the existing `expenses` rows are **wiped** by the schema migration (app is in dev). No backfill.
- Manual verification on the running dev device (REA_NX9). No automated test runner exists. Pure-helper "tests" are implemented as throwaway smoke probes added then reverted; each task documents the exact probe to run.
- No new deps. Frankfurter is hit via `fetch`.
- Export/import format (`format-v1`) is **not** extended in this plan. Existing exports written before this feature lands carry no currency info; re-imports apply `displayCurrency` + freshly-snapshotted rate as a fallback. A future v2 export format is deferred (noted in Phase 7).

---

## File Structure

| Path | Status | Responsibility |
|---|---|---|
| `src/lib/amountInput.ts` | Create | `clampWhileTyping`, `padOnBlur` — pure helpers for §2 of spec. |
| `src/components/AmountInput.tsx` | Modify | Owns formatted string state; calls clamp/pad; renders tappable currency chip. |
| `src/lib/currency.ts` | Modify | Add `CurrencyCode` type + `codeToSymbol`/`symbolToCode` mappers. Keep `formatAmount` + `parseAmountToCents` API surface. |
| `src/lib/fx.ts` | Create | `FALLBACK_RATES`, `BGN_PEGGED_RATE`, `rateLookup`, `amountInBaseCents`, `amountInDisplayCents`. |
| `src/lib/fxClient.ts` | Create | `fetchFrankfurterRates()` — isolated `fetch`, returns `{USD,GBP,BGN}` or throws. |
| `src/db/schema.ts` | Modify | Add `currency` + `rateToBaseX1e6` to `expenses`; add new `fxRates` table. |
| `drizzle/0003_*.sql` | Create (via `drizzle-kit generate`) | The migration. |
| `drizzle/migrations.js`, `drizzle/meta/_journal.json`, `drizzle/meta/0003_snapshot.json` | Modify (via drizzle-kit) | Migration plumbing. |
| `src/db/migrate.ts` | Modify | One-shot settings key migration: `currency`(symbol) → `displayCurrency`(ISO). Seed `fx_rates` BGN row. |
| `src/repositories/fxRates.ts` | Create | `getAllRates`, `upsertRates`, `getLastFetchedAt`, `setLastFetchedAt`. |
| `src/repositories/expenses.ts` | Modify | Accept/return `currency` + `rateToBaseX1e6` on create/update; include in select. |
| `src/stores/settings.ts` | Modify | Rename field `currency: CurrencySymbol` → `displayCurrency: CurrencyCode`; store ISO codes. |
| `src/stores/fxRates.ts` | Create | Zustand store: rates, `fxLastFetchedAt`, `hydrate`, `refreshIfStale`, `refreshNow`. |
| `src/components/CurrencyPickerSheet.tsx` | Create | Bottom sheet listing the four currencies, single tap to select. |
| `src/components/ExpenseRow.tsx` | Modify | Show primary in display currency; show "originally £4.20" subline when entry currency ≠ display. |
| `src/components/charts/PeriodBarChart.tsx` | Modify | Bars receive base-cents (already pre-converted upstream); display label uses display currency. |
| `src/components/charts/CategoryPieChart.tsx` | Modify | Same: receives base-cents pre-converted upstream. |
| `app/(tabs)/index.tsx` | Modify | Aggregate in base, convert once to display for the month-total. Render rows unchanged (rows do their own conversion). |
| `app/(tabs)/stats.tsx` | Modify | Aggregate in base before binning into bars / sumByCategory; convert at display time. |
| `app/(tabs)/settings.tsx` | Modify | Relabel section "Display currency"; switch from symbol pills to ISO-code pills with secondary symbol; add "Last FX update" + Refresh action. |
| `app/expense/new.tsx` | Modify | Track entry currency in state; pass `currency` + `rateToBaseX1e6` to `createExpense`. |
| `app/expense/[id].tsx` | Modify | Load entry's `currency` into state; re-snapshot rate on save (always). |
| `app/_layout.tsx` | Modify | After settings hydrate, trigger `fxRates.refreshIfStale()` non-blocking. |

---

## Phase 1: Amount input UX (`AmountInput` clamp + pad on blur)

Independent from currency. Ships first because it has zero dependency on schema/FX work.

### Task 1: Add `clampWhileTyping` + `padOnBlur` pure helpers

**Files:**
- Create: `src/lib/amountInput.ts`

- [ ] **Step 1: Write the helpers**

`src/lib/amountInput.ts`:

```ts
// Pure helpers for AmountInput. No React, no state, no imports.
//
// clampWhileTyping enforces the input shape AS the user types:
//   - Allowed chars: digits + a single decimal separator (. or ,, normalized to .)
//   - Max 2 decimal digits — keystrokes that would produce a 3rd decimal are dropped
//   - Leading zero handling: 005 → 5, 00 → 0, 0.5 → 0.5, 00.5 → 0.5, 0 → 0
//   - Leading "." auto-prefixed with "0" → ".5" becomes "0.5"
//   - Empty string is allowed during editing.
//
// padOnBlur pretty-prints on commit:
//   "" → "" (don't auto-fill)
//   "5" → "5.00"
//   "5." → "5.00"
//   "5.9" → "5.90"
//   "5.99" → "5.99"
//   "0." → "0.00"

export function clampWhileTyping(prev: string, next: string): string {
  // Normalize comma → dot (Bulgarian locale)
  let s = next.replace(',', '.');

  // Drop anything that isn't a digit or a dot
  s = s.replace(/[^0-9.]/g, '');

  // Collapse multiple dots to the first occurrence
  const firstDot = s.indexOf('.');
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '');
  }

  // Leading-dot → "0."
  if (s.startsWith('.')) s = '0' + s;

  // Collapse leading zeros: "005" → "5", "00" → "0", "00.5" → "0.5"
  // Strategy: split on dot. Strip leading zeros from the integer part, but keep
  // one zero if the next char is "." or the integer part is all zeros.
  const dotAt = s.indexOf('.');
  const intPart = dotAt === -1 ? s : s.slice(0, dotAt);
  const fracWithDot = dotAt === -1 ? '' : s.slice(dotAt); // includes leading "."
  let strippedInt = intPart.replace(/^0+/, '');
  if (strippedInt === '') {
    // intPart was all zeros (or empty)
    strippedInt = fracWithDot.length > 0 ? '0' : (intPart.length > 0 ? '0' : '');
  }
  s = strippedInt + fracWithDot;

  // Enforce max 2 decimals — drop this keystroke (return prev) if violated
  const dot2 = s.indexOf('.');
  if (dot2 !== -1 && s.length - dot2 - 1 > 2) {
    return prev;
  }

  return s;
}

export function padOnBlur(value: string): string {
  if (value === '') return '';
  const dotAt = value.indexOf('.');
  if (dotAt === -1) return value + '.00';
  const frac = value.slice(dotAt + 1);
  if (frac.length === 0) return value + '00';
  if (frac.length === 1) return value + '0';
  return value;
}
```

- [ ] **Step 2: Smoke-test the helpers via a temporary probe**

Add this temporarily at the bottom of `app/_layout.tsx` inside the `RootLayout` function body, after the early-return for `error`:

```ts
// TEMP probe — Task 1 verification — REMOVE BEFORE COMMIT
import { clampWhileTyping as _cwt, padOnBlur as _pob } from '../src/lib/amountInput';
const _cases: Array<[string, string, string, string]> = [
  ['', '5', '5', 'plain digit'],
  ['5', '5.', '5.', 'pending decimal'],
  ['5.', '5.9', '5.9', 'one frac'],
  ['5.9', '5.99', '5.99', 'two frac'],
  ['5.99', '5.999', '5.99', 'reject 3rd frac → keep prev'],
  ['', '.5', '0.5', 'auto 0-prefix'],
  ['', '005', '5', 'strip leading zeros'],
  ['', '00.5', '0.5', 'keep one zero before dot'],
  ['', '00', '0', 'collapse to single 0'],
  ['', '5,99', '5.99', 'comma → dot'],
  ['', '5..9', '5.9', 'collapse double dot'],
];
console.log('[probe] clampWhileTyping:');
for (const [prev, next, expected, desc] of _cases) {
  const got = _cwt(prev, next);
  console.log(`  ${got === expected ? 'OK ' : 'FAIL'} (${desc}) clamp(${JSON.stringify(prev)}, ${JSON.stringify(next)}) = ${JSON.stringify(got)} expected ${JSON.stringify(expected)}`);
}
const _pads: Array<[string, string]> = [
  ['', ''], ['5', '5.00'], ['5.', '5.00'], ['5.9', '5.90'], ['5.99', '5.99'], ['0.', '0.00'],
];
console.log('[probe] padOnBlur:');
for (const [v, expected] of _pads) {
  const got = _pob(v);
  console.log(`  ${got === expected ? 'OK ' : 'FAIL'} padOnBlur(${JSON.stringify(v)}) = ${JSON.stringify(got)} expected ${JSON.stringify(expected)}`);
}
```

Reload the app on REA_NX9 (or `r` in Metro). Inspect the Metro logs. Every line must print `OK`. If any `FAIL`, fix the helper, do not move on.

- [ ] **Step 3: Remove the probe**

Delete the lines added in Step 2 from `app/_layout.tsx`.

- [ ] **Step 4: Commit**

```powershell
git add src/lib/amountInput.ts
git commit -m "feat(amount-input): pure clamp/pad helpers for forgiving input"
```

---

### Task 2: Wire helpers into `AmountInput`, remove the future-error UX

**Files:**
- Modify: `src/components/AmountInput.tsx`

- [ ] **Step 1: Rewrite the component**

Replace the contents of `src/components/AmountInput.tsx` with:

```tsx
import { useEffect, useRef, useState } from 'react';
import { TextInput, View, Text } from 'react-native';
import { theme } from '../theme';
import { useSettings } from '../stores/settings';
import { clampWhileTyping, padOnBlur } from '../lib/amountInput';

// `value` is the canonical string the parent owns (post-pad form, e.g. "5.90").
// Internally we keep a more permissive "draft" string so the user can transiently
// have values like "5.", "5.9" while typing. We only emit cleaned values to the parent.
export function AmountInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  // Display the parent's value; internal draft tracks the user's in-progress text.
  const [draft, setDraft] = useState(value);
  const lastParentValue = useRef(value);
  // Currency symbol comes from displayCurrency once Phase 5 lands.
  // For Phase 1 the existing settings shape is still { currency: CurrencySymbol }.
  const currency = useSettings(s => s.currency);

  // If the parent supplies a new value (mount / route reload), normalize once.
  useEffect(() => {
    if (value !== lastParentValue.current) {
      lastParentValue.current = value;
      const normalized = padOnBlur(clampWhileTyping('', value));
      setDraft(normalized);
    }
  }, [value]);

  function handleChangeText(next: string) {
    const accepted = clampWhileTyping(draft, next);
    setDraft(accepted);
    onChange(accepted);
  }

  function handleBlur() {
    const padded = padOnBlur(draft);
    setDraft(padded);
    onChange(padded);
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface,
      paddingHorizontal: theme.spacing.md, borderRadius: theme.radius.md }}>
      <Text style={{ color: theme.colors.textMuted, fontSize: 28, marginRight: 8 }}>{currency}</Text>
      <TextInput
        value={draft}
        onChangeText={handleChangeText}
        onBlur={handleBlur}
        placeholder="0.00"
        placeholderTextColor={theme.colors.textMuted}
        keyboardType="decimal-pad"
        style={{ flex: 1, color: theme.colors.text, fontSize: 32, paddingVertical: 16 }}
      />
    </View>
  );
}
```

The chip is still the static `<Text>` — Task 12 turns it into a tappable selector once the currency feature lands.

- [ ] **Step 2: Manual verification on device**

Reload the app. Go to **New expense**. Verify each of these by typing the input then tapping outside (the category row) to trigger blur:

| Type | Expected display while typing | Expected after blur |
|---|---|---|
| `5` | `5` | `5.00` |
| `5.` | `5.` | `5.00` |
| `5.9` | `5.9` | `5.90` |
| `5.99` | `5.99` | `5.99` |
| `5.999` | `5.99` (the third `9` is silently dropped) | `5.99` |
| `005` | `5` (zeros stripped immediately) | `5.00` |
| `0.5` | `0.5` | `0.50` |
| `.5` | `0.5` | `0.50` |
| `5,9` | `5.9` (Bulgarian-comma normalizes) | `5.90` |
| empty | (placeholder `0.00`) | (still empty placeholder) |

Then enter `5.9`, blur, tap back into the field — value must stay `5.90`, no "unlock" gesture needed.

Save an expense with `2.3` — it should persist as 230 cents (verify by re-opening the entry; amount field reads `2.30`).

- [ ] **Step 3: Commit**

```powershell
git add src/components/AmountInput.tsx
git commit -m "feat(amount-input): silent clamp while typing, auto-pad on blur"
```

---

## Phase 2: Currency model — types + pure converters (no DB yet)

### Task 3: Add `CurrencyCode` + symbol mappers; keep `CurrencySymbol` alias temporarily

**Files:**
- Modify: `src/lib/currency.ts`

- [ ] **Step 1: Replace the file contents**

```ts
export type CurrencyCode = 'EUR' | 'USD' | 'GBP' | 'BGN';
export type CurrencySymbol = '€' | '$' | '£' | 'лв';

export const CURRENCY_CODES: readonly CurrencyCode[] = ['EUR', 'USD', 'GBP', 'BGN'] as const;

const CODE_TO_SYMBOL: Record<CurrencyCode, CurrencySymbol> = {
  EUR: '€',
  USD: '$',
  GBP: '£',
  BGN: 'лв',
};

const SYMBOL_TO_CODE: Record<CurrencySymbol, CurrencyCode> = {
  '€': 'EUR',
  '$': 'USD',
  '£': 'GBP',
  'лв': 'BGN',
};

export function codeToSymbol(code: CurrencyCode): CurrencySymbol {
  return CODE_TO_SYMBOL[code];
}

export function symbolToCode(symbol: string): CurrencyCode {
  return (SYMBOL_TO_CODE as Record<string, CurrencyCode | undefined>)[symbol] ?? 'EUR';
}

export function isCurrencyCode(s: string): s is CurrencyCode {
  return (CURRENCY_CODES as readonly string[]).includes(s);
}

// formatAmount overloads: accept either a symbol (legacy) or a code (new code paths).
export function formatAmount(cents: number, symbolOrCode: CurrencyCode | CurrencySymbol = 'EUR'): string {
  const symbol: CurrencySymbol = isCurrencyCode(symbolOrCode)
    ? CODE_TO_SYMBOL[symbolOrCode]
    : symbolOrCode as CurrencySymbol;
  const whole = (cents / 100).toFixed(2);
  return `${symbol}${whole}`;
}

export function parseAmountToCents(input: string): number | null {
  const normalized = input.replace(',', '.').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(parseFloat(normalized) * 100);
}
```

Note: `formatAmount` keeps backwards compatibility with all current callers that pass a symbol. New code paths will pass a `CurrencyCode`.

- [ ] **Step 2: Run TypeScript check**

```powershell
npx tsc --noEmit
```

Expected: no new errors. (Existing callers continue to pass `CurrencySymbol`, which still works.)

- [ ] **Step 3: Commit**

```powershell
git add src/lib/currency.ts
git commit -m "feat(currency): add ISO CurrencyCode + symbol mappers, keep symbol API"
```

---

### Task 4: Pure FX converters and fallback table in `src/lib/fx.ts`

**Files:**
- Create: `src/lib/fx.ts`

- [ ] **Step 1: Write the module**

```ts
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
  return FALLBACK_RATES_X1E6[code as Exclude<CurrencyCode, 'EUR'>];
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
```

- [ ] **Step 2: Smoke-test via a temporary probe**

Add this temporarily at the bottom of `app/_layout.tsx` inside `RootLayout`, after the error early-return:

```ts
// TEMP probe — Task 4 verification — REMOVE BEFORE COMMIT
import {
  rateLookup as _rl, deriveRateToBaseX1e6 as _drtb,
  amountInBaseCents as _abc, amountInDisplayCents as _adc,
  totalInDisplayCents as _tdc, RATE_SCALE as _SCALE,
  BGN_PEGGED_RATE_X1E6 as _BGN,
} from '../src/lib/fx';
const _r = { USD: 1_080_000, GBP: 850_000, BGN: _BGN };
console.log('[probe] fx:');
const _check = (label: string, got: number, expected: number) => {
  console.log(`  ${got === expected ? 'OK ' : 'FAIL'} ${label}: got ${got} expected ${expected}`);
};
_check('rateLookup EUR', _rl(_r, 'EUR'), _SCALE);
_check('rateLookup USD', _rl(_r, 'USD'), 1_080_000);
_check('rateLookup BGN', _rl(_r, 'BGN'), _BGN);
_check('deriveRateToBase EUR', _drtb(_r, 'EUR'), _SCALE);
_check('deriveRateToBase USD (1.08 USD/EUR → ~0.9259 EUR/USD)', _drtb(_r, 'USD'), Math.round(1_000_000_000_000 / 1_080_000));
// Expense of 100 USD with snapshot rate ≈ 925926 → 92.59 EUR
const _usdRow = { amountCents: 10000, rateToBaseX1e6: _drtb(_r, 'USD') };
_check('amountInBaseCents 100 USD → ~9259 base', _abc(_usdRow), Math.round((10000 * _drtb(_r, 'USD')) / _SCALE));
_check('amountInDisplayCents 100 USD → EUR === base', _adc(_usdRow, 'EUR', _r), _abc(_usdRow));
// 100 USD displayed in BGN: base ≈ 9259 → BGN ≈ 9259 * 1.95583 / 100 ≈ 18.11 BGN → 1811 cents
_check('amountInDisplayCents 100 USD → BGN',
  _adc(_usdRow, 'BGN', _r),
  Math.round((_abc(_usdRow) * _BGN) / _SCALE)
);
// Total of two rows
_check('totalInDisplayCents EUR',
  _tdc([_usdRow, { amountCents: 5000, rateToBaseX1e6: _SCALE }], 'EUR', _r),
  _abc(_usdRow) + 5000
);
```

Reload the app. Every probe line in Metro logs must read `OK`.

- [ ] **Step 3: Remove the probe**

Delete the lines added in Step 2.

- [ ] **Step 4: Commit**

```powershell
git add src/lib/fx.ts
git commit -m "feat(fx): pure converters and fallback rate table (EUR anchor)"
```

---

### Task 5: Frankfurter client (`src/lib/fxClient.ts`)

**Files:**
- Create: `src/lib/fxClient.ts`

- [ ] **Step 1: Write the module**

```ts
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
```

- [ ] **Step 2: Smoke-test against the live API**

Add temporary probe at the bottom of `app/_layout.tsx` `RootLayout`, after the error early-return:

```ts
// TEMP probe — Task 5 verification — REMOVE BEFORE COMMIT
import { fetchFrankfurterRates as _ffr } from '../src/lib/fxClient';
_ffr().then(r => console.log('[probe] fxClient ok:', r))
       .catch(e => console.log('[probe] fxClient err:', e?.message ?? e));
```

Reload. Within ~8s the Metro log must show `[probe] fxClient ok: { USD: ~1080000, GBP: ~850000, BGN: 1955830 }` (USD/GBP values vary by date, but the order of magnitude must match and BGN must be exactly 1_955_830). If it errors due to no network, that's expected behavior — try on Wi-Fi.

- [ ] **Step 3: Remove the probe**

- [ ] **Step 4: Commit**

```powershell
git add src/lib/fxClient.ts
git commit -m "feat(fx): frankfurter client with timeout and BGN peg enforcement"
```

---

## Phase 3: Database schema + repositories

### Task 6: Schema change — `expenses` columns + `fx_rates` table

**Files:**
- Modify: `src/db/schema.ts`
- Generate: `drizzle/0003_*.sql`, `drizzle/meta/0003_snapshot.json`, `drizzle/meta/_journal.json` (via drizzle-kit)
- Modify: `drizzle/migrations.js` (manual)

- [ ] **Step 1: Update the Drizzle schema**

Edit `src/db/schema.ts`. Add two columns to `expenses` and a new `fxRates` table.

After the existing `expenses` definition, the result should read:

```ts
import { sqliteTable, integer, text, primaryKey } from 'drizzle-orm/sqlite-core';

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  icon: text('icon').notNull(),
  color: text('color').notNull(),
  isSeed: integer('is_seed', { mode: 'boolean' }).notNull().default(false),
  stableId: text('stable_id'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const expenses = sqliteTable('expenses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  amountCents: integer('amount_cents').notNull(),
  currency: text('currency').notNull(),                    // NEW — ISO code (EUR/USD/GBP/BGN)
  rateToBaseX1e6: integer('rate_to_base_x1e6').notNull(),  // NEW — entryCurrency→EUR, x1e6
  categoryId: integer('category_id').notNull().references(() => categories.id),
  note: text('note'),
  occurredAt: integer('occurred_at', { mode: 'timestamp_ms' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const fxRates = sqliteTable('fx_rates', {
  base: text('base').notNull(),                        // always 'EUR' in v1
  quote: text('quote').notNull(),                      // 'USD' | 'GBP' | 'BGN'
  rateX1e6: integer('rate_x1e6').notNull(),
  fetchedAt: integer('fetched_at').notNull(),          // unix ms
}, (t) => ({
  pk: primaryKey({ columns: [t.base, t.quote] }),
}));

export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;
export type FxRateRow = typeof fxRates.$inferSelect;
export type NewFxRateRow = typeof fxRates.$inferInsert;
export type AppSetting = typeof appSettings.$inferSelect;
export type NewAppSetting = typeof appSettings.$inferInsert;
```

- [ ] **Step 2: Generate the migration**

From the project root:

```powershell
npx drizzle-kit generate
```

Expected: a new file `drizzle/0003_<name>.sql`, plus `drizzle/meta/0003_snapshot.json` and an updated `drizzle/meta/_journal.json`.

The generated SQL will likely **not** wipe existing rows — drizzle-kit will try to ALTER TABLE with a NOT NULL column, which SQLite cannot do without a default. Open the new file. If the generator produced `ALTER TABLE expenses ADD COLUMN currency text NOT NULL` (which fails at runtime), replace its body with this hand-written, idempotent migration that wipes expenses and adds the columns cleanly:

```sql
DELETE FROM `expenses`;
ALTER TABLE `expenses` ADD `currency` text NOT NULL DEFAULT 'EUR';
ALTER TABLE `expenses` ADD `rate_to_base_x1e6` integer NOT NULL DEFAULT 1000000;
--> statement-breakpoint
CREATE TABLE `fx_rates` (
  `base` text NOT NULL,
  `quote` text NOT NULL,
  `rate_x1e6` integer NOT NULL,
  `fetched_at` integer NOT NULL,
  PRIMARY KEY(`base`, `quote`)
);
```

(The `DEFAULT` clauses make the ADD COLUMN valid in SQLite even though the Drizzle schema marks them non-null. The DELETE empties the table first so no row violates anything; new inserts via Drizzle will always supply both columns. This is acceptable per the spec — wipe existing rows.)

- [ ] **Step 3: Wire the new migration into `drizzle/migrations.js`**

Edit `drizzle/migrations.js`. Add the `m0003` import and entry. Final state:

```js
import journal from './meta/_journal.json';
import m0000 from './0000_needy_thing.sql';
import m0001 from './0001_cheerful_nighthawk.sql';
import m0002 from './0002_nifty_arachne.sql';
import m0003 from './0003_<name>.sql';

  export default {
    journal,
    migrations: {
      m0000,
m0001,
m0002,
m0003
    }
  }
```

(Substitute the actual generated filename in place of `0003_<name>.sql`.)

- [ ] **Step 4: Manual verification — migration runs**

Stop Metro. `npm run android` (a rebuild is **not** required — no native module changes).
Expected on cold start: app boots past the `Loading…` screen. If you previously had expenses, they are gone (per spec).

Inspect the database to confirm columns exist:

```powershell
adb shell "run-as com.expensetracker.app cat databases/app.db" | Out-File -Encoding Byte db-probe.bin
# OR use the existing "Copy raw database" import-export feature to pull and inspect with a sqlite viewer.
```

Confirm `expenses.currency` and `expenses.rate_to_base_x1e6` columns exist and `fx_rates` table exists (empty).

- [ ] **Step 5: Commit**

```powershell
git add src/db/schema.ts drizzle/0003_*.sql drizzle/meta/_journal.json drizzle/meta/0003_snapshot.json drizzle/migrations.js
git commit -m "feat(db): add per-entry currency/rate and fx_rates cache table"
```

---

### Task 7: `src/repositories/fxRates.ts`

**Files:**
- Create: `src/repositories/fxRates.ts`

- [ ] **Step 1: Write the repository**

```ts
import { db, schema } from '../db/client';
import { eq } from 'drizzle-orm';
import type { CurrencyCode } from '../lib/currency';
import { BGN_PEGGED_RATE_X1E6 } from '../lib/fx';

export type RatesEurToQuote = Record<string, number>; // keyed by quote code, x1_000_000

export async function getAllRates(): Promise<RatesEurToQuote> {
  const rows = await db.select().from(schema.fxRates);
  const out: RatesEurToQuote = {};
  for (const r of rows) {
    if (r.base !== 'EUR') continue;
    out[r.quote] = r.rateX1e6;
  }
  return out;
}

export async function upsertRates(
  rates: Record<Exclude<CurrencyCode, 'EUR'>, number>,
  fetchedAt: number,
): Promise<void> {
  // Always force-pin BGN regardless of caller — defense in depth.
  const merged: Record<string, number> = { ...rates, BGN: BGN_PEGGED_RATE_X1E6 };
  for (const [quote, rateX1e6] of Object.entries(merged)) {
    await db.insert(schema.fxRates)
      .values({ base: 'EUR', quote, rateX1e6, fetchedAt })
      .onConflictDoUpdate({
        target: [schema.fxRates.base, schema.fxRates.quote],
        set: { rateX1e6, fetchedAt },
      });
  }
}

export async function seedBgnIfMissing(): Promise<void> {
  const existing = await db.select().from(schema.fxRates)
    .where(eq(schema.fxRates.quote, 'BGN'));
  if (existing.length > 0) return;
  await db.insert(schema.fxRates).values({
    base: 'EUR', quote: 'BGN', rateX1e6: BGN_PEGGED_RATE_X1E6, fetchedAt: 0,
  });
}
```

- [ ] **Step 2: TypeScript check**

```powershell
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```powershell
git add src/repositories/fxRates.ts
git commit -m "feat(fx): repository for fx_rates cache with BGN peg seed"
```

---

### Task 8: Boot-time settings migration + BGN seed in `migrate.ts`

The existing `currency` setting key holds a symbol (e.g. `€`). The new code reads `displayCurrency` holding an ISO code. We run this conversion as part of the existing post-migration hook.

**Files:**
- Modify: `src/db/migrate.ts`
- Modify: `src/repositories/settings.ts` (add a `deleteSetting` helper)

- [ ] **Step 1: Add `deleteSetting`**

Edit `src/repositories/settings.ts`. Add:

```ts
export async function deleteSetting(key: string): Promise<void> {
  await db.delete(appSettings).where(eq(appSettings.key, key));
}
```

You also need to import `eq` at the top of that file (it's already there).

- [ ] **Step 2: Add the settings-key migration + BGN seed**

Edit `src/db/migrate.ts`. After the existing `backfillStableIds` function, add:

```ts
import { appSettings as appSettingsTable } from './schema';
import { symbolToCode, isCurrencyCode } from '../lib/currency';
import { seedBgnIfMissing } from '../repositories/fxRates';
import { setSetting, deleteSetting } from '../repositories/settings';

async function migrateCurrencySettingToDisplayCurrency() {
  const rows = await db.select().from(appSettingsTable);
  const byKey = Object.fromEntries(rows.map(r => [r.key, r.value]));
  // Idempotent: if displayCurrency already exists, no-op.
  if (typeof byKey.displayCurrency === 'string') {
    if (typeof byKey.currency === 'string') await deleteSetting('currency');
    return;
  }
  if (typeof byKey.currency !== 'string') return; // fresh install — let store default kick in
  const legacy = byKey.currency;
  const code = isCurrencyCode(legacy) ? legacy : symbolToCode(legacy);
  await setSetting('displayCurrency', code);
  await deleteSetting('currency');
}
```

Then change the effect block in `useRunMigrations` to also run the new steps:

```ts
  useEffect(() => {
    if (!result.success || backfilled) return;
    (async () => {
      try {
        await backfillStableIds();
        await migrateCurrencySettingToDisplayCurrency();
        await seedBgnIfMissing();
        setBackfilled(true);
      } catch (e) {
        setBackfillError(e as Error);
      }
    })();
  }, [result.success, backfilled]);
```

- [ ] **Step 3: Manual verification**

Reload (Metro `r`). Use the **Copy raw database** action under Settings → Data, pull and inspect:
- `app_settings` table must contain `displayCurrency` row (value: an ISO code, e.g. `EUR`); no `currency` row.
- `fx_rates` table contains a row `(base='EUR', quote='BGN', rate_x1e6=1955830, fetched_at=0)`.

- [ ] **Step 4: Commit**

```powershell
git add src/db/migrate.ts src/repositories/settings.ts
git commit -m "feat(settings): migrate currency symbol → displayCurrency ISO code, seed BGN"
```

---

### Task 9: `expenses` repository accepts currency + rate

**Files:**
- Modify: `src/repositories/expenses.ts`

- [ ] **Step 1: Update inserts/selects to include the new fields**

Replace the file contents:

```ts
import { db, schema } from '../db/client';
import { eq, gte, lte, and, desc, sql } from 'drizzle-orm';
import type { Expense, NewExpense } from '../db/schema';

export type ExpenseWithCategory = Expense & {
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
};

export async function listExpenses(opts?: { start?: Date; end?: Date; limit?: number }): Promise<ExpenseWithCategory[]> {
  const conds = [];
  if (opts?.start) conds.push(gte(schema.expenses.occurredAt, opts.start));
  if (opts?.end)   conds.push(lte(schema.expenses.occurredAt, opts.end));
  const rows = await db
    .select({
      id: schema.expenses.id,
      amountCents: schema.expenses.amountCents,
      currency: schema.expenses.currency,
      rateToBaseX1e6: schema.expenses.rateToBaseX1e6,
      categoryId: schema.expenses.categoryId,
      note: schema.expenses.note,
      occurredAt: schema.expenses.occurredAt,
      createdAt: schema.expenses.createdAt,
      categoryName: schema.categories.name,
      categoryIcon: schema.categories.icon,
      categoryColor: schema.categories.color,
    })
    .from(schema.expenses)
    .innerJoin(schema.categories, eq(schema.expenses.categoryId, schema.categories.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(schema.expenses.occurredAt))
    .limit(opts?.limit ?? 1000);
  return rows;
}

export async function createExpense(
  input: Omit<NewExpense, 'id' | 'createdAt'>
): Promise<number> {
  const [row] = await db.insert(schema.expenses)
    .values({ ...input, createdAt: new Date() })
    .returning({ id: schema.expenses.id });
  return row.id;
}

export async function updateExpense(
  id: number,
  patch: Partial<Pick<Expense, 'amountCents' | 'currency' | 'rateToBaseX1e6' | 'categoryId' | 'note' | 'occurredAt'>>,
) {
  await db.update(schema.expenses).set(patch).where(eq(schema.expenses.id, id));
}

export async function deleteExpense(id: number) {
  await db.delete(schema.expenses).where(eq(schema.expenses.id, id));
}

// Returns *base-cents* aggregate so callers can convert to whatever display currency
// is current. Caller multiplies by the EUR→display rate once.
export async function sumExpensesInBase(start: Date, end: Date): Promise<number> {
  const [row] = await db
    .select({
      total: sql<number>`COALESCE(SUM(CAST(ROUND(${schema.expenses.amountCents} * ${schema.expenses.rateToBaseX1e6} / 1000000.0) AS INTEGER)), 0)`,
    })
    .from(schema.expenses)
    .where(and(gte(schema.expenses.occurredAt, start), lte(schema.expenses.occurredAt, end)));
  return Number(row.total);
}

export async function sumByCategoryInBase(start: Date, end: Date) {
  return db
    .select({
      categoryId:   schema.categories.id,
      categoryName: schema.categories.name,
      categoryIcon: schema.categories.icon,
      categoryColor: schema.categories.color,
      total: sql<number>`COALESCE(SUM(CAST(ROUND(${schema.expenses.amountCents} * ${schema.expenses.rateToBaseX1e6} / 1000000.0) AS INTEGER)), 0)`,
    })
    .from(schema.expenses)
    .innerJoin(schema.categories, eq(schema.expenses.categoryId, schema.categories.id))
    .where(and(gte(schema.expenses.occurredAt, start), lte(schema.expenses.occurredAt, end)))
    .groupBy(schema.categories.id);
}
```

Note the breaking rename: `sumExpenses` → `sumExpensesInBase`, `sumByCategory` → `sumByCategoryInBase`. Callers (Phase 5) will be updated to convert the base-cents result to display.

- [ ] **Step 2: Update the type-only import alignment — TypeScript check**

```powershell
npx tsc --noEmit
```

Expected: errors in `app/(tabs)/index.tsx`, `app/(tabs)/stats.tsx`, `app/expense/new.tsx`, `app/expense/[id].tsx`, and the import/export files that call the old function names. Don't fix yet — Phase 5 fixes them. For now, to keep the app running on device while later tasks land, do not commit until Step 3 below.

- [ ] **Step 3: Re-add temporary shims so the app still runs through Phase 5**

At the bottom of `src/repositories/expenses.ts` add **temporary** compatibility shims (these will be removed in Task 17):

```ts
// TEMP shim until Phase 5 updates callers — removed in Task 17.
export const sumExpenses = sumExpensesInBase;
export const sumByCategory = sumByCategoryInBase;
```

`npx tsc --noEmit` again — expected: only errors at call sites of `createExpense`/`updateExpense` that need to pass `currency` + `rateToBaseX1e6`. Fix those in Task 14.

For *this* task's commit, we accept that `createExpense`/`updateExpense` callers don't yet pass the new fields (the next task wires the store and the task after that updates callers). Verify the app **still boots** by reloading Metro — old expense rows are wiped, so we don't hit the missing-rate path. Creating a new expense without the wiring **will** fail TypeScript until Task 14; you can demo by skipping the New Expense flow until then.

- [ ] **Step 4: Commit**

```powershell
git add src/repositories/expenses.ts
git commit -m "feat(expenses): repo accepts/returns currency+rate; base-cents aggregates"
```

---

## Phase 4: Settings + FX stores

### Task 10: Rename `currency` field in settings store → `displayCurrency` (ISO)

**Files:**
- Modify: `src/stores/settings.ts`

- [ ] **Step 1: Update the store**

Replace the file:

```ts
import { create } from 'zustand';
import type { CurrencyCode } from '../lib/currency';
import { isCurrencyCode } from '../lib/currency';
import { getAllSettings, setSetting } from '../repositories/settings';

function parseDisplayCurrency(raw: string | undefined): CurrencyCode {
  if (raw && isCurrencyCode(raw)) return raw;
  return 'EUR';
}

function parseCategoryId(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

type State = {
  loaded: boolean;
  displayCurrency: CurrencyCode;
  lastUsedCategoryId: number | null;
  hydrate: () => Promise<void>;
  setDisplayCurrency: (c: CurrencyCode) => Promise<void>;
  setLastUsedCategoryId: (id: number) => Promise<void>;
};

export const useSettings = create<State>((set) => ({
  loaded: false,
  displayCurrency: 'EUR',
  lastUsedCategoryId: null,
  hydrate: async () => {
    const all = await getAllSettings();
    set({
      displayCurrency: parseDisplayCurrency(all.displayCurrency),
      lastUsedCategoryId: parseCategoryId(all.lastUsedCategoryId),
      loaded: true,
    });
  },
  setDisplayCurrency: async (c) => {
    set({ displayCurrency: c });
    try { await setSetting('displayCurrency', c); }
    catch (e) { console.warn('[settings] persist displayCurrency failed', e); }
  },
  setLastUsedCategoryId: async (id) => {
    set({ lastUsedCategoryId: id });
    try { await setSetting('lastUsedCategoryId', String(id)); }
    catch (e) { console.warn('[settings] persist lastUsedCategoryId failed', e); }
  },
}));
```

- [ ] **Step 2: Quick rename pass for any `useSettings(s => s.currency)` callers — minimal "make it compile" patch**

To keep the app booting between this task and Phase 5, run a targeted find/replace **only for compilation** — these sites get a fuller treatment in Phase 5 but need a stop-gap now:

```powershell
# Use VS Code Find/Replace across the workspace:
#   FIND:     useSettings\(s => s.currency\)
#   REPLACE:  useSettings(s => s.displayCurrency)
# And:
#   FIND:     setCurrency
#   REPLACE:  setDisplayCurrency
```

This will leave `formatAmount(cents, currency)` calls receiving a `CurrencyCode` instead of a `CurrencySymbol` — that's fine because Task 3 made `formatAmount` accept both. The display is *correct ISO code's symbol* via the mapper.

- [ ] **Step 3: TypeScript check + reload**

```powershell
npx tsc --noEmit
```

Expected: no errors related to the rename. Errors at expense create/update sites about missing `currency`/`rateToBaseX1e6` are still expected — fixed in Task 14.

Reload the app. Confirm the home/stats/settings tabs render. The currency picker in Settings still works (it'll be replaced with an ISO-aware version in Task 16).

- [ ] **Step 4: Commit**

```powershell
git add src/stores/settings.ts app/ src/components/ src/lib/export/build-export.ts
git commit -m "refactor(settings): rename currency → displayCurrency (ISO code)"
```

(`src/lib/export/build-export.ts` reads `useSettings.getState().currency` — it becomes `displayCurrency`, which is now an ISO code. The export's top-level `currency` field then carries an ISO code instead of a symbol. This is acceptable because no v1 exports were carrying ISO codes yet in production; the existing import doesn't read that field for behavior. See "Open items" at the bottom for the v2 format.)

---

### Task 11: `fxRates` store with hydrate / refresh

**Files:**
- Create: `src/stores/fxRates.ts`
- Modify: `src/repositories/settings.ts` (no change to that file; just used)

- [ ] **Step 1: Write the store**

```ts
import { create } from 'zustand';
import { getAllRates, upsertRates, type RatesEurToQuote } from '../repositories/fxRates';
import { getAllSettings, setSetting } from '../repositories/settings';
import { fetchFrankfurterRates } from '../lib/fxClient';

const STALE_AFTER_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

type State = {
  loaded: boolean;
  rates: RatesEurToQuote;
  fxLastFetchedAt: number; // unix ms; 0 == never
  refreshing: boolean;
  refreshError: string | null;
  hydrate: () => Promise<void>;
  refreshIfStale: () => Promise<void>;
  refreshNow: () => Promise<void>;
};

export const useFxRates = create<State>((set, get) => ({
  loaded: false,
  rates: {},
  fxLastFetchedAt: 0,
  refreshing: false,
  refreshError: null,
  hydrate: async () => {
    const [rates, settings] = await Promise.all([getAllRates(), getAllSettings()]);
    const ts = Number(settings.fxLastFetchedAt ?? '0');
    set({
      rates,
      fxLastFetchedAt: Number.isFinite(ts) ? ts : 0,
      loaded: true,
    });
  },
  refreshIfStale: async () => {
    const { fxLastFetchedAt, rates, refreshing } = get();
    if (refreshing) return;
    const isEmpty = Object.keys(rates).filter(k => k !== 'BGN').length === 0;
    const isStale = Date.now() - fxLastFetchedAt > STALE_AFTER_MS;
    if (!isEmpty && !isStale) return;
    await get().refreshNow();
  },
  refreshNow: async () => {
    if (get().refreshing) return;
    set({ refreshing: true, refreshError: null });
    try {
      const fetched = await fetchFrankfurterRates();
      const now = Date.now();
      await upsertRates(fetched, now);
      await setSetting('fxLastFetchedAt', String(now));
      const merged = await getAllRates();
      set({ rates: merged, fxLastFetchedAt: now, refreshing: false });
    } catch (e: any) {
      // Per spec: swallow silently. We surface for the manual Refresh action only.
      set({ refreshing: false, refreshError: e?.message ?? 'fetch failed' });
    }
  },
}));
```

- [ ] **Step 2: Hook the store into app boot**

Edit `app/_layout.tsx`. After settings hydrate, also hydrate fxRates and trigger a stale check (non-blocking):

```tsx
import { useFxRates } from '../src/stores/fxRates';

// inside RootLayout, alongside the existing hooks:
  const hydrateFx = useFxRates(s => s.hydrate);
  const refreshFxIfStale = useFxRates(s => s.refreshIfStale);
  const fxLoaded = useFxRates(s => s.loaded);

  useEffect(() => {
    if (!seeded) return;
    hydrateFx().then(() => refreshFxIfStale());
  }, [seeded, hydrateFx, refreshFxIfStale]);
```

And add `fxLoaded` to the loading gate:

```tsx
  if (!success || !seeded || !settingsLoaded || !fxLoaded) return <View><Text>Loading…</Text></View>;
```

- [ ] **Step 3: Manual verification**

Reload. App boots past `Loading…`. Open Metro logs — no `[fxClient] err` (or `err: timeout`). Inspect `fx_rates` table via the raw-db copy escape hatch — must have rows for USD, GBP, BGN with non-zero rates. `app_settings.fxLastFetchedAt` is set to a recent unix ms.

If offline at test time: rates table will only have the BGN seed row, `fxLastFetchedAt` stays 0. That's the expected fallback behavior; subsequent calls in `rateLookup` fall back to the hardcoded table.

- [ ] **Step 4: Commit**

```powershell
git add src/stores/fxRates.ts app/_layout.tsx
git commit -m "feat(fx): zustand store with hydrate, stale-check, and refresh"
```

---

## Phase 5: UI integration

### Task 12: `CurrencyPickerSheet` component

**Files:**
- Create: `src/components/CurrencyPickerSheet.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { Modal, View, Text, Pressable } from 'react-native';
import { CURRENCY_CODES, codeToSymbol, type CurrencyCode } from '../lib/currency';
import { theme } from '../theme';

export function CurrencyPickerSheet({
  visible,
  onClose,
  onSelect,
  current,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (code: CurrencyCode) => void;
  current: CurrencyCode;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} />
      <View style={{
        backgroundColor: theme.colors.surface, padding: theme.spacing.lg,
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
      }}>
        <Text style={{ color: theme.colors.text, fontSize: 18, marginBottom: theme.spacing.md }}>
          Choose currency
        </Text>
        {CURRENCY_CODES.map(code => {
          const isSelected = code === current;
          return (
            <Pressable
              key={code}
              onPress={() => { onSelect(code); onClose(); }}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
                padding: theme.spacing.md, borderRadius: theme.radius.md,
                backgroundColor: isSelected ? theme.colors.primary : 'transparent',
              }}
            >
              <Text style={{ color: isSelected ? '#fff' : theme.colors.text, fontSize: 24, width: 32, textAlign: 'center' }}>
                {codeToSymbol(code)}
              </Text>
              <Text style={{ color: isSelected ? '#fff' : theme.colors.text, fontSize: 16 }}>
                {code}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Modal>
  );
}
```

- [ ] **Step 2: TypeScript check**

```powershell
npx tsc --noEmit
```

No new errors expected.

- [ ] **Step 3: Commit**

```powershell
git add src/components/CurrencyPickerSheet.tsx
git commit -m "feat(currency): CurrencyPickerSheet bottom sheet component"
```

---

### Task 13: `AmountInput` becomes currency-aware (chip → picker)

**Files:**
- Modify: `src/components/AmountInput.tsx`

- [ ] **Step 1: Add a tappable chip + controlled currency prop**

Replace `AmountInput.tsx` with:

```tsx
import { useEffect, useRef, useState } from 'react';
import { TextInput, View, Text, Pressable } from 'react-native';
import { theme } from '../theme';
import { useSettings } from '../stores/settings';
import { clampWhileTyping, padOnBlur } from '../lib/amountInput';
import { CurrencyPickerSheet } from './CurrencyPickerSheet';
import { codeToSymbol, type CurrencyCode } from '../lib/currency';

// Controlled component. Parent owns both the amount string and the entry currency.
// On a new expense, parent should initialize `currency = displayCurrency`.
// On an edit, parent should initialize `currency = expense.currency`.
export function AmountInput({
  value,
  onChange,
  currency,
  onCurrencyChange,
}: {
  value: string;
  onChange: (v: string) => void;
  currency: CurrencyCode;
  onCurrencyChange: (c: CurrencyCode) => void;
}) {
  const [draft, setDraft] = useState(value);
  const lastParentValue = useRef(value);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (value !== lastParentValue.current) {
      lastParentValue.current = value;
      const normalized = padOnBlur(clampWhileTyping('', value));
      setDraft(normalized);
    }
  }, [value]);

  function handleChangeText(next: string) {
    const accepted = clampWhileTyping(draft, next);
    setDraft(accepted);
    onChange(accepted);
  }

  function handleBlur() {
    const padded = padOnBlur(draft);
    setDraft(padded);
    onChange(padded);
  }

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: theme.colors.surface,
      paddingHorizontal: theme.spacing.md, borderRadius: theme.radius.md,
    }}>
      <Pressable onPress={() => setPickerOpen(true)} hitSlop={8} style={{ marginRight: 8 }}>
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 4,
          paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.radius.pill,
          backgroundColor: theme.colors.bg,
        }}>
          <Text style={{ color: theme.colors.text, fontSize: 18 }}>{codeToSymbol(currency)}</Text>
          <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>{currency}</Text>
        </View>
      </Pressable>
      <TextInput
        value={draft}
        onChangeText={handleChangeText}
        onBlur={handleBlur}
        placeholder="0.00"
        placeholderTextColor={theme.colors.textMuted}
        keyboardType="decimal-pad"
        style={{ flex: 1, color: theme.colors.text, fontSize: 32, paddingVertical: 16 }}
      />
      <CurrencyPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={onCurrencyChange}
        current={currency}
      />
    </View>
  );
}

// NOTE: useSettings(...) reference removed — caller passes `currency` explicitly.
```

This is a breaking API change for the two callers in Task 14.

- [ ] **Step 2: TypeScript check**

```powershell
npx tsc --noEmit
```

Expected errors: the two `<AmountInput value={amount} onChange={setAmount} />` call-sites in `app/expense/new.tsx` and `app/expense/[id].tsx` now require `currency` + `onCurrencyChange`. Task 14 fixes both.

- [ ] **Step 3: Do not commit yet** — depends on Task 14 to compile.

---

### Task 14: Wire the new expense screen to use entry currency + snapshot rate

**Files:**
- Modify: `app/expense/new.tsx`

- [ ] **Step 1: Update the new-expense screen**

Replace contents:

```tsx
import { useEffect, useState } from 'react';
import { View, Text, Pressable, Alert, ScrollView, TextInput } from 'react-native';
import { router } from 'expo-router';
import { AmountInput } from '../../src/components/AmountInput';
import { DateField } from '../../src/components/DateField';
import { CategoryIcon } from '../../src/components/CategoryIcon';
import { CategoryPickerSheet } from '../../src/components/CategoryPickerSheet';
import { parseAmountToCents } from '../../src/lib/currency';
import { createExpense } from '../../src/repositories/expenses';
import { getCategory } from '../../src/repositories/categories';
import type { Category } from '../../src/db/schema';
import { useSettings } from '../../src/stores/settings';
import { useFxRates } from '../../src/stores/fxRates';
import { deriveRateToBaseX1e6 } from '../../src/lib/fx';
import type { CurrencyCode } from '../../src/lib/currency';
import { theme } from '../../src/theme';

export default function NewExpense() {
  const displayCurrency = useSettings(s => s.displayCurrency);
  const [amount, setAmount] = useState('');
  const [entryCurrency, setEntryCurrency] = useState<CurrencyCode>(displayCurrency);
  const [category, setCategory] = useState<Category | null>(null);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date());
  const [pickerOpen, setPickerOpen] = useState(false);

  const lastUsedCategoryId = useSettings(s => s.lastUsedCategoryId);
  const setLastUsedCategoryId = useSettings(s => s.setLastUsedCategoryId);
  const rates = useFxRates(s => s.rates);

  useEffect(() => {
    if (!lastUsedCategoryId || category) return;
    (async () => {
      const row = await getCategory(lastUsedCategoryId);
      if (row) setCategory(row);
    })();
  }, [lastUsedCategoryId, category]);

  async function save() {
    const cents = parseAmountToCents(amount);
    if (cents === null || cents <= 0) return Alert.alert('Invalid amount');
    if (!category) return Alert.alert('Pick a category');
    const rateToBaseX1e6 = deriveRateToBaseX1e6(rates, entryCurrency);
    await createExpense({
      amountCents: cents,
      currency: entryCurrency,
      rateToBaseX1e6,
      categoryId: category.id,
      note: note || null,
      occurredAt: date,
    });
    setLastUsedCategoryId(category.id);
    router.back();
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.bg }} contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
      <AmountInput
        value={amount}
        onChange={setAmount}
        currency={entryCurrency}
        onCurrencyChange={setEntryCurrency}
      />

      <Pressable onPress={() => setPickerOpen(true)} style={{
        backgroundColor: theme.colors.surface, padding: theme.spacing.md, borderRadius: theme.radius.md,
        flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
      }}>
        {category
          ? <><CategoryIcon icon={category.icon} color={category.color} size={32} /><Text style={{ color: theme.colors.text, fontSize: 16 }}>{category.name}</Text></>
          : <Text style={{ color: theme.colors.textMuted, fontSize: 16 }}>Choose category</Text>}
      </Pressable>

      <DateField value={date} onChange={setDate} />

      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Note (optional)"
        placeholderTextColor={theme.colors.textMuted}
        style={{ backgroundColor: theme.colors.surface, padding: theme.spacing.md, borderRadius: theme.radius.md, color: theme.colors.text }}
      />

      <Pressable onPress={save} style={{ backgroundColor: theme.colors.primary, padding: theme.spacing.md, borderRadius: theme.radius.md, alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Save expense</Text>
      </Pressable>

      <CategoryPickerSheet visible={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={setCategory} />
    </ScrollView>
  );
}
```

- [ ] **Step 2: Manual verification**

Reload. From the home FAB, create a new expense:
- The currency chip in the AmountInput shows the current `displayCurrency`.
- Tap the chip → the bottom sheet shows all four currencies; the current one is highlighted.
- Switch to USD, enter `100`, pick a category, save.
- Pull the raw DB. `expenses` row: `amount_cents=10000`, `currency='USD'`, `rate_to_base_x1e6` ≈ 925000–940000 (1 USD ≈ 0.92 EUR; will vary by the live rate).

- [ ] **Step 3: Commit**

```powershell
git add src/components/AmountInput.tsx app/expense/new.tsx
git commit -m "feat(currency): AmountInput currency chip + new-expense passes currency+rate"
```

---

### Task 15: Edit-expense screen — load + re-snapshot rate

**Files:**
- Modify: `app/expense/[id].tsx`

- [ ] **Step 1: Update edit screen**

Replace contents:

```tsx
import { useEffect, useState } from 'react';
import { View, Text, Pressable, Alert, ScrollView, TextInput } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { AmountInput } from '../../src/components/AmountInput';
import { DateField } from '../../src/components/DateField';
import { CategoryIcon } from '../../src/components/CategoryIcon';
import { CategoryPickerSheet } from '../../src/components/CategoryPickerSheet';
import { parseAmountToCents } from '../../src/lib/currency';
import { listExpenses, updateExpense, deleteExpense } from '../../src/repositories/expenses';
import { getCategory } from '../../src/repositories/categories';
import { useFxRates } from '../../src/stores/fxRates';
import { useSettings } from '../../src/stores/settings';
import { deriveRateToBaseX1e6 } from '../../src/lib/fx';
import type { Category } from '../../src/db/schema';
import type { CurrencyCode } from '../../src/lib/currency';
import { isCurrencyCode } from '../../src/lib/currency';
import { theme } from '../../src/theme';

export default function EditExpense() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const expenseId = Number(id);
  const displayCurrency = useSettings(s => s.displayCurrency);
  const [amount, setAmount] = useState('');
  const [entryCurrency, setEntryCurrency] = useState<CurrencyCode>(displayCurrency);
  const [category, setCategory] = useState<Category | null>(null);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date());
  const [pickerOpen, setPickerOpen] = useState(false);
  const rates = useFxRates(s => s.rates);

  useEffect(() => {
    (async () => {
      const rows = await listExpenses({ limit: 1000 });
      const found = rows.find(r => r.id === expenseId);
      if (!found) return router.back();
      setAmount((found.amountCents / 100).toFixed(2));
      setNote(found.note ?? '');
      setDate(new Date(found.occurredAt));
      // Defensive: the column is NOT NULL, but if somehow not a known code, fall back to display.
      setEntryCurrency(isCurrencyCode(found.currency) ? found.currency : displayCurrency);
      const cat = await getCategory(found.categoryId);
      if (cat) setCategory(cat);
    })();
  }, [expenseId, displayCurrency]);

  async function save() {
    const cents = parseAmountToCents(amount);
    if (cents === null || cents <= 0) return Alert.alert('Invalid amount');
    if (!category) return Alert.alert('Pick a category');
    // Spec §1.5: ALWAYS re-snapshot rate on edit-save, regardless of which fields changed.
    const rateToBaseX1e6 = deriveRateToBaseX1e6(rates, entryCurrency);
    await updateExpense(expenseId, {
      amountCents: cents,
      currency: entryCurrency,
      rateToBaseX1e6,
      categoryId: category.id,
      note: note || null,
      occurredAt: date,
    });
    router.back();
  }

  function confirmDelete() {
    Alert.alert('Delete expense?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteExpense(expenseId); router.back(); } },
    ]);
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.bg }} contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
      <AmountInput
        value={amount}
        onChange={setAmount}
        currency={entryCurrency}
        onCurrencyChange={setEntryCurrency}
      />

      <Pressable onPress={() => setPickerOpen(true)} style={{
        backgroundColor: theme.colors.surface, padding: theme.spacing.md, borderRadius: theme.radius.md,
        flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
      }}>
        {category
          ? <><CategoryIcon icon={category.icon} color={category.color} size={32} /><Text style={{ color: theme.colors.text, fontSize: 16 }}>{category.name}</Text></>
          : <Text style={{ color: theme.colors.textMuted }}>Choose category</Text>}
      </Pressable>

      <DateField value={date} onChange={setDate} />

      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Note (optional)"
        placeholderTextColor={theme.colors.textMuted}
        style={{ backgroundColor: theme.colors.surface, padding: theme.spacing.md, borderRadius: theme.radius.md, color: theme.colors.text }}
      />

      <Pressable onPress={save} style={{ backgroundColor: theme.colors.primary, padding: theme.spacing.md, borderRadius: theme.radius.md, alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Save changes</Text>
      </Pressable>

      <Pressable onPress={confirmDelete} style={{ padding: theme.spacing.md, alignItems: 'center' }}>
        <Text style={{ color: theme.colors.danger, fontSize: 16 }}>Delete</Text>
      </Pressable>

      <CategoryPickerSheet visible={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={setCategory} />
    </ScrollView>
  );
}
```

- [ ] **Step 2: Manual verification**

Reload. Open the USD expense from Task 14:
- Chip reads `$ USD`, amount reads `100.00`.
- Change amount to `120`, save. Re-open: chip still `$ USD`, amount `120.00`.
- Change chip to GBP, save. Re-open: chip `£ GBP`, amount `120.00`. Pull DB: `currency='GBP'`, `rate_to_base_x1e6` is the *current* GBP→EUR inverse (not the original USD rate). This confirms always-re-snapshot.

- [ ] **Step 3: Commit**

```powershell
git add app/expense/[id].tsx
git commit -m "feat(currency): edit-expense loads entry currency, always re-snapshots rate"
```

---

### Task 16: `ExpenseRow` — display in display currency + "originally X" subline

**Files:**
- Modify: `src/components/ExpenseRow.tsx`

- [ ] **Step 1: Update the row**

Replace contents:

```tsx
import { View, Text, Pressable } from 'react-native';
import { Link } from 'expo-router';
import { format } from 'date-fns';
import { CategoryIcon } from './CategoryIcon';
import { formatAmount, isCurrencyCode, type CurrencyCode } from '../lib/currency';
import { useSettings } from '../stores/settings';
import { useFxRates } from '../stores/fxRates';
import { amountInDisplayCents } from '../lib/fx';
import type { ExpenseWithCategory } from '../repositories/expenses';
import { theme } from '../theme';

export function ExpenseRow({ e }: { e: ExpenseWithCategory }) {
  const displayCurrency = useSettings(s => s.displayCurrency);
  const rates = useFxRates(s => s.rates);
  const entryCurrency: CurrencyCode = isCurrencyCode(e.currency) ? e.currency : 'EUR';

  const displayCents = amountInDisplayCents(
    { amountCents: e.amountCents, rateToBaseX1e6: e.rateToBaseX1e6 },
    displayCurrency,
    rates,
  );
  const showOriginal = entryCurrency !== displayCurrency;

  return (
    <Link href={`/expense/${e.id}`} asChild>
      <Pressable style={{
        flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
        padding: theme.spacing.md, backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.md, marginBottom: theme.spacing.sm,
      }}>
        <CategoryIcon icon={e.categoryIcon} color={e.categoryColor} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.colors.text, fontSize: 16 }}>{e.categoryName}</Text>
          <Text style={{ color: theme.colors.textMuted, fontSize: 12 }} numberOfLines={1}>
            {format(e.occurredAt, 'PP')}{e.note ? ` · ${e.note}` : ''}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '600' }}>
            {formatAmount(displayCents, displayCurrency)}
          </Text>
          {showOriginal && (
            <Text style={{ color: theme.colors.textMuted, fontSize: 11, fontStyle: 'italic' }}>
              originally {formatAmount(e.amountCents, entryCurrency)}
            </Text>
          )}
        </View>
      </Pressable>
    </Link>
  );
}
```

- [ ] **Step 2: Manual verification**

Reload home tab. Existing entries (now all in either USD or GBP from previous tests):
- With Settings → Display currency = EUR, each USD/GBP entry shows the EUR-converted primary number and a small "originally $100.00" / "originally £120.00" subline.
- Switch Display currency to USD (via the still-old Settings UI — will be rewritten in Task 19). The USD entry's primary shows `$100.00`, no subline. The GBP entry's primary shows the USD-converted amount with `originally £120.00` subline.
- Toggling between display currencies does NOT mutate the database — pull DB after switching and confirm `expenses.amount_cents` and `rate_to_base_x1e6` haven't changed.

- [ ] **Step 3: Commit**

```powershell
git add src/components/ExpenseRow.tsx
git commit -m "feat(currency): expense row shows converted amount + originally subline"
```

---

### Task 17: Home tab + Stats tab — aggregate in base, convert at display

**Files:**
- Modify: `app/(tabs)/index.tsx`
- Modify: `app/(tabs)/stats.tsx`
- Modify: `src/repositories/expenses.ts` (drop the temp shims from Task 9)

- [ ] **Step 1: Update home tab**

Replace contents of `app/(tabs)/index.tsx`:

```tsx
import { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { listExpenses, sumExpensesInBase, type ExpenseWithCategory } from '../../src/repositories/expenses';
import { ExpenseRow } from '../../src/components/ExpenseRow';
import { EmptyState } from '../../src/components/EmptyState';
import { formatAmount } from '../../src/lib/currency';
import { useSettings } from '../../src/stores/settings';
import { useFxRates } from '../../src/stores/fxRates';
import { rateLookup, RATE_SCALE } from '../../src/lib/fx';
import { startOfMonth, endOfMonth } from 'date-fns';
import { theme } from '../../src/theme';

export default function Home() {
  const displayCurrency = useSettings(s => s.displayCurrency);
  const rates = useFxRates(s => s.rates);
  const [items, setItems] = useState<ExpenseWithCategory[]>([]);
  const [monthBaseCents, setMonthBaseCents] = useState(0);

  useFocusEffect(useCallback(() => {
    const now = new Date();
    listExpenses({ limit: 50 }).then(setItems);
    sumExpensesInBase(startOfMonth(now), endOfMonth(now)).then(setMonthBaseCents);
  }, []));

  const eurToDisplay = rateLookup(rates, displayCurrency);
  const monthDisplayCents = Math.round((monthBaseCents * eurToDisplay) / RATE_SCALE);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ padding: theme.spacing.lg }}>
        <Text style={{ color: theme.colors.textMuted }}>This month</Text>
        <Text style={{ color: theme.colors.text, fontSize: 32, fontWeight: '700' }}>
          {formatAmount(monthDisplayCents, displayCurrency)}
        </Text>
      </View>

      {items.length === 0 ? (
        <EmptyState icon="cash-remove" title="No expenses yet" hint="Tap + to add your first one." />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(e) => String(e.id)}
          renderItem={({ item }) => <ExpenseRow e={item} />}
          contentContainerStyle={{ padding: theme.spacing.lg, paddingTop: 0 }}
        />
      )}

      <Link href="/expense/new" asChild>
        <Pressable style={{
          position: 'absolute', right: 24, bottom: 24,
          width: 60, height: 60, borderRadius: 30,
          backgroundColor: theme.colors.primary,
          justifyContent: 'center', alignItems: 'center',
          elevation: 4,
        }}>
          <MaterialCommunityIcons name="plus" size={32} color="#fff" />
        </Pressable>
      </Link>
    </View>
  );
}
```

- [ ] **Step 2: Update stats tab**

Replace contents of `app/(tabs)/stats.tsx`:

```tsx
import { useCallback, useState } from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { listExpenses, sumByCategoryInBase } from '../../src/repositories/expenses';
import { PeriodBarChart, type Bar } from '../../src/components/charts/PeriodBarChart';
import { CategoryPieChart, type Slice } from '../../src/components/charts/CategoryPieChart';
import { bucketsFor, bucketKeyFor, rangeFor, type Period } from '../../src/lib/dates';
import { formatAmount } from '../../src/lib/currency';
import { useSettings } from '../../src/stores/settings';
import { useFxRates } from '../../src/stores/fxRates';
import { amountInBaseCents, rateLookup, RATE_SCALE } from '../../src/lib/fx';
import { theme } from '../../src/theme';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'day', label: 'Daily' }, { key: 'month', label: 'Monthly' }, { key: 'year', label: 'Yearly' },
];

export default function Stats() {
  const displayCurrency = useSettings(s => s.displayCurrency);
  const rates = useFxRates(s => s.rates);
  const [period, setPeriod] = useState<Period>('month');
  const [bars, setBars] = useState<Bar[]>([]);
  const [slices, setSlices] = useState<Slice[]>([]);
  const [totalBase, setTotalBase] = useState(0);

  useFocusEffect(useCallback(() => {
    (async () => {
      const { start, end } = rangeFor(period);
      const buckets = bucketsFor(period);
      const expensesRows = await listExpenses({ start, end });
      // Bin in BASE cents — currency-independent.
      const baseTotals = new Map<string, number>();
      let totalBaseLocal = 0;
      for (const e of expensesRows) {
        const baseCents = amountInBaseCents({ amountCents: e.amountCents, rateToBaseX1e6: e.rateToBaseX1e6 });
        const key = bucketKeyFor(period, new Date(e.occurredAt));
        baseTotals.set(key, (baseTotals.get(key) ?? 0) + baseCents);
        totalBaseLocal += baseCents;
      }
      setBars(buckets.map(b => ({ label: b.label, valueCents: baseTotals.get(b.key) ?? 0 })));
      setTotalBase(totalBaseLocal);

      const cats = await sumByCategoryInBase(start, end);
      setSlices(cats.filter(c => c.total > 0).sort((a, b) => b.total - a.total).map(c => ({
        categoryId: c.categoryId, categoryName: c.categoryName, categoryColor: c.categoryColor, total: Number(c.total),
      })));
    })();
  }, [period]));

  const eurToDisplay = rateLookup(rates, displayCurrency);
  const toDisplay = (baseCents: number) => Math.round((baseCents * eurToDisplay) / RATE_SCALE);

  const totalDisplay = toDisplay(totalBase);
  const avgDisplay = bars.length ? totalDisplay / bars.length : 0;
  const displayBars: Bar[] = bars.map(b => ({ label: b.label, valueCents: toDisplay(b.valueCents) }));
  const displaySlices: Slice[] = slices.map(s => ({ ...s, total: toDisplay(s.total) }));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.bg }} contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        {PERIODS.map(p => (
          <Pressable key={p.key} onPress={() => setPeriod(p.key)} style={{
            flex: 1, padding: theme.spacing.sm, borderRadius: theme.radius.pill, alignItems: 'center',
            backgroundColor: period === p.key ? theme.colors.primary : theme.colors.surface,
          }}>
            <Text style={{ color: '#fff' }}>{p.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <View style={{ flex: 1, padding: theme.spacing.md, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md }}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>Total</Text>
          <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '600' }}>{formatAmount(totalDisplay, displayCurrency)}</Text>
        </View>
        <View style={{ flex: 1, padding: theme.spacing.md, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md }}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>Avg / {period}</Text>
          <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '600' }}>{formatAmount(Math.round(avgDisplay), displayCurrency)}</Text>
        </View>
      </View>

      <PeriodBarChart bars={displayBars} title={period === 'day' ? 'Last 7 days' : period === 'month' ? 'Last 12 months' : 'Last 5 years'} />
      <CategoryPieChart slices={displaySlices} />
    </ScrollView>
  );
}
```

- [ ] **Step 3: Drop the temp shims from Task 9**

Edit `src/repositories/expenses.ts`. Remove the two compatibility shims at the bottom (`export const sumExpenses = sumExpensesInBase;` and `export const sumByCategory = sumByCategoryInBase;`).

- [ ] **Step 4: TypeScript check + manual verification**

```powershell
npx tsc --noEmit
```

Expected: no errors. (If `import/export` files complain about `sumExpenses`, grep — only `app/` files use those helpers; the import/export pipeline doesn't.)

Reload. Verify:
- Home tab "This month" total switches as `displayCurrency` changes.
- Stats tab: bars/slices/totals all switch proportionally.
- Switch entry currency on the existing test expenses, save, return to home — totals reflect re-snapshotted rates.

- [ ] **Step 5: Commit**

```powershell
git add app/(tabs)/index.tsx app/(tabs)/stats.tsx src/repositories/expenses.ts
git commit -m "feat(currency): aggregate in base, convert at display in home + stats"
```

---

### Task 18: Charts internal labels — already done in Task 17

The bar chart and pie chart components consume `valueCents` and `total` numbers expressed in *display* currency, supplied by their parents. Their internal `formatAmount(b.valueCents, currency)` call uses `useSettings(s => s.currency)`. After Task 10 that's now `displayCurrency`, an ISO code — `formatAmount`'s symbol-OR-code overload handles it. Verify by reading the files (no changes required) and bouncing the app.

**Files:**
- Verify only: `src/components/charts/PeriodBarChart.tsx`, `src/components/charts/CategoryPieChart.tsx`

- [ ] **Step 1: Sanity-grep**

```powershell
# These should both find the useSettings(s => s.displayCurrency) reference, not s.currency:
Select-String -Path src/components/charts/*.tsx -Pattern 'useSettings'
```

If any still reads `s.currency`, edit it to `s.displayCurrency`. (The Task 10 mass-rename should have caught this — this step is the safety net.)

- [ ] **Step 2: Manual verification**

On the Stats tab, the top-of-bar labels and pie slice labels both use the correct display symbol (`€`, `$`, `£`, `лв`) as you switch display currency.

- [ ] **Step 3: Commit (if any edits)**

```powershell
git add src/components/charts/PeriodBarChart.tsx src/components/charts/CategoryPieChart.tsx
git commit -m "chore(charts): align label fetch on displayCurrency"
```

If no edits were needed, skip this commit.

---

### Task 19: Settings screen — "Display currency" + "Last FX update" + Refresh

**Files:**
- Modify: `app/(tabs)/settings.tsx`

- [ ] **Step 1: Replace contents**

```tsx
import { useMemo } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Link } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSettings } from '../../src/stores/settings';
import { useFxRates } from '../../src/stores/fxRates';
import { CURRENCY_CODES, codeToSymbol, type CurrencyCode } from '../../src/lib/currency';
import { theme } from '../../src/theme';

export default function Settings() {
  const displayCurrency = useSettings(s => s.displayCurrency);
  const setDisplayCurrency = useSettings(s => s.setDisplayCurrency);
  const fxLastFetchedAt = useFxRates(s => s.fxLastFetchedAt);
  const refreshing = useFxRates(s => s.refreshing);
  const refreshNow = useFxRates(s => s.refreshNow);
  const refreshError = useFxRates(s => s.refreshError);

  const lastFetchLabel = useMemo(() => {
    if (!fxLastFetchedAt) return 'never';
    return `${formatDistanceToNow(new Date(fxLastFetchedAt))} ago`;
  }, [fxLastFetchedAt]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg, padding: theme.spacing.lg, gap: theme.spacing.lg }}>
      <View>
        <Text style={{ color: theme.colors.textMuted, marginBottom: theme.spacing.sm }}>Display currency</Text>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          {CURRENCY_CODES.map((code: CurrencyCode) => (
            <Pressable
              key={code}
              onPress={() => setDisplayCurrency(code)}
              style={{
                flex: 1, padding: theme.spacing.md, borderRadius: theme.radius.md, alignItems: 'center',
                backgroundColor: displayCurrency === code ? theme.colors.primary : theme.colors.surface,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 16 }}>{codeToSymbol(code)} {code}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
        padding: theme.spacing.md, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md,
      }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.colors.text, fontSize: 14 }}>Last FX update: {lastFetchLabel}</Text>
          {refreshError && (
            <Text style={{ color: theme.colors.danger, fontSize: 11 }} numberOfLines={1}>
              {refreshError}
            </Text>
          )}
        </View>
        <Pressable
          onPress={refreshNow}
          disabled={refreshing}
          style={{
            paddingHorizontal: 14, paddingVertical: 8, borderRadius: theme.radius.pill,
            backgroundColor: theme.colors.primary, opacity: refreshing ? 0.6 : 1,
            flexDirection: 'row', alignItems: 'center', gap: 6,
          }}
        >
          {refreshing
            ? <ActivityIndicator size="small" color="#fff" />
            : <MaterialCommunityIcons name="refresh" size={16} color="#fff" />}
          <Text style={{ color: '#fff', fontSize: 13 }}>Refresh</Text>
        </Pressable>
      </View>

      <Link href="/category" asChild>
        <Pressable style={{
          flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
          padding: theme.spacing.md, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md,
        }}>
          <MaterialCommunityIcons name="shape" size={24} color={theme.colors.text} />
          <Text style={{ flex: 1, color: theme.colors.text, fontSize: 16 }}>Manage categories</Text>
          <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.textMuted} />
        </Pressable>
      </Link>

      <Link href="/settings/data" asChild>
        <Pressable style={{
          flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
          padding: theme.spacing.md, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md,
        }}>
          <MaterialCommunityIcons name="database" size={24} color={theme.colors.text} />
          <Text style={{ flex: 1, color: theme.colors.text, fontSize: 16 }}>Data (import / export)</Text>
          <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.textMuted} />
        </Pressable>
      </Link>
    </View>
  );
}
```

- [ ] **Step 2: Manual verification**

Reload. Settings tab:
- Section header reads "Display currency".
- Four pill buttons show e.g. `€ EUR`, `$ USD`, `£ GBP`, `лв BGN`. Selected one is primary-colored.
- Tap to switch — home/stats totals update immediately.
- "Last FX update: X minutes ago" line is present (or "never" if you've been offline since install).
- Tap **Refresh** — spinner appears, then the timestamp updates. With network off, the label stays the same and the red error text appears.

- [ ] **Step 3: Commit**

```powershell
git add app/(tabs)/settings.tsx
git commit -m "feat(currency): settings shows display currency picker + last FX update + refresh"
```

---

## Phase 6: End-to-end verification

### Task 20: Full feature dry-run

**Files:** none (verification only)

- [ ] **Step 1: Cold-start with empty network**

Toggle Wi-Fi off on the device. Force-stop the app (`adb shell am force-stop com.expensetracker.app`), then launch from the home screen. Expected: app boots normally. Hardcoded fallback rates are used (visible because conversions are non-zero between currencies — switch display from EUR to USD on the Stats tab, totals shift proportionally to ~×1.08).

- [ ] **Step 2: Online refresh**

Toggle Wi-Fi on. Settings → Refresh. Within ~3s the timestamp becomes "less than a minute ago". USD rate in DB is now from frankfurter (not 1_080_000 exactly).

- [ ] **Step 3: Cross-currency totals**

Create 3 expenses on three different currencies:
- `€10.00` in `Groceries`
- `$10.00` in `Transport`
- `£10.00` in `Bills`

Set display to EUR. Home "This month" should be roughly `€10.00 + €9.20 + €11.70 = ~€30.90`. Bottom expense rows show their original-currency subline.

Switch display to BGN. The same three rows now show ~`19.56 лв`, ~`17.99 лв`, ~`22.88 лв`, with subline "originally €10.00" etc. Total ~`лв 60.43`. The numbers are consistent: BGN sum ÷ 1.95583 ≈ EUR sum.

- [ ] **Step 4: Edit re-snapshot semantics**

Re-open the `$10.00` expense. Change nothing, just hit save. Pull DB. The `rate_to_base_x1e6` column for that row may differ slightly from before if the rate has been refreshed since. The `currency` value stays `USD` and `amount_cents` stays `1000`.

- [ ] **Step 5: Amount input regression check**

On a new expense, type `2.3232` — only `2.32` is allowed in. Blur — stays `2.32`. Save → row stores 232 cents. Re-open → field reads `2.32`. No error toast appears anywhere in the flow.

- [ ] **Step 6: Commit verification notes (if any tweaks were needed)**

If Step 1–5 required no code changes, do **not** create an empty commit.

---

## Self-Review

**Spec coverage** — every section of `docs/superpowers/specs/2026-05-18-currency-and-amount-input-design.md`:

| Spec section | Covered by |
|---|---|
| §1.3 schema (`currency`, `rate_to_base_x1e6`, `fx_rates`) | Task 6 |
| §1.3 settings rename `currency → displayCurrency` | Task 8 (DB), Task 10 (store) |
| §1.3 migration wipes expenses | Task 6 |
| §1.4 frankfurter endpoint + 3-day refresh + BGN peg + hardcoded fallback | Tasks 4, 5, 11 |
| §1.5 write path snapshots rate; always re-snapshot on edit | Tasks 14, 15 |
| §1.6 pure converters; aggregate in base then convert | Tasks 4, 17 |
| §1.7 AmountInput chip + sheet | Tasks 12, 13 |
| §1.7 ExpenseRow conversion + "originally X" subline | Task 16 |
| §1.7 Settings "Display currency" label + "Last FX update" + Refresh | Task 19 |
| §1.8 file organization (`src/lib/fx.ts`, `src/lib/fxClient.ts`, `src/repositories/fxRates.ts`, `src/stores/fxRates.ts`) | Tasks 4, 5, 7, 11 |
| §2.3 clamp + pad behavior | Task 1 |
| §2.4 helpers in `src/lib/amountInput.ts`, called from `AmountInput.tsx`, `parseAmountToCents` untouched | Tasks 1, 2 |
| §2.5 normalize on mount via `clampWhileTyping`+`padOnBlur` | Task 2 Step 1 (the `useEffect` block on `value` change) |

**No placeholders** — every code block in this plan contains the actual code to write. There are no `// TODO`, no "similar to above", no "add error handling".

**Type consistency** —
- `CurrencyCode` definition (Task 3) and all consumers (Tasks 4, 11, 12, 13, 14, 15, 16, 19) agree.
- `rateToBaseX1e6` is the column name used in the schema (Task 6), the repository projection (Task 9), the converter argument shape (Task 4), and the screens (Tasks 14, 15).
- `useFxRates` field `fxLastFetchedAt` (Task 11) matches the settings key written from the same store and rendered in Task 19.
- `sumExpensesInBase` / `sumByCategoryInBase` are introduced in Task 9, shimmed for legacy callers, then the shim is removed in Task 17 once callers are updated.

---

## Open items (deferred to follow-up plans)

- **Export format v2:** the existing `format-v1.ts` has a top-level `currency: string` and per-expense rows with no `currency`/`rate` fields. After this plan lands, exports written by the new code will:
  - Carry an ISO code in the top-level `currency` field (was previously a symbol; current export code calls `useSettings.getState().displayCurrency` which is now `EUR`/`USD`/…). Existing v1 importers don't read this for behavior, so this is forward-compatible.
  - **Drop** the per-expense `currency`/`rateToBaseX1e6` fields — re-importing then yields rows whose currency we cannot recover. A follow-up plan should bump to formatVersion 2, add `currency` + `rateToBaseX1e6` to each expense, and add a migrator v1→v2 that assigns `currency = doc.currency` and `rateToBaseX1e6 = 1_000_000` (best-effort defaulting). Until then, users should avoid re-importing across the migration boundary.
- **Manual rate override per entry:** explicitly out of scope for this plan (spec §3).
- **Historical rate lookup by entry date:** the entry→base leg is snapshotted; the base→display leg is always current. The spec accepts this; if user feedback shows pain (e.g. on yearly trends), a follow-up plan can lock the EUR→display leg to a historical date.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-23-currency-and-amount-input.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?

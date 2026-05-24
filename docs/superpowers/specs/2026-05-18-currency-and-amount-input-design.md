# Currency Conversion + Amount Input Behavior — Design

**Date:** 2026-05-18
**Status:** Approved (design), pending implementation plan
**Scope:** Two related features for the expense tracker:
1. Per-entry currency with rate snapshotting + display-currency conversion via a cached FX rate table.
2. Price input UX: graceful clamp to 2 decimals + auto-pad on blur, no "invalid" feedback.

> ⚠️ **Concurrency note:** At the time of writing, another session is actively editing project source. This spec is design-only — no source files were modified to produce it. Implementation must be coordinated to avoid conflicts.

---

## 1. Currency feature

### 1.1 Problem

Switching the global currency setting today only swaps the symbol displayed in front of amounts — it does **not** convert the underlying value. An expense entered as `€10` looks like `$10` after switching, which is wrong.

### 1.2 Goal

- Each expense remembers the currency it was actually spent in.
- A single global *display* currency drives what the user sees everywhere in the UI.
- Switching display currency converts values correctly.
- Historical totals are stable: what you spent last March in лв is worth a fixed amount in EUR forever, regardless of FX movement since.
- Works offline. Live FX is a convenience, not a hard dependency.

### 1.3 Data model

Anchor currency for all internal math: **EUR**.

#### Schema changes

`expenses` (additions):

| Column | Type | Notes |
|---|---|---|
| `currency` | `TEXT NOT NULL` | One of `EUR` / `USD` / `GBP` / `BGN`. Stored as ISO-style code, **not** the symbol. |
| `rate_to_base_x1e6` | `INTEGER NOT NULL` | Rate from this entry's `currency` → EUR, multiplied by 1,000,000. Integer to avoid float drift. Snapshotted at create/edit time. |

`amountCents` keeps its meaning: cents in the entry's own currency (not in EUR).

New table `fx_rates` — the cache:

| Column | Type | Notes |
|---|---|---|
| `base` | `TEXT NOT NULL` | Always `EUR` in v1. |
| `quote` | `TEXT NOT NULL` | `USD` / `GBP` / `BGN`. |
| `rate_x1e6` | `INTEGER NOT NULL` | Rate `base → quote`, integer-scaled. |
| `fetched_at` | `INTEGER NOT NULL` | Unix ms. |

Primary key: `(base, quote)`. Upsert on refresh.

New `app_settings` keys:
- `fxLastFetchedAt` — Unix ms, last successful FX fetch.
- `displayCurrency` — explicit rename of the existing `currency` key. Carries the same value but the new name makes its role clear vs. per-entry currency.

#### Migration

App is in dev. Existing expense rows are **wiped** in the migration that adds these columns — we do not attempt to backfill `currency` / `rate_to_base_x1e6` for legacy rows. The existing `currency` setting key is migrated to `displayCurrency`.

### 1.4 FX cache lifecycle

**Source:** `https://api.frankfurter.app/latest?from=EUR&to=USD,GBP,BGN` — ECB-backed, no API key, daily updates, free.

**Refresh policy:**
- On app open: if `fxLastFetchedAt` is older than **3 days** *or* the cache is empty, fire a background fetch. Non-blocking.
- On success: upsert all rows in `fx_rates`, set `fxLastFetchedAt = now`.
- On failure: swallow silently. Stale cache remains valid.
- BGN special case: BGN is pegged to EUR at **1 EUR = 1.95583 BGN** by Bulgarian National Bank policy (`rate_x1e6 = 1_955_830` for the `(EUR, BGN)` row). Always seed this constant on every refresh; never overwrite from the API.

**Hard fallback (cache empty + offline):** a small hardcoded rate table is checked into source as constants in `src/lib/fx.ts` (BGN pegged, plus snapshot values for USD/GBP captured at the time the feature lands). The fallback is used only when the `fx_rates` table is empty *and* the network fetch has not yet succeeded. Ensures the app is functional on a fresh install with no network.

### 1.5 Write path — create / edit expense

1. User picks entry currency (default = `displayCurrency`) and amount.
2. On save:
   - The cache stores rates in the `EUR → quote` direction. To get `entryCurrency → EUR` we invert: `rateToBaseX1e6 = round(1e12 / cache[EUR→entryCurrency].rate_x1e6)`. If `entryCurrency === EUR`, the rate is `1_000_000`.
   - If the cache is empty (only realistic on a brand-new install before the first successful fetch), the hardcoded fallback table is used.
3. Insert/update with `currency`, `amountCents`, `rateToBaseX1e6`.

**Editing rule:** *always* re-snapshot the rate on edit-save, regardless of which fields changed. Editing semantically means "restate this entry now." Simpler than branching on "did the currency change."

### 1.6 Read / display path

Pure functions (in `src/lib/fx.ts`):

```
amountInBaseCents(row) =
  round(row.amountCents × row.rateToBaseX1e6 / 1e6)

amountInDisplayCents(row, displayCurrency, currentRates) =
  round(amountInBaseCents(row) × currentRates[EUR → displayCurrency] / 1e6)
```

- `amountInBaseCents` is deterministic per row — no cache needed.
- `amountInDisplayCents` uses the *current* cached rate for the EUR→display leg.
- Totals: aggregate in base first, then convert once to display. (Equivalent to convert-each-then-sum since conversion is linear; pick whichever reads cleaner per call site.)
- Switching display currency: a single state change re-renders the UI. No data writes, no batch recompute.

### 1.7 UX

**`AmountInput` changes:**
- The static currency symbol becomes a **tappable chip** (left of the input).
- Tap → bottom sheet with the four currencies (symbol + ISO code).
- Default for a new entry = current `displayCurrency`.
- When editing an existing expense, the chip shows the entry's stored currency.

**`ExpenseRow` changes:**
- Primary amount shown in `displayCurrency` (converted via the formula above).
- If `row.currency !== displayCurrency`, show a subtle secondary line: *"originally £4.20"* (or equivalent). Prevents "why is this number weird" confusion.

**Settings screen:**
- Existing currency picker relabeled **"Display currency"**.
- Add a small line: *"Last FX update: 2 days ago"* with a manual **Refresh** action.

### 1.8 Code organization

New files:
- `src/lib/fx.ts` — pure converters (`amountInBaseCents`, `amountInDisplayCents`, `rateLookup`) + hardcoded fallback table + BGN constant.
- `src/lib/fxClient.ts` — isolated `fetch` to frankfurter, returns parsed rates or throws. Easy to mock in tests.
- `src/repositories/fxRates.ts` — DB read/write for `fx_rates`.
- `src/stores/fxRates.ts` (or a hook `useFxRates`) — reactive access to current rates for the UI.

Modified files (implementation only — design unchanged):
- `src/db/schema.ts` — new columns + table.
- `drizzle/` — new migration.
- `src/stores/settings.ts` — rename `currency` → `displayCurrency`, migrate the settings key.
- `src/repositories/expenses.ts` — accept/return `currency` + `rateToBaseX1e6`.
- `src/components/AmountInput.tsx` — currency chip + sheet.
- `src/components/ExpenseRow.tsx` — display conversion + secondary "originally X" line.
- Charts under `src/components/charts/` — aggregate-in-base then convert.

---

## 2. Amount input behavior

### 2.1 Problem

Today, typing `2.3232` shows an "invalid" error on submit. Typing `2.9` stores as `2.9` instead of `2.90`. The input feels punitive and the display is inconsistent.

### 2.2 Goal — "Reading A"

Silently clamp the input to a valid shape as the user types, pretty-print on commit. No error UI. Tapping the field for re-edit is normal (no special unlock gesture).

### 2.3 Behavior spec

**While typing:**
- Allowed characters: digits, one decimal separator. Accept both `.` and `,`; normalize internally to `.`.
- **Max 2 decimal digits.** Any keystroke that would produce a 3rd decimal is silently dropped. No red flash, no toast, no error text.
- Collapse leading zeros: runs of leading `0` digits are reduced to a single `0`, then the `0` is dropped unless it is immediately followed by the decimal separator. So `005` → `5`, `00` → `0`, `0.5` → `0.5`, `00.5` → `0.5`, `0` → `0`.
- Leading `.` auto-prefixed with `0` (typing `.5` becomes `0.5`).
- Empty string is allowed during editing (placeholder shows `0.00`).

**On blur / keyboard dismiss:**

| Input | Output |
|---|---|
| `""` (empty) | `""` (don't auto-fill; user may have wanted to cancel) |
| `5` | `5.00` |
| `5.` | `5.00` |
| `5.9` | `5.90` |
| `5.99` | `5.99` (unchanged) |
| `0.` | `0.00` |

**Re-edit:** standard tap on the field. No unlock gesture, no special state.

### 2.4 Implementation shape

- Pure helpers in `src/lib/amountInput.ts`:
  - `clampWhileTyping(prev: string, next: string): string` — returns the accepted next value (may equal `prev` if the input would have produced a 3rd decimal).
  - `padOnBlur(value: string): string` — returns the formatted value.
- `src/components/AmountInput.tsx` owns its formatted string state, calls the helpers on `onChangeText` and `onBlur`, emits the cleaned string via `onChange` to the parent.
- Existing `parseAmountToCents` in `src/lib/currency.ts` is left untouched — it already handles `5.9`-form values and will receive only well-formed `5.90`-form post-pad.

### 2.5 Edge case

If a parent supplies a value like `"2.3232"` into the controlled input on mount (e.g. loading an entry), the value is normalized via `clampWhileTyping` + `padOnBlur` once on mount. Defensive but cheap.

---

## 3. Out of scope

- Multi-base currencies (anything other than EUR as anchor).
- Manual rate override per entry (e.g. recording a credit card's actual FX fee).
- User-configurable refresh cadence.
- Migration of legacy expense rows (app is in dev).
- Historical rate lookup by entry date (we use *current* cached rate for the display leg; only the entry→base leg is snapshotted).
- A "locked" input UX (Reading B in brainstorming) — explicitly rejected.

---

## 4. Open items deferred to plan

- Drizzle migration mechanics for the schema change + settings key rename.
- Bottom-sheet component reuse (existing `CategoryPickerSheet` is a possible reference; a new `CurrencyPickerSheet` may share its shell).
- Exact UI for "Last FX update" + Refresh in the settings screen.
- Test coverage for `fx.ts` and `amountInput.ts` pure helpers.

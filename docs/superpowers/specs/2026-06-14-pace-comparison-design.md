# Pace Comparison — Design

**Date:** 2026-06-14
**Status:** Approved (brainstorm) — pending implementation plan
**Scope:** Stats tab. One feature. Other ideas (category drill-down, heatmap, "add another"/duplicate, budgets) are tracked separately in `docs/roadmap.md` and their own specs.

## Problem

The stats tab's `DeltaHeader` answers "did I spend more or less than the previous period?" only as a single end-of-period total-vs-total delta. It can't answer the more useful question mid-period: **"Am I ahead of or behind my usual pace right now?"** A user 14 days into the month wants to know how their running total compares to where they were at the same point last month.

## Solution

A **cumulative pace chart** that replaces `DeltaHeader` as the top card of the stats tab. It plots the current period's running total against the previous period's, aligned by elapsed position, with a headline delta measured at "today."

### Behavior

**Scope-aware.** The chart respects the active `PeriodScope` (`week` | `month` | `year`):

| Scope | X axis spans | Current line vs |
|-------|--------------|-----------------|
| week  | the 7 days of the week (respects `weekStart`) | last week |
| month | day 1 … last day of month | last month |
| year  | Jan 1 … Dec 31, **daily resolution**, month labels | last year |

In all scopes the accumulation bucket is **one day**. Year uses a smooth daily cumulative line (not 12 monthly steps); the x-axis labels are month abbreviations.

**Two lines:**
- **Current period** — emerald (`theme.colors.primary`), solid, 2.5px. Drawn from the period start up to the "today" index (see below).
- **Previous period** — slate (`#64748b`), faded, dashed, 2px. Always drawn across its **full** length, so the user sees where the previous period ended up — even past the current "today" marker.
- A vertical "today" marker (faint dashed white) + a filled dot at the end of the current line.

**Headline** (replaces the `DeltaHeader` card content):
- Big number: the current period's cumulative total at the "today" index, in the display currency.
- Delta chip: comparison against the previous period **at the same elapsed point** (see comparison rules).
  - `▲ €X more` in red (`theme.colors.danger`) when over.
  - `▼ €X less` in green (`theme.colors.primary`) when under.
  - `€0 / flat` in muted when equal.
- Sub-line phrasing swaps with scope and progress state:
  - In-progress period: *"than this point last {week|month|year} · {prevValueAtPoint}"*
  - Completed period: *"than last {week|month|year} · {prevTotal}"*
- When there is no previous-period data: show the total with a muted *"No comparison data yet"* (mirrors current `DeltaHeader` behavior).

### "Today" index and historical navigation

The "today" index is the elapsed-day position at which the current line ends and the comparison is measured.

- **Anchored period is the current real-world period** (e.g. viewing this month, and it is this month): `todayIndex = days elapsed from period start to the real current date`. Current line is partial; headline uses "this point last …".
- **Anchored period is a completed past period** (user navigated back via PeriodScope): `todayIndex = full period length`. Both lines run full; headline uses "vs last …".
- **Anchored period is in the future** (if reachable): treat as zero elapsed — current line empty, headline shows no comparison.

The previous-period line is always drawn full length regardless, faded, for context.

### Comparison rules (clamping)

The delta compares `current.cumulative[todayIndex]` against the previous period's cumulative at the **same elapsed day index**.

- If the previous period is **shorter** than `todayIndex` (e.g. today is the 30th but the previous month was February with 28 days), clamp to the previous period's **final total**: `prevAtPoint = prev.cumulative[min(todayIndex, prevLength - 1)]`.
- If the previous period is **longer**, simply read `prev.cumulative[todayIndex]` (the previous line still draws its full remaining length faded).

## Data

No N+1 per-day queries. Reuse what the stats page already derives:

- Current range: `scopeRange(scope, anchor, weekStart)`.
- Previous range: `scopeRange(scope, stepAnchor(scope, anchor, -1), weekStart)`.
- Fetch expenses once per range with the existing `listExpenses({ start, end })` (returns `ExpenseWithCategory[]`).
- Convert each expense to base cents with the existing `amountInBaseCents`, then to display currency with the page's existing `toDisplay` helper (base → display via `rateLookup` / `RATE_SCALE`).

### Pure helper: `buildCumulativeSeries`

New pure function (location: `src/lib/pace.ts`). Its input is the minimal shape `amountInBaseCents` already consumes, plus `occurredAt`:

```
type PaceInput = {
  occurredAt: Date | number;   // ms epoch or Date
  amountCents: number;
  rateToBaseX1e6: number;      // fields amountInBaseCents() reads
};

buildCumulativeSeries(
  expenses: PaceInput[],
  start: Date,
  end: Date,
): { dayIndex: number; cumulativeBaseCents: number }[]
```

(`ExpenseWithCategory` from `listExpenses` satisfies `PaceInput`. The exact base-conversion field names follow whatever `amountInBaseCents` reads today — confirm at implementation time and keep the helper using that same function rather than re-deriving the rate.)

- Produces one entry per day in `[start, end]` (inclusive of start day, exclusive at `end` per existing range convention).
- `dayIndex` is 0-based from the period start.
- `cumulativeBaseCents` is the running sum of `amountInBaseCents` for all expenses on or before that day.
- Empty days carry the previous day's cumulative (flat segment).
- Works identically for week/month/year — only the `[start, end]` span differs.

Conversion to display currency happens after this pure step, so the helper stays currency-agnostic and unit-testable.

A second small pure helper computes the comparison: `comparePace(currentSeries, prevSeries, todayIndex)` → `{ currentAtPoint, prevAtPoint, deltaCents }`, applying the clamping rule above.

## Component

**New:** `src/components/charts/PaceChart.tsx`

Props:
```
{
  scope: Scope;
  currentSeries: { dayIndex: number; valueDisplayCents: number }[]; // converted to display
  previousSeries: { dayIndex: number; valueDisplayCents: number }[];
  todayIndex: number;          // where the current line ends / comparison is taken
  isInProgress: boolean;       // drives "this point last X" vs "vs last X"
  displayCurrency: CurrencyCode;
  hasPrevious: boolean;
}
```

- Renders the headline (total + delta chip + sub-line) above the plot, reusing the visual language of `DeltaHeader`.
- Renders the plot with **`react-native-svg`**: a `Polyline` for each series (current solid emerald to `todayIndex`; previous full, dashed, faded), the today marker line + dot, and a baseline. Y scale uses a "nice max" like `PeriodBarChart` (round up to a sensible tick). X-axis labels adapt per scope (weekday initials / day numbers at intervals / month abbreviations).
- Empty / no-data state consistent with `EmptyState` usage elsewhere.

**Removed:** `src/components/DeltaHeader.tsx` and its usage in `app/(tabs)/stats.tsx`.

**Changed:** `app/(tabs)/stats.tsx`
- Replace the `DeltaHeader` render with `PaceChart`.
- In the existing `useFocusEffect` data load, after fetching current/previous period expenses, build the two cumulative series, convert to display, compute `todayIndex` and `isInProgress`, and store them in state.
- Keep `CategoryMoversList`, the "Last 6 months" `PeriodBarChart`, and `TopExpensesList` unchanged.
- The existing top-level `currentBase`/`previousBase` zero-check that gates the empty state stays; the pace chart slots in where `DeltaHeader` was.

## Edge cases

- **No expenses this period, none last period** → existing top-level empty state ("No data") still shows; pace chart not rendered.
- **No previous-period data, has current** → chart renders the current line only; headline shows total + "No comparison data yet"; no previous line.
- **Previous period shorter than today index** (Feb, short months) → clamp to previous total per comparison rules.
- **Multi-currency expenses** → all math is in base cents via `amountInBaseCents`; display conversion last. Currency change re-runs the load (already wired via store subscriptions on the page).
- **Single day of data** → series has flat segments; chart still renders a short line and a valid headline.
- **Future-anchored period** → empty current line, no comparison.

## Testing

Unit tests (pure helpers, no RN rendering needed):
- `buildCumulativeSeries`:
  - empty expenses → all days flat at 0
  - single expense → flat 0 before its day, then constant after
  - multiple expenses across days → correct running totals
  - expenses on the same day → summed into that day
  - week / month / year span lengths produce the right number of entries
  - multi-currency inputs accumulate in base cents correctly
- `comparePace`:
  - in-progress mid-period delta
  - completed period full-vs-full delta
  - previous period shorter than today index → clamps to previous total
  - previous period longer than today index → reads at today index
  - no previous data → null/flagged comparison

## Out of scope (tracked elsewhere)

- Category drill-down, spending heatmap, "add another" / duplicate expense — separate specs.
- Budgets / target line on the pace chart — `docs/roadmap.md`.
- A per-day (non-cumulative) view toggle — possible later, not now.

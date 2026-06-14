# Pace Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the stats tab's `DeltaHeader` with a scope-aware cumulative "pace" chart that plots the current period's running spend against the previous period's, with a headline delta measured at "today."

**Architecture:** Pure logic lives in `src/lib/pace.ts` (cumulative series + comparison + today-index), unit-tested with Vitest. A dumb presentational `PaceChart` component (react-native-svg) renders two polylines from display-converted arrays. `app/(tabs)/stats.tsx` fetches current + previous period expenses, builds the series in base cents, converts to display, and feeds the chart — reusing existing `scopeRange`/`stepAnchor`/`listExpenses`/`amountInBaseCents`/`toDisplay`.

**Tech Stack:** React Native (Expo 54), TypeScript, react-native-svg, date-fns, Vitest (new), Zustand stores, Drizzle.

**Reference spec:** `docs/superpowers/specs/2026-06-14-pace-comparison-design.md`

---

## File structure

- Create: `vitest.config.ts` — Vitest config (node env, `src/**/*.test.ts`).
- Create: `src/lib/pace.ts` — pure helpers: `buildCumulativeSeries`, `comparePace`, `paceTodayIndex` + types.
- Create: `src/lib/pace.test.ts` — unit tests for the above.
- Create: `src/components/charts/PaceChart.tsx` — presentational SVG chart + headline.
- Modify: `app/(tabs)/stats.tsx` — fetch previous-period expenses, build/convert series, render `PaceChart` in place of `DeltaHeader`.
- Delete: `src/components/DeltaHeader.tsx` — superseded by `PaceChart`'s headline.
- Modify: `package.json` — add `vitest` devDep + `test` scripts.

---

## Task 1: Set up Vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create (temporary): `src/lib/__sanity.test.ts`

- [ ] **Step 1: Install Vitest**

Run: `npm install -D vitest`
Expected: `vitest` added under `devDependencies`, install completes with no errors.

- [ ] **Step 2: Add test scripts to `package.json`**

In the `"scripts"` block, add `test` and `test:watch` (keep existing scripts):

```json
  "scripts": {
    "start": "expo start",
    "android": "expo run:android",
    "ios": "expo run:ios",
    "web": "expo start --web",
    "lint": "expo lint",
    "test": "vitest run",
    "test:watch": "vitest"
  },
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Add a temporary sanity test**

Create `src/lib/__sanity.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('vitest sanity', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run tests to verify the runner works**

Run: `npm test`
Expected: PASS — 1 test file, 1 passing test.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/__sanity.test.ts
git commit -m "chore(test): add vitest runner

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `buildCumulativeSeries`

Accumulates expenses into a per-day running total (base cents) spanning `[start, end]` inclusive. Day 0 = the start day; empty days carry the previous day's total.

**Files:**
- Create: `src/lib/pace.ts`
- Modify/Create: `src/lib/pace.test.ts`
- Delete: `src/lib/__sanity.test.ts`

- [ ] **Step 1: Remove the sanity test**

Run: `git rm src/lib/__sanity.test.ts`

- [ ] **Step 2: Write the failing test**

Create `src/lib/pace.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildCumulativeSeries } from './pace';

const RATE = 1_000_000; // 1:1 → base cents == amountCents

describe('buildCumulativeSeries', () => {
  const start = new Date(2026, 0, 1); // Jan 1 2026 00:00 local
  const end = new Date(2026, 0, 3, 23, 59, 59); // Jan 3 2026 end-of-day → 3 days

  it('returns one entry per day with zeros when there are no expenses', () => {
    const series = buildCumulativeSeries([], start, end);
    expect(series).toEqual([
      { dayIndex: 0, cumulativeBaseCents: 0 },
      { dayIndex: 1, cumulativeBaseCents: 0 },
      { dayIndex: 2, cumulativeBaseCents: 0 },
    ]);
  });

  it('accumulates a running total and carries empty days forward', () => {
    const series = buildCumulativeSeries(
      [
        { occurredAt: new Date(2026, 0, 1, 10), amountCents: 100, rateToBaseX1e6: RATE },
        { occurredAt: new Date(2026, 0, 3, 8), amountCents: 50, rateToBaseX1e6: RATE },
      ],
      start,
      end,
    );
    expect(series.map(p => p.cumulativeBaseCents)).toEqual([100, 100, 150]);
  });

  it('sums multiple expenses on the same day', () => {
    const series = buildCumulativeSeries(
      [
        { occurredAt: new Date(2026, 0, 2, 9), amountCents: 30, rateToBaseX1e6: RATE },
        { occurredAt: new Date(2026, 0, 2, 18), amountCents: 70, rateToBaseX1e6: RATE },
      ],
      start,
      end,
    );
    expect(series.map(p => p.cumulativeBaseCents)).toEqual([0, 100, 100]);
  });

  it('converts to base cents using each row rate', () => {
    // rate 500000 = 0.5 → 200 amountCents becomes 100 base cents
    const series = buildCumulativeSeries(
      [{ occurredAt: new Date(2026, 0, 1, 12), amountCents: 200, rateToBaseX1e6: 500_000 }],
      start,
      end,
    );
    expect(series[0].cumulativeBaseCents).toBe(100);
  });

  it('ignores expenses outside the range', () => {
    const series = buildCumulativeSeries(
      [{ occurredAt: new Date(2025, 11, 31, 12), amountCents: 999, rateToBaseX1e6: RATE }],
      start,
      end,
    );
    expect(series.map(p => p.cumulativeBaseCents)).toEqual([0, 0, 0]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `./pace` (module not found).

- [ ] **Step 4: Implement `buildCumulativeSeries`**

Create `src/lib/pace.ts`:

```ts
import { differenceInCalendarDays, startOfDay } from 'date-fns';
import { amountInBaseCents } from './fx';

// Minimal shape this module needs. `ExpenseWithCategory` from listExpenses satisfies it.
export type PaceInput = {
  occurredAt: Date | number; // Date (drizzle timestamp_ms) or ms epoch
  amountCents: number;
  rateToBaseX1e6: number;
};

export type CumulativePoint = { dayIndex: number; cumulativeBaseCents: number };

// Cumulative-by-day running total spanning [start, end] inclusive of both calendar days.
// dayIndex 0 = the start day. Empty days repeat the prior cumulative. Pure: amounts are
// summed in base cents via amountInBaseCents; currency conversion happens elsewhere.
export function buildCumulativeSeries(
  expenses: PaceInput[],
  start: Date,
  end: Date,
): CumulativePoint[] {
  const startDay = startOfDay(start);
  const dayCount = differenceInCalendarDays(startOfDay(end), startDay) + 1;
  if (dayCount <= 0) return [];

  const perDay = new Array<number>(dayCount).fill(0);
  for (const e of expenses) {
    const idx = differenceInCalendarDays(startOfDay(new Date(e.occurredAt)), startDay);
    if (idx < 0 || idx >= dayCount) continue; // defensively ignore out-of-range rows
    perDay[idx] += amountInBaseCents(e);
  }

  const out: CumulativePoint[] = [];
  let running = 0;
  for (let i = 0; i < dayCount; i++) {
    running += perDay[i];
    out.push({ dayIndex: i, cumulativeBaseCents: running });
  }
  return out;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all `buildCumulativeSeries` tests green.

- [ ] **Step 6: Commit**

```bash
git add src/lib/pace.ts src/lib/pace.test.ts
git commit -m "feat(pace): add buildCumulativeSeries helper

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `comparePace` and `paceTodayIndex`

`paceTodayIndex` finds where the current line ends (and the comparison is taken). `comparePace` reads both series at that elapsed point, clamping to the previous period's final total when it is shorter.

**Files:**
- Modify: `src/lib/pace.ts`
- Modify: `src/lib/pace.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/pace.test.ts`:

```ts
import { comparePace, paceTodayIndex } from './pace';

describe('paceTodayIndex', () => {
  const start = new Date(2026, 0, 1);
  const end = new Date(2026, 0, 31, 23, 59, 59); // 31-day month → last index 30

  it('returns the last index for a completed (not current) period', () => {
    expect(paceTodayIndex(start, end, false, new Date(2026, 5, 1))).toBe(30);
  });

  it('returns the elapsed index for an in-progress period', () => {
    expect(paceTodayIndex(start, end, true, new Date(2026, 0, 15, 10))).toBe(14);
  });

  it('clamps to 0 when now is before the period start', () => {
    expect(paceTodayIndex(start, end, true, new Date(2025, 11, 20))).toBe(0);
  });

  it('clamps to the last index when now is past the period end', () => {
    expect(paceTodayIndex(start, end, true, new Date(2026, 1, 10))).toBe(30);
  });
});

describe('comparePace', () => {
  const current = [
    { dayIndex: 0, cumulativeBaseCents: 10 },
    { dayIndex: 1, cumulativeBaseCents: 20 },
    { dayIndex: 2, cumulativeBaseCents: 30 },
  ];

  it('compares both series at the same elapsed index', () => {
    const prev = [
      { dayIndex: 0, cumulativeBaseCents: 5 },
      { dayIndex: 1, cumulativeBaseCents: 15 },
      { dayIndex: 2, cumulativeBaseCents: 40 },
      { dayIndex: 3, cumulativeBaseCents: 60 },
    ];
    expect(comparePace(current, prev, 1)).toEqual({
      currentAtPoint: 20,
      prevAtPoint: 15,
      deltaCents: 5,
    });
  });

  it('clamps to the previous final total when the previous period is shorter', () => {
    const prev = [
      { dayIndex: 0, cumulativeBaseCents: 5 },
      { dayIndex: 1, cumulativeBaseCents: 15 },
    ];
    expect(comparePace(current, prev, 2)).toEqual({
      currentAtPoint: 30,
      prevAtPoint: 15, // clamped to last available
      deltaCents: 15,
    });
  });

  it('returns nulls when there is no previous data', () => {
    expect(comparePace(current, [], 2)).toEqual({
      currentAtPoint: 30,
      prevAtPoint: null,
      deltaCents: null,
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `comparePace`/`paceTodayIndex` are not exported.

- [ ] **Step 3: Implement the two helpers**

Append to `src/lib/pace.ts`:

```ts
export type PaceComparison = {
  currentAtPoint: number;      // base cents at the comparison index
  prevAtPoint: number | null;  // null when no previous data
  deltaCents: number | null;   // current - prev, null when no previous data
};

// Index within the period at which the current line ends and the comparison is taken.
// Completed/past periods compare full length; the in-progress period compares to "now",
// clamped into [0, lastIndex].
export function paceTodayIndex(start: Date, end: Date, isCurrent: boolean, now: Date): number {
  const startDay = startOfDay(start);
  const lastIndex = differenceInCalendarDays(startOfDay(end), startDay);
  if (!isCurrent) return lastIndex;
  const idx = differenceInCalendarDays(startOfDay(now), startDay);
  return Math.min(Math.max(idx, 0), lastIndex);
}

// Read both cumulative series at the same elapsed index. When the previous period is
// shorter than todayIndex, clamp to its final total (e.g. comparing day 30 vs a 28-day Feb).
export function comparePace(
  current: CumulativePoint[],
  previous: CumulativePoint[],
  todayIndex: number,
): PaceComparison {
  const curIdx = current.length ? Math.min(Math.max(todayIndex, 0), current.length - 1) : 0;
  const currentAtPoint = current.length ? current[curIdx].cumulativeBaseCents : 0;

  if (previous.length === 0) {
    return { currentAtPoint, prevAtPoint: null, deltaCents: null };
  }
  const prevIdx = Math.min(Math.max(todayIndex, 0), previous.length - 1);
  const prevAtPoint = previous[prevIdx].cumulativeBaseCents;
  return { currentAtPoint, prevAtPoint, deltaCents: currentAtPoint - prevAtPoint };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all `pace.test.ts` tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pace.ts src/lib/pace.test.ts
git commit -m "feat(pace): add comparePace and paceTodayIndex helpers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: `PaceChart` component

A presentational chart. It receives display-converted cumulative arrays and pre-computed headline numbers, and draws the two polylines + today marker. No business logic (keeps the testable logic in `pace.ts`).

**Files:**
- Create: `src/components/charts/PaceChart.tsx`

- [ ] **Step 1: Implement the component**

Create `src/components/charts/PaceChart.tsx`:

```tsx
import { useState } from 'react';
import { View, Text, type LayoutChangeEvent } from 'react-native';
import Svg, { Polyline, Line, Circle } from 'react-native-svg';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { theme } from '../../theme';
import { formatAmount, type CurrencyCode } from '../../lib/currency';
import type { Scope } from '../../lib/dates';

const PLOT_HEIGHT = 160;
const PAD = 8;
const PREV_COLOR = '#64748b';
const SCOPE_NOUN: Partial<Record<Scope, string>> = { week: 'week', month: 'month', year: 'year' };

export function PaceChart({
  scope,
  currentDisplay,
  previousDisplay,
  todayIndex,
  isInProgress,
  currentTotalDisplay,
  deltaDisplay,
  displayCurrency,
}: {
  scope: Scope;
  currentDisplay: number[];   // cumulative display cents per day (current period, full length)
  previousDisplay: number[];  // cumulative display cents per day (previous period, full length)
  todayIndex: number;
  isInProgress: boolean;
  currentTotalDisplay: number;
  deltaDisplay: number | null; // null = no previous data
  displayCurrency: CurrencyCode;
}) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const noun = SCOPE_NOUN[scope] ?? 'period';

  // Headline chip styling (red = spent more, green = spent less — matches app convention).
  const flat = deltaDisplay === 0;
  const up = (deltaDisplay ?? 0) > 0;
  let arrow: 'arrow-up' | 'arrow-down' | 'minus' = 'minus';
  let deltaColor: string = theme.colors.textMuted;
  if (deltaDisplay !== null && !flat) {
    arrow = up ? 'arrow-up' : 'arrow-down';
    deltaColor = up ? theme.colors.danger : theme.colors.primary;
  }

  // Geometry. X domain = max period length so the two lines align by elapsed day.
  const drawnCurrent = currentDisplay.slice(0, todayIndex + 1);
  const maxLen = Math.max(currentDisplay.length, previousDisplay.length, 1);
  const maxC = Math.max(1, ...drawnCurrent, ...previousDisplay); // display cents
  const niceMax = Math.ceil(maxC / 100 / 10) * 10 || 10;          // whole currency units

  const plotW = Math.max(0, width - PAD * 2);
  const x = (i: number) => PAD + (maxLen <= 1 ? 0 : (i / (maxLen - 1)) * plotW);
  const y = (cents: number) => PLOT_HEIGHT - ((cents / 100) / niceMax) * PLOT_HEIGHT;
  const points = (arr: number[]) => arr.map((v, i) => `${x(i)},${y(v)}`).join(' ');

  return (
    <View style={{ backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: theme.spacing.md, gap: 4 }}>
      <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>Total</Text>
      <Text style={{ color: theme.colors.text, fontSize: 32, fontWeight: '700' }}>
        {formatAmount(currentTotalDisplay, displayCurrency)}
      </Text>

      {deltaDisplay === null ? (
        <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>No comparison data yet</Text>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <MaterialCommunityIcons name={arrow} size={16} color={deltaColor} />
          <Text style={{ color: deltaColor, fontSize: 13, fontWeight: '600' }}>
            {flat ? 'same' : `${formatAmount(Math.abs(deltaDisplay), displayCurrency)} ${up ? 'more' : 'less'}`}
          </Text>
          <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>
            {isInProgress ? `than this point last ${noun}` : `than last ${noun}`}
          </Text>
        </View>
      )}

      <View onLayout={onLayout} style={{ marginTop: theme.spacing.sm }}>
        {width > 0 && (
          <Svg width={width} height={PLOT_HEIGHT}>
            <Line x1={PAD} y1={PLOT_HEIGHT} x2={width - PAD} y2={PLOT_HEIGHT} stroke={theme.colors.border} strokeWidth={1} />

            {previousDisplay.length > 1 && (
              <Polyline points={points(previousDisplay)} fill="none" stroke={PREV_COLOR} strokeWidth={2} strokeDasharray="3 3" />
            )}

            {drawnCurrent.length > 1 && (
              <Polyline points={points(drawnCurrent)} fill="none" stroke={theme.colors.primary} strokeWidth={2.5} />
            )}

            {drawnCurrent.length > 0 && (
              <>
                {isInProgress && (
                  <Line x1={x(todayIndex)} y1={0} x2={x(todayIndex)} y2={PLOT_HEIGHT} stroke={theme.colors.text} strokeWidth={1} strokeDasharray="2 3" opacity={0.4} />
                )}
                <Circle cx={x(todayIndex)} cy={y(currentTotalDisplay)} r={3.5} fill={theme.colors.primary} />
              </>
            )}
          </Svg>
        )}
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/charts/PaceChart.tsx
git commit -m "feat(pace): add PaceChart component

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Wire `PaceChart` into the stats tab and remove `DeltaHeader`

**Files:**
- Modify: `app/(tabs)/stats.tsx`
- Delete: `src/components/DeltaHeader.tsx`

- [ ] **Step 1: Update imports in `app/(tabs)/stats.tsx`**

Remove the `DeltaHeader` import line:

```tsx
import { DeltaHeader } from '../../src/components/DeltaHeader';
```

Add these imports (place the chart import next to the other chart import, and extend the existing `dates`/repository imports):

```tsx
import { PaceChart } from '../../src/components/charts/PaceChart';
import { buildCumulativeSeries, comparePace, paceTodayIndex, type CumulativePoint } from '../../src/lib/pace';
```

Extend the existing `dates` import to add `isAtCurrent`:

```tsx
import { scopeRange, stepAnchor, lastNBuckets, isAtCurrent, type Scope } from '../../src/lib/dates';
```

- [ ] **Step 2: Add component state for the pace series**

Next to the other `useState` declarations (after `topExpenses`), add:

```tsx
  const [currSeries, setCurrSeries] = useState<CumulativePoint[]>([]);
  const [prevSeries, setPrevSeries] = useState<CumulativePoint[]>([]);
  const [todayIndex, setTodayIndex] = useState(0);
  const [isInProgress, setIsInProgress] = useState(true);
```

- [ ] **Step 3: Fetch the previous period's expenses inside the data effect**

In the `useFocusEffect` callback, the current `Promise.all` already fetches `periodExpenses` for the current range. Add a fetch for the previous range. Change:

```tsx
      const [currTotal, prevTotal, currCats, prevCats, periodExpenses] = await Promise.all([
        sumExpensesInBase(curr.start, curr.end),
        sumExpensesInBase(prev.start, prev.end),
        sumByCategoryInBase(curr.start, curr.end),
        sumByCategoryInBase(prev.start, prev.end),
        listExpenses({ start: curr.start, end: curr.end }),
      ]);
```

to:

```tsx
      const [currTotal, prevTotal, currCats, prevCats, periodExpenses, prevExpenses] = await Promise.all([
        sumExpensesInBase(curr.start, curr.end),
        sumExpensesInBase(prev.start, prev.end),
        sumByCategoryInBase(curr.start, curr.end),
        sumByCategoryInBase(prev.start, prev.end),
        listExpenses({ start: curr.start, end: curr.end }),
        listExpenses({ start: prev.start, end: prev.end }),
      ]);
```

- [ ] **Step 4: Build the series and store them (still inside the effect)**

Just before the `if (cancelled) return;` line, add:

```tsx
      const currentSeries = buildCumulativeSeries(periodExpenses, curr.start, curr.end);
      const previousSeries = buildCumulativeSeries(prevExpenses, prev.start, prev.end);
      const now = new Date();
      const current = isAtCurrent(scope, anchor, weekStart, now);
      const tIndex = paceTodayIndex(curr.start, curr.end, current, now);
```

Then in the existing block of setters (after `if (cancelled) return;`), add:

```tsx
      setCurrSeries(currentSeries);
      setPrevSeries(previousSeries);
      setTodayIndex(tIndex);
      setIsInProgress(current);
```

- [ ] **Step 5: Compute display arrays and render `PaceChart` instead of `DeltaHeader`**

First, **remove the two existing scalar lines** (they exist only to feed `DeltaHeader` and would collide with the new array names):

```tsx
  const currentDisplay = toDisplay(currentBase);
  const previousDisplay = toDisplay(previousBase);
```

Then, after the existing `displayTrendBars` computation (near the other `toDisplay`-based derivations), add:

```tsx
  const currentDisplay = currSeries.map(p => toDisplay(p.cumulativeBaseCents));
  const previousDisplay = prevSeries.map(p => toDisplay(p.cumulativeBaseCents));
  const cmp = comparePace(currSeries, prevSeries, todayIndex);
  const currentTotalDisplay = toDisplay(cmp.currentAtPoint);
  const deltaDisplay = cmp.prevAtPoint === null ? null : currentTotalDisplay - toDisplay(cmp.prevAtPoint);
```

Replace the `DeltaHeader` element:

```tsx
          <DeltaHeader
            currentDisplay={currentDisplay}
            previousDisplay={previousDisplay}
            displayCurrency={displayCurrency}
            hasPrevious={previousBase > 0}
          />
```

with:

```tsx
          <PaceChart
            scope={scope}
            currentDisplay={currentDisplay}
            previousDisplay={previousDisplay}
            todayIndex={todayIndex}
            isInProgress={isInProgress}
            currentTotalDisplay={currentTotalDisplay}
            deltaDisplay={deltaDisplay}
            displayCurrency={displayCurrency}
          />
```


- [ ] **Step 6: Delete `DeltaHeader`**

Run: `git rm src/components/DeltaHeader.tsx`

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 8: Run the unit tests (ensure nothing regressed)**

Run: `npm test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add app/(tabs)/stats.tsx
git commit -m "feat(stats): replace DeltaHeader with cumulative pace chart

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Manual verification in the app

No automated RN rendering tests; verify the chart visually.

- [ ] **Step 1: Launch the app**

Run: `npx expo start` and open on a device/emulator (or use the project's usual run flow).

- [ ] **Step 2: Verify on the Stats tab**

Confirm each:
- Top card is now the pace chart (no separate DeltaHeader). Headline shows the period total + a red "▲ … more" / green "▼ … less" chip.
- Two lines render: solid emerald (this period, up to today) + dashed faded slate (previous period, full length). A faint vertical "today" marker + dot sit at the current line's end while the period is in progress.
- Switch scope week → month → year: x-span and the "…last week/month/year" wording update; the year line is a smooth daily curve.
- Step the anchor back to a completed past period: both lines run full, the today marker disappears, and the chip reads "… than last <period>".
- Change the display currency (Settings): totals, lines, and the delta all rescale.
- A period with no previous data shows "No comparison data yet" and only the current line.
- The "Last 6 months" bar chart, category movers, and top expenses are unchanged below.

- [ ] **Step 3: Final commit (only if Step 2 required tweaks)**

```bash
git add -A
git commit -m "fix(pace): adjustments from manual verification

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-review notes (for the implementer)

- All spec requirements map to tasks: scope-aware behavior + headline (Task 4/5), to-date vs historical (`paceTodayIndex`, Task 3), comparison clamping (`comparePace`, Task 3), data via one query per period (Task 5), pure helper + component split (Tasks 2–4), edge cases (covered in tests + chart guards), testing (Tasks 1–3).
- Currency: all accumulation is base cents; display conversion happens last in the page via the existing `toDisplay`. Currency change re-runs via existing store subscription.
- Out of scope (do not build here): category drill-down, heatmap, "add another"/duplicate, budgets/target line, per-day toggle.

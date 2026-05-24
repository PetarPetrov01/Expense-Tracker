# Stats Trends & Movers — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Stats tab around period-over-period comparison: delta header, category movers (top up/down with sparklines), 6-month total trend, top 5 largest expenses for the period.

**Architecture:** A single scrolling screen wired to the shared `PeriodScope` (week/month/year only). Aggregation continues in base cents using the existing `sumExpensesInBase` / `sumByCategoryInBase` / `listExpenses` repository functions, with display-currency conversion at the render boundary. Three new presentational components, one new dates helper, and a small extension to `PeriodScope`. No schema changes.

**Tech Stack:** Expo SDK 54, React Native 0.81, expo-router, TypeScript, drizzle-orm + expo-sqlite, date-fns, zustand. No test runner is configured in this project; verification is via `npx tsc --noEmit`, `npx expo lint`, and manual app checks.

**Spec:** `docs/superpowers/specs/2026-05-24-stats-redesign-design.md`

---

## File Map

**Create:**
- `src/components/Sparkline.tsx` — stateless mini bar chart (~30 lines, no SVG).
- `src/components/DeltaHeader.tsx` — total + signed delta card.
- `src/components/CategoryMoversList.tsx` — owns up/down split + empty state; colocates the `CategoryMoverRow` sub-component because they change together and the row is small.
- `src/components/TopExpensesList.tsx` — slim list of top 5 expenses for the selected period.

**Modify:**
- `src/components/PeriodScope.tsx` — add optional `scopes?: Scope[]` prop to restrict the visible scope chips.
- `src/lib/dates.ts` — add `lastNBuckets(scope, n, anchor, weekStart)` helper used for both the per-category sparkline history and the 6-month total trend.
- `app/(tabs)/stats.tsx` — full rewrite, built up incrementally across four tasks.

**Untouched:** `src/components/charts/PeriodBarChart.tsx`, `src/repositories/expenses.ts`, `src/lib/fx.ts`, the schema, all of Home.

---

## Verification Conventions

- "Type-check passes" means `npx tsc --noEmit` exits 0.
- "Lint passes" means `npx expo lint` reports no new errors.
- "Manual: <thing>" means start the Expo dev server (`npx expo start --clear`) and observe the described behavior on a device or emulator. After the engineer has the app running once, subsequent tasks can rely on Fast Refresh — they don't need to restart unless a native dep changed.

---

### Task 1: Extend `PeriodScope` with a `scopes` prop

**Files:**
- Modify: `src/components/PeriodScope.tsx`

- [ ] **Step 1: Add the optional prop and filter the `SCOPES` array**

Replace the component signature and the rendering of the chips so that the chip row is driven by an optional whitelist. The Home tab passes nothing and gets all four chips; Stats will pass `['week', 'month', 'year']`.

```tsx
import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { theme } from '../theme';
import { useSettings } from '../stores/settings';
import {
  type Scope,
  stepAnchor,
  canGoForward,
  isAtCurrent,
  formatScope,
} from '../lib/dates';
import { ScopePickerSheet } from './ScopePickerSheet';

const ALL_SCOPES: { key: Scope; label: string }[] = [
  { key: 'day',   label: 'Day' },
  { key: 'week',  label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year',  label: 'Year' },
];

export function PeriodScope({
  scope, anchor, onScopeChange, onAnchorChange, scopes,
}: {
  scope: Scope;
  anchor: Date;
  onScopeChange: (s: Scope) => void;
  onAnchorChange: (d: Date) => void;
  scopes?: Scope[];
}) {
  const weekStart = useSettings(s => s.weekStart);
  const atCurrent = isAtCurrent(scope, anchor, weekStart);
  const forwardOk = canGoForward(scope, anchor, weekStart);
  const [pickerOpen, setPickerOpen] = useState(false);

  const visibleScopes = scopes
    ? ALL_SCOPES.filter(s => scopes.includes(s.key))
    : ALL_SCOPES;

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        {visibleScopes.map(s => (
          <Pressable
            key={s.key}
            onPress={() => onScopeChange(s.key)}
            style={{
              flex: 1, padding: theme.spacing.sm, borderRadius: theme.radius.pill, alignItems: 'center',
              backgroundColor: scope === s.key ? theme.colors.primary : theme.colors.surface,
            }}
          >
            <Text style={{ color: '#fff' }}>{s.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <ChevronButton icon="chevron-left" onPress={() => onAnchorChange(stepAnchor(scope, anchor, -1))} />
        <Pressable
          onPress={() => setPickerOpen(true)}
          style={{ flex: 1, height: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}
        >
          <Text style={{
            color: theme.colors.text, fontSize: 15, fontWeight: '600',
          }}>
            {formatScope(scope, anchor, weekStart)}
          </Text>
          <MaterialCommunityIcons name="chevron-down" size={18} color={theme.colors.text} />
        </Pressable>
        {forwardOk
          ? <ChevronButton icon="chevron-right" onPress={() => onAnchorChange(stepAnchor(scope, anchor, 1))} />
          : <View style={{ width: 36, height: 36 }} />}
        {!atCurrent && (
          <Pressable
            onPress={() => onAnchorChange(new Date())}
            style={{
              paddingHorizontal: 12, height: 36, borderRadius: 18,
              backgroundColor: theme.colors.primary,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Today</Text>
          </Pressable>
        )}
      </View>

      <ScopePickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={onAnchorChange}
        scope={scope}
        anchor={anchor}
        weekStart={weekStart}
      />
    </View>
  );
}

function ChevronButton({ icon, onPress }: { icon: 'chevron-left' | 'chevron-right'; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={{
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: theme.colors.surface2,
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <MaterialCommunityIcons name={icon} size={22} color={theme.colors.text} />
    </Pressable>
  );
}
```

- [ ] **Step 2: Run type-check**

Run: `npx tsc --noEmit`
Expected: exits 0, no errors.

- [ ] **Step 3: Manual sanity check Home**

Open the Home tab. Confirm all four chips (Day / Week / Month / Year) still render, switching between them still updates the data. Home does not pass `scopes`, so its behavior must be unchanged.

- [ ] **Step 4: Commit**

```bash
git add src/components/PeriodScope.tsx
git commit -m "feat(period-scope): accept optional scopes whitelist"
```

---

### Task 2: Add `lastNBuckets` helper to `src/lib/dates.ts`

This helper returns the last `n` buckets at the given scope's granularity, ending at the bucket that contains `anchor`. It powers both the per-category sparklines (scope-aware) and the 6-month total trend (always month-scope). One helper, two callers.

**Files:**
- Modify: `src/lib/dates.ts`

- [ ] **Step 1: Append the helper at the end of the file**

Add the following exports to `src/lib/dates.ts`. Do not change anything above; the existing functions stay as-is.

```ts
export type Bucket = { key: string; label: string; start: Date; end: Date };

export function lastNBuckets(scope: Scope, n: number, anchor: Date, weekStart: WeekStart): Bucket[] {
  const out: Bucket[] = [];
  for (let i = n - 1; i >= 0; i--) {
    // Walk backwards i scope-steps from the anchor, then compute that bucket's range.
    let a = anchor;
    for (let k = 0; k < i; k++) a = stepAnchor(scope, a, -1);
    const { start, end } = scopeRange(scope, a, weekStart);
    out.push({
      key: formatBucketKey(scope, start),
      label: formatBucketLabel(scope, start),
      start,
      end,
    });
  }
  return out;
}

function formatBucketKey(scope: Scope, d: Date): string {
  if (scope === 'day')   return format(d, 'yyyy-MM-dd');
  if (scope === 'week')  return format(d, "yyyy-'W'II");
  if (scope === 'month') return format(d, 'yyyy-MM');
  return format(d, 'yyyy');
}

function formatBucketLabel(scope: Scope, d: Date): string {
  if (scope === 'day')   return format(d, 'd MMM');
  if (scope === 'week')  return format(d, "'w'I");
  if (scope === 'month') return format(d, 'MMM');
  return format(d, 'yyyy');
}
```

Then update the existing `import` line at the top of the file so `format` is already in scope (it is) — no change needed; `format` is already imported. The helper composes the existing `stepAnchor` and `scopeRange`, both already exported from this file.

- [ ] **Step 2: Run type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/lib/dates.ts
git commit -m "feat(dates): add lastNBuckets helper"
```

---

### Task 3: Create `Sparkline` component

A tiny stateless bar-style sparkline driven by an array of numbers. Implemented with flex Views — no SVG dependency, even though `react-native-svg` exists in the project; flex is simpler for ~6 bars at 60px wide.

**Files:**
- Create: `src/components/Sparkline.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { View } from 'react-native';
import { theme } from '../theme';

export function Sparkline({
  values, width = 60, height = 20, color = theme.colors.primary,
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  const max = Math.max(1, ...values);
  return (
    <View style={{ width, height, flexDirection: 'row', alignItems: 'flex-end', gap: 1 }}>
      {values.map((v, i) => {
        const h = Math.max(2, (v / max) * height);
        return (
          <View
            key={i}
            style={{
              flex: 1,
              height: h,
              backgroundColor: color,
              borderTopLeftRadius: 1,
              borderTopRightRadius: 1,
              opacity: v === 0 ? 0.25 : 1,
            }}
          />
        );
      })}
    </View>
  );
}
```

- [ ] **Step 2: Run type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/Sparkline.tsx
git commit -m "feat(charts): add Sparkline component"
```

---

### Task 4: Create `DeltaHeader` component

Presentational hero card. Caller passes both totals already converted to display currency. The card decides arrow + color + percentage and handles the "no comparison" path.

**Files:**
- Create: `src/components/DeltaHeader.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { View, Text } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { theme } from '../theme';
import { formatAmount, type CurrencyCode } from '../lib/currency';

export function DeltaHeader({
  currentDisplay,
  previousDisplay,
  displayCurrency,
  hasPrevious,
}: {
  currentDisplay: number;
  previousDisplay: number;
  displayCurrency: CurrencyCode;
  hasPrevious: boolean;
}) {
  const diff = currentDisplay - previousDisplay;
  const pct = previousDisplay === 0 ? null : (diff / previousDisplay) * 100;
  const up = diff > 0;
  // Spending up = red (more money out), spending down = green.
  const deltaColor = up ? theme.colors.danger : theme.colors.primary;

  return (
    <View style={{
      padding: theme.spacing.md,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
      gap: 4,
    }}>
      <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>Total</Text>
      <Text style={{ color: theme.colors.text, fontSize: 32, fontWeight: '700' }}>
        {formatAmount(currentDisplay, displayCurrency)}
      </Text>
      {hasPrevious ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <MaterialCommunityIcons
            name={up ? 'arrow-up' : 'arrow-down'}
            size={16}
            color={deltaColor}
          />
          <Text style={{ color: deltaColor, fontSize: 13, fontWeight: '600' }}>
            {pct === null ? 'new' : `${Math.abs(pct).toFixed(0)}%`}
          </Text>
          <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>
            vs {formatAmount(previousDisplay, displayCurrency)} previous
          </Text>
        </View>
      ) : (
        <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>
          No comparison data yet
        </Text>
      )}
    </View>
  );
}
```

- [ ] **Step 2: Run type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/DeltaHeader.tsx
git commit -m "feat(stats): add DeltaHeader component"
```

---

### Task 5: Create `CategoryMoversList` (with colocated `CategoryMoverRow`)

Receives the assembled mover data already in display cents. Owns the up/down split and the empty/hidden state. The row uses `CategoryIcon` for the avatar and `Sparkline` for the trend.

**Files:**
- Create: `src/components/CategoryMoversList.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { View, Text } from 'react-native';
import { theme } from '../theme';
import { CategoryIcon } from './CategoryIcon';
import { Sparkline } from './Sparkline';
import { formatAmount, type CurrencyCode } from '../lib/currency';

export type Mover = {
  categoryId: number;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  currentDisplay: number;
  previousDisplay: number;
  historyDisplay: number[];
};

export function CategoryMoversList({
  movers,
  displayCurrency,
  hasPrevious,
}: {
  movers: Mover[];
  displayCurrency: CurrencyCode;
  hasPrevious: boolean;
}) {
  if (!hasPrevious) return null;

  const annotated = movers
    .map(m => ({ ...m, delta: m.currentDisplay - m.previousDisplay }))
    .filter(m => m.delta !== 0);

  const gainers = annotated
    .filter(m => m.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 3);

  const decliners = annotated
    .filter(m => m.delta < 0)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 3);

  if (gainers.length === 0 && decliners.length === 0) return null;

  return (
    <View style={{
      padding: theme.spacing.md,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
      gap: theme.spacing.md,
    }}>
      <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '600' }}>
        What's changing
      </Text>
      {gainers.length > 0 && (
        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>Up</Text>
          {gainers.map(m => (
            <CategoryMoverRow key={m.categoryId} mover={m} displayCurrency={displayCurrency} />
          ))}
        </View>
      )}
      {decliners.length > 0 && (
        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>Down</Text>
          {decliners.map(m => (
            <CategoryMoverRow key={m.categoryId} mover={m} displayCurrency={displayCurrency} />
          ))}
        </View>
      )}
    </View>
  );
}

function CategoryMoverRow({
  mover, displayCurrency,
}: {
  mover: Mover & { delta: number };
  displayCurrency: CurrencyCode;
}) {
  const up = mover.delta > 0;
  const isNew = mover.previousDisplay === 0;
  const isStopped = mover.currentDisplay === 0;
  const pct = mover.previousDisplay === 0
    ? null
    : (mover.delta / mover.previousDisplay) * 100;
  const deltaColor = up ? theme.colors.danger : theme.colors.primary;

  let badge: string;
  if (isNew) badge = 'new';
  else if (isStopped) badge = 'stopped';
  else badge = `${up ? '+' : '−'}${Math.abs(pct!).toFixed(0)}%`;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
      <CategoryIcon icon={mover.categoryIcon} color={mover.categoryColor} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.colors.text, fontSize: 14 }}>{mover.categoryName}</Text>
        <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>
          {formatAmount(mover.currentDisplay, displayCurrency)}
          {' · was '}
          {formatAmount(mover.previousDisplay, displayCurrency)}
        </Text>
      </View>
      <Sparkline values={mover.historyDisplay} color={mover.categoryColor} />
      <Text style={{ color: deltaColor, fontSize: 13, fontWeight: '600', minWidth: 56, textAlign: 'right' }}>
        {badge}
      </Text>
    </View>
  );
}
```

- [ ] **Step 2: Run type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/CategoryMoversList.tsx
git commit -m "feat(stats): add CategoryMoversList with row + sparkline"
```

---

### Task 6: Create `TopExpensesList`

Slim row variant for showing the top-N largest expenses for a period. Uses the same shape as `ExpenseRow` but more compact and without the originally-in-X subline.

**Files:**
- Create: `src/components/TopExpensesList.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { View, Text, Pressable } from 'react-native';
import { Link } from 'expo-router';
import { format } from 'date-fns';
import { CategoryIcon } from './CategoryIcon';
import { formatAmount, type CurrencyCode } from '../lib/currency';
import { theme } from '../theme';
import type { ExpenseWithCategory } from '../repositories/expenses';

export function TopExpensesList({
  expenses,
  toDisplay,
  displayCurrency,
}: {
  expenses: ExpenseWithCategory[];
  toDisplay: (baseCents: number) => number;
  displayCurrency: CurrencyCode;
}) {
  if (expenses.length === 0) return null;

  return (
    <View style={{
      padding: theme.spacing.md,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
      gap: theme.spacing.sm,
    }}>
      <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '600' }}>
        Largest expenses
      </Text>
      {expenses.map(e => {
        const baseCents = Math.round((e.amountCents * e.rateToBaseX1e6) / 1_000_000);
        const display = toDisplay(baseCents);
        return (
          <Link key={e.id} href={`/expense/${e.id}`} asChild>
            <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <CategoryIcon icon={e.categoryIcon} color={e.categoryColor} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.text, fontSize: 14 }} numberOfLines={1}>
                  {e.categoryName}{e.note ? ` · ${e.note}` : ''}
                </Text>
                <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>
                  {format(e.occurredAt, 'PP')}
                </Text>
              </View>
              <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '600' }}>
                {formatAmount(display, displayCurrency)}
              </Text>
            </Pressable>
          </Link>
        );
      })}
    </View>
  );
}
```

- [ ] **Step 2: Run type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/TopExpensesList.tsx
git commit -m "feat(stats): add TopExpensesList component"
```

---

### Task 7: Rewrite `app/(tabs)/stats.tsx` — scope picker + delta header

First incremental cut of the new Stats screen. Replaces the existing screen entirely. After this task the screen shows the restricted scope picker and the delta header (with current + previous totals). Movers / trend / top-5 land in the next tasks.

**Files:**
- Modify: `app/(tabs)/stats.tsx` (replace entire contents)

- [ ] **Step 1: Replace the file**

```tsx
import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { sumExpensesInBase } from '../../src/repositories/expenses';
import { PeriodScope } from '../../src/components/PeriodScope';
import { DeltaHeader } from '../../src/components/DeltaHeader';
import { EmptyState } from '../../src/components/EmptyState';
import { scopeRange, stepAnchor, type Scope } from '../../src/lib/dates';
import { useSettings } from '../../src/stores/settings';
import { useFxRates } from '../../src/stores/fxRates';
import { rateLookup, RATE_SCALE } from '../../src/lib/fx';
import { theme } from '../../src/theme';

const STATS_SCOPES: Scope[] = ['week', 'month', 'year'];

export default function Stats() {
  const displayCurrency = useSettings(s => s.displayCurrency);
  const weekStart = useSettings(s => s.weekStart);
  const rates = useFxRates(s => s.rates);

  const [scope, setScope] = useState<Scope>('month');
  const [anchor, setAnchor] = useState<Date>(new Date());
  const [currentBase, setCurrentBase] = useState(0);
  const [previousBase, setPreviousBase] = useState(0);
  const [hasPrevious, setHasPrevious] = useState(false);

  useFocusEffect(useCallback(() => {
    (async () => {
      const curr = scopeRange(scope, anchor, weekStart);
      const prevAnchor = stepAnchor(scope, anchor, -1);
      const prev = scopeRange(scope, prevAnchor, weekStart);

      const [currTotal, prevTotal] = await Promise.all([
        sumExpensesInBase(curr.start, curr.end),
        sumExpensesInBase(prev.start, prev.end),
      ]);

      setCurrentBase(currTotal);
      setPreviousBase(prevTotal);
      setHasPrevious(prevTotal > 0);
    })();
  }, [scope, anchor.getTime(), weekStart]));

  const eurToDisplay = rateLookup(rates, displayCurrency);
  const toDisplay = (baseCents: number) => Math.round((baseCents * eurToDisplay) / RATE_SCALE);
  const currentDisplay = toDisplay(currentBase);
  const previousDisplay = toDisplay(previousBase);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}
    >
      <PeriodScope
        scope={scope}
        anchor={anchor}
        onScopeChange={setScope}
        onAnchorChange={setAnchor}
        scopes={STATS_SCOPES}
      />
      {currentBase === 0 && previousBase === 0 ? (
        <View style={{
          padding: theme.spacing.md,
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.md,
        }}>
          <EmptyState icon="chart-line" title="No data" hint="No expenses in this range." />
        </View>
      ) : (
        <DeltaHeader
          currentDisplay={currentDisplay}
          previousDisplay={previousDisplay}
          displayCurrency={displayCurrency}
          hasPrevious={hasPrevious}
        />
      )}
    </ScrollView>
  );
}
```

- [ ] **Step 2: Run type-check and lint**

Run: `npx tsc --noEmit`
Expected: exits 0.

Run: `npx expo lint`
Expected: no new errors.

- [ ] **Step 3: Manual verify**

Start the dev server (`npx expo start --clear`) and open the Stats tab. Verify:
- Only three chips show: Week / Month / Year.
- Default scope is Month, anchor is today.
- The delta header renders the total for the current month and shows a comparison against last month (or "No comparison data yet" if last month was empty).
- Stepping the anchor backwards (←) shifts both the current total and the comparison.
- Empty database shows the "No data" empty state.

- [ ] **Step 4: Commit**

```bash
git add app/\(tabs\)/stats.tsx
git commit -m "feat(stats): rewrite as scope picker + delta header"
```

---

### Task 8: Wire `CategoryMoversList` into Stats

Add per-category aggregation for the current period, the previous period, and the last-6-bucket history per category. Pass to `CategoryMoversList`.

**Files:**
- Modify: `app/(tabs)/stats.tsx`

- [ ] **Step 1: Extend imports**

At the top of `app/(tabs)/stats.tsx`, replace the existing import block with:

```tsx
import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { sumExpensesInBase, sumByCategoryInBase } from '../../src/repositories/expenses';
import { PeriodScope } from '../../src/components/PeriodScope';
import { DeltaHeader } from '../../src/components/DeltaHeader';
import { CategoryMoversList, type Mover } from '../../src/components/CategoryMoversList';
import { EmptyState } from '../../src/components/EmptyState';
import { scopeRange, stepAnchor, lastNBuckets, type Scope } from '../../src/lib/dates';
import { useSettings } from '../../src/stores/settings';
import { useFxRates } from '../../src/stores/fxRates';
import { rateLookup, RATE_SCALE } from '../../src/lib/fx';
import { theme } from '../../src/theme';
```

- [ ] **Step 2: Add mover state and the aggregation effect**

Inside the component, immediately after `const [hasPrevious, setHasPrevious] = useState(false);`, add:

```tsx
const [movers, setMovers] = useState<Mover[]>([]);
```

Then replace the entire `useFocusEffect` block with the following expanded version. This fetches per-category sums for the current period, the previous period, and the last 6 buckets (at the picker's granularity), then assembles `Mover[]` in base cents and lets the render path convert to display.

```tsx
useFocusEffect(useCallback(() => {
  (async () => {
    const curr = scopeRange(scope, anchor, weekStart);
    const prevAnchor = stepAnchor(scope, anchor, -1);
    const prev = scopeRange(scope, prevAnchor, weekStart);

    const [currTotal, prevTotal, currCats, prevCats] = await Promise.all([
      sumExpensesInBase(curr.start, curr.end),
      sumExpensesInBase(prev.start, prev.end),
      sumByCategoryInBase(curr.start, curr.end),
      sumByCategoryInBase(prev.start, prev.end),
    ]);

    setCurrentBase(currTotal);
    setPreviousBase(prevTotal);
    setHasPrevious(prevTotal > 0);

    const buckets = lastNBuckets(scope, 6, anchor, weekStart);
    const bucketCats = await Promise.all(
      buckets.map(b => sumByCategoryInBase(b.start, b.end)),
    );

    // Union of category IDs that appear in current OR previous (no point sparkling
    // a category that has nothing in either side of the comparison).
    const ids = new Set<number>();
    for (const r of currCats) ids.add(r.categoryId);
    for (const r of prevCats) ids.add(r.categoryId);

    const currMap = new Map(currCats.map(r => [r.categoryId, r]));
    const prevMap = new Map(prevCats.map(r => [r.categoryId, Number(r.total)]));

    const assembled: Mover[] = [];
    for (const id of ids) {
      const meta = currMap.get(id) ?? prevCats.find(r => r.categoryId === id)!;
      const currentBase = Number(currMap.get(id)?.total ?? 0);
      const previousBase = prevMap.get(id) ?? 0;
      const history = bucketCats.map(rows => {
        const hit = rows.find(r => r.categoryId === id);
        return hit ? Number(hit.total) : 0;
      });
      assembled.push({
        categoryId: id,
        categoryName: meta.categoryName,
        categoryIcon: meta.categoryIcon,
        categoryColor: meta.categoryColor,
        currentDisplay: currentBase,    // converted in render step below
        previousDisplay: previousBase,
        historyDisplay: history,
      });
    }
    setMovers(assembled);
  })();
}, [scope, anchor.getTime(), weekStart]));
```

Note: the `currentDisplay` / `previousDisplay` / `historyDisplay` fields hold **base cents** at this stage; they are converted to display cents in the render pass below for type symmetry with `CategoryMoversList`.

- [ ] **Step 3: Convert movers to display in the render path and pass to the list**

Replace the existing render block with:

```tsx
const eurToDisplay = rateLookup(rates, displayCurrency);
const toDisplay = (baseCents: number) => Math.round((baseCents * eurToDisplay) / RATE_SCALE);
const currentDisplay = toDisplay(currentBase);
const previousDisplay = toDisplay(previousBase);
const displayMovers: Mover[] = movers.map(m => ({
  ...m,
  currentDisplay: toDisplay(m.currentDisplay),
  previousDisplay: toDisplay(m.previousDisplay),
  historyDisplay: m.historyDisplay.map(toDisplay),
}));

return (
  <ScrollView
    style={{ flex: 1, backgroundColor: theme.colors.bg }}
    contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}
  >
    <PeriodScope
      scope={scope}
      anchor={anchor}
      onScopeChange={setScope}
      onAnchorChange={setAnchor}
      scopes={STATS_SCOPES}
    />
    {currentBase === 0 && previousBase === 0 ? (
      <View style={{
        padding: theme.spacing.md,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.md,
      }}>
        <EmptyState icon="chart-line" title="No data" hint="No expenses in this range." />
      </View>
    ) : (
      <>
        <DeltaHeader
          currentDisplay={currentDisplay}
          previousDisplay={previousDisplay}
          displayCurrency={displayCurrency}
          hasPrevious={hasPrevious}
        />
        <CategoryMoversList
          movers={displayMovers}
          displayCurrency={displayCurrency}
          hasPrevious={hasPrevious}
        />
      </>
    )}
  </ScrollView>
);
```

- [ ] **Step 4: Run type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 5: Manual verify**

Reload the app. On the Stats tab with a multi-month database:
- "What's changing" appears below the delta header.
- Up to 3 rows under "Up" and 3 under "Down".
- A category that exists this period but not last shows "new"; a category that existed last period but is zero this period shows "stopped".
- Each row shows a 6-bucket sparkline matching the picker's granularity (switch scope → sparkline width per bar feels right).
- With no previous-period data, the entire "What's changing" section is absent.

- [ ] **Step 6: Commit**

```bash
git add app/\(tabs\)/stats.tsx
git commit -m "feat(stats): wire category movers with sparklines"
```

---

### Task 9: Add the 6-month total trend chart

Reuses the existing `PeriodBarChart`. The chart's window is fixed: last 6 calendar months ending at the current month, regardless of the picker's scope/anchor.

**Files:**
- Modify: `app/(tabs)/stats.tsx`

- [ ] **Step 1: Extend imports**

Update the existing import lines so the file imports both the chart and its `Bar` type:

```tsx
import { PeriodBarChart, type Bar } from '../../src/components/charts/PeriodBarChart';
```

- [ ] **Step 2: Add trend state**

After `const [movers, setMovers] = useState<Mover[]>([]);` add:

```tsx
const [trendBars, setTrendBars] = useState<Bar[]>([]);
```

- [ ] **Step 3: Fetch the 6-month total trend inside the focus effect**

Inside the existing focus-effect async block, **after** the `setMovers(assembled);` line, append:

```tsx
const monthBuckets = lastNBuckets('month', 6, new Date(), weekStart);
const monthTotals = await Promise.all(
  monthBuckets.map(b => sumExpensesInBase(b.start, b.end)),
);
setTrendBars(monthBuckets.map((b, i) => ({
  label: b.label,
  valueCents: monthTotals[i],
})));
```

Note: this uses `new Date()` (today), not `anchor`. The chart always shows the last 6 calendar months — by spec.

- [ ] **Step 4: Render the chart**

In the JSX, between `<CategoryMoversList ... />` and the closing `</>`, insert:

```tsx
<PeriodBarChart
  bars={trendBars.map(b => ({ label: b.label, valueCents: toDisplay(b.valueCents) }))}
  title="Last 6 months"
/>
```

- [ ] **Step 5: Run type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 6: Manual verify**

Reload the app. On Stats:
- Below the movers section, the 6-month total bars render with month labels.
- Stepping the picker anchor backwards does NOT change the 6-month chart — the chart is anchored on today, by spec.
- Switching scope to Week or Year also does not change the chart window — still last 6 months.

- [ ] **Step 7: Commit**

```bash
git add app/\(tabs\)/stats.tsx
git commit -m "feat(stats): add 6-month total trend chart"
```

---

### Task 10: Wire `TopExpensesList`

Final section. Fetches the top 5 largest expenses for the **selected** period (uses the picker's range, not the 6-month window).

**Files:**
- Modify: `app/(tabs)/stats.tsx`

- [ ] **Step 1: Extend imports**

Update existing imports:

```tsx
import { sumExpensesInBase, sumByCategoryInBase, listExpenses, type ExpenseWithCategory } from '../../src/repositories/expenses';
import { TopExpensesList } from '../../src/components/TopExpensesList';
```

- [ ] **Step 2: Add state**

After `const [trendBars, setTrendBars] = useState<Bar[]>([]);` add:

```tsx
const [topExpenses, setTopExpenses] = useState<ExpenseWithCategory[]>([]);
```

- [ ] **Step 3: Fetch top 5 in the focus effect**

Inside the focus effect, **after** the `setTrendBars(...)` call, append:

```tsx
const periodExpenses = await listExpenses({ start: curr.start, end: curr.end });
const topFive = [...periodExpenses]
  .sort((a, b) => {
    const aBase = Math.round((a.amountCents * a.rateToBaseX1e6) / 1_000_000);
    const bBase = Math.round((b.amountCents * b.rateToBaseX1e6) / 1_000_000);
    return bBase - aBase;
  })
  .slice(0, 5);
setTopExpenses(topFive);
```

- [ ] **Step 4: Render the list**

In the JSX, **after** `<PeriodBarChart ... />`, insert:

```tsx
<TopExpensesList
  expenses={topExpenses}
  toDisplay={toDisplay}
  displayCurrency={displayCurrency}
/>
```

- [ ] **Step 5: Run type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 6: Manual verify**

Reload the app and walk through:
- The Stats tab shows, in order: scope picker, delta header, "What's changing" (movers), "Last 6 months" chart, "Largest expenses".
- The "Largest expenses" list contains the top 5 expenses of the selected period only, sorted descending by display amount.
- Tapping a row opens the expense detail screen (existing `/expense/[id]` route).
- An empty period hides the list (no card shown).
- Switching scope to Year: top 5 reflects the whole year's largest expenses.

- [ ] **Step 7: Commit**

```bash
git add app/\(tabs\)/stats.tsx
git commit -m "feat(stats): add top 5 largest expenses section"
```

---

### Task 11: End-to-end manual verification + lint

The new screen is fully assembled. One final scrub before the PR.

- [ ] **Step 1: Run type-check and lint**

Run: `npx tsc --noEmit`
Expected: exits 0.

Run: `npx expo lint`
Expected: no new errors.

- [ ] **Step 2: Manual walkthrough**

With the dev server running:
- Open Stats. Confirm the order is: scope picker → delta header → movers → 6-month chart → top 5.
- Switch scope: Week → Month → Year. The delta header, movers, and top 5 update. The 6-month chart does not.
- Step the anchor backwards a few times. Delta header and movers update; 6-month chart does not.
- Tap "Today" pill (visible when anchor isn't current). Returns to the latest period.
- Create or delete an expense (Home tab → expense detail / FAB) and return to Stats — all four data-driven sections refresh via `useFocusEffect`.
- Empty database: confirm the "No data" empty state replaces the delta + downstream sections, and the 6-month chart shows its own empty state from `PeriodBarChart`.
- Confirm Home tab still works (scopes prop is optional; Home passes nothing).

- [ ] **Step 3: Open a PR**

Per repo convention (memory: title-only commits, detail in the PR body), open a PR with the spec linked in the body:

```bash
git push -u origin feat/stats-trends-and-movers
gh pr create --title "feat(stats): trends and movers redesign" --body "$(cat <<'EOF'
## Summary
Rebuilds the Stats tab around period-over-period comparison.

- Scope picker restricted to week / month / year.
- New: DeltaHeader, CategoryMoversList (with sparklines), TopExpensesList.
- Reuses PeriodBarChart for the fixed 6-month total trend.
- No schema changes; aggregation stays in base cents.

Spec: `docs/superpowers/specs/2026-05-24-stats-redesign-design.md`

## Test plan
- [ ] Stats tab renders in order: scope picker → delta header → movers → 6-month chart → top 5.
- [ ] Switching scope (week/month/year) updates header, movers, top 5; does not change 6-month chart.
- [ ] Stepping anchor updates header, movers, top 5; does not change 6-month chart.
- [ ] Empty DB shows "No data" empty state on Stats.
- [ ] Period with no previous-period data hides the movers section and shows "No comparison data yet" in the header.
- [ ] Home tab is unchanged (PeriodScope back-compat).
EOF
)"
```

---

## Self-Review

**Spec coverage:**
- Scope picker restricted to week/month/year → Task 1 + Task 7.
- Delta header (signed, color-coded, no-comparison path) → Task 4 + Task 7.
- Category movers with sparklines, two lists, new/stopped labels, sorted by absolute delta amount → Task 5 + Task 8.
- 6-month total trend (fixed window, ignores picker) → Task 9.
- Top 5 largest expenses for selected period → Task 6 + Task 10.
- Edge cases (no current data, no previous data, new/stopped categories) → handled inside the relevant components and the empty-state branch in Task 7.
- Reuse `PeriodScope`, `PeriodBarChart`, `EmptyState` → Tasks 1, 9, 7.
- Drop the day-scope on Stats, drop the Avg-per-period card → Task 7 (the rewrite drops both implicitly).
- All aggregation in base cents, conversion at render boundary → Tasks 7–10 follow this pattern explicitly.

**Placeholder scan:** No TBDs, no "add appropriate error handling", every code step contains complete code, every command has expected output. Task 5's `prevCats.find(...)` lookup for `meta` is defensive (in case a category exists in prev but not curr); the `!` non-null assertion is justified by construction — the id came from the union of both sets.

**Type consistency:** `Mover` defined in Task 5 is imported in Task 8. `Bar` from `PeriodBarChart` is reused in Task 9 (existing export). `Scope`, `scopeRange`, `stepAnchor`, `lastNBuckets` all exported from `src/lib/dates.ts` (the helper added in Task 2). `formatAmount` / `CurrencyCode` already exist in `src/lib/currency.ts`. `CategoryIcon` already exists. No type drift.

One inconsistency caught and fixed during review: in Task 8, the assembled `Mover` objects carry base-cents in fields named `currentDisplay`/`previousDisplay`/`historyDisplay` until the render step converts them. This dual use is documented in the Task 8 note so the engineer doesn't assume display-units at the wrong layer.

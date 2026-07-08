# Expense List + Category Drill-down Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated, filterable expense-list screen (period + category + tag + text search + sort), reachable from a "See all" link on Home and from a category-row tap on the Stats tab (pre-filtered to that category for the active period).

**Architecture:** One pushed Expo Router screen (`app/expenses/list.tsx`) fetches the period's expenses with the existing `listExpenses({ start, end })` and applies category/tag/search/sort **in memory** via a pure, unit-tested function (`filterAndSortExpenses`). Filter controls are an inline search field plus a row of chips that open bottom sheets. No repository or database changes.

**Tech Stack:** Expo SDK 54, Expo Router v6, React Native 0.81, React 19, Drizzle ORM (unchanged here), Vitest for unit tests. Styling is inline style objects driven by `src/theme.ts` (no Tailwind/NativeWind).

## Global Constraints

- **Expo SDK is 54.** Per `AGENTS.md`, consult https://docs.expo.dev/versions/v54.0.0/ before using any Expo/Router API you are unsure about.
- **No new npm dependencies.** Reuse what's installed.
- **Styling:** inline style objects using `theme.colors/spacing/radius` tokens from `src/theme.ts`. Match the existing components' style; do not introduce a styling library.
- **Money math:** all sums/sorts happen in **base cents** via `amountInBaseCents` from `src/lib/fx.ts`; convert to display currency exactly once at the end with `rateLookup`/`RATE_SCALE`, format with `formatAmount`.
- **Amounts are stored in cents; `rateToBaseX1e6` is scaled by 1,000,000.** Never do float money math outside these helpers.
- **TypeScript must stay clean:** `npx tsc --noEmit` passes. Lint stays clean: `npm run lint`.
- **Commit style:** title-only commit messages (no body). End with the `Co-Authored-By` trailer.

---

### Task 1: Pure filter + sort logic

The heart of the feature: a pure, currency-agnostic function that filters and sorts an array of `ExpenseWithCategory`. This is the only task with real unit tests (the rest is RN UI verified on-device).

**Files:**
- Create: `src/lib/expense-filter.ts`
- Test: `src/lib/expense-filter.test.ts`

**Interfaces:**
- Consumes: `ExpenseWithCategory` from `src/repositories/expenses.ts`; `amountInBaseCents` from `src/lib/fx.ts`.
- Produces:
  - `type SortKey = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'`
  - `type ExpenseFilter = { categoryId?: number | null; tagId?: number | null; search?: string; sort?: SortKey }`
  - `filterAndSortExpenses(items: ExpenseWithCategory[], filter: ExpenseFilter): ExpenseWithCategory[]`

- [ ] **Step 1: Write the failing test**

Create `src/lib/expense-filter.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { filterAndSortExpenses } from './expense-filter';
import type { ExpenseWithCategory } from '../repositories/expenses';

// Factory: full ExpenseWithCategory with sensible defaults, overridable per test.
function mk(over: Partial<ExpenseWithCategory>): ExpenseWithCategory {
  return {
    id: 1,
    amountCents: 100,
    currency: 'EUR',
    rateToBaseX1e6: 1_000_000, // 1:1 → base cents === amountCents
    categoryId: 1,
    tagId: null,
    note: null,
    occurredAt: new Date(2026, 0, 1),
    createdAt: new Date(2026, 0, 1),
    categoryName: 'Food',
    categoryIcon: 'food',
    categoryColor: '#10b981',
    tagName: null,
    ...over,
  };
}

describe('filterAndSortExpenses', () => {
  it('returns all items in date-desc order by default', () => {
    const a = mk({ id: 1, occurredAt: new Date(2026, 0, 1) });
    const b = mk({ id: 2, occurredAt: new Date(2026, 0, 3) });
    const result = filterAndSortExpenses([a, b], {});
    expect(result.map(e => e.id)).toEqual([2, 1]);
  });

  it('filters by categoryId', () => {
    const a = mk({ id: 1, categoryId: 1 });
    const b = mk({ id: 2, categoryId: 2 });
    const result = filterAndSortExpenses([a, b], { categoryId: 2 });
    expect(result.map(e => e.id)).toEqual([2]);
  });

  it('filters by tagId', () => {
    const a = mk({ id: 1, tagId: null });
    const b = mk({ id: 2, tagId: 7 });
    const result = filterAndSortExpenses([a, b], { tagId: 7 });
    expect(result.map(e => e.id)).toEqual([2]);
  });

  it('search matches the note case-insensitively', () => {
    const a = mk({ id: 1, note: 'Weekly Groceries' });
    const b = mk({ id: 2, note: 'Taxi' });
    const result = filterAndSortExpenses([a, b], { search: 'grocer' });
    expect(result.map(e => e.id)).toEqual([1]);
  });

  it('search matches the category name', () => {
    const a = mk({ id: 1, categoryName: 'Food' });
    const b = mk({ id: 2, categoryName: 'Transport' });
    const result = filterAndSortExpenses([a, b], { search: 'trans' });
    expect(result.map(e => e.id)).toEqual([2]);
  });

  it('empty/whitespace search is a no-op', () => {
    const a = mk({ id: 1 });
    const b = mk({ id: 2 });
    expect(filterAndSortExpenses([a, b], { search: '   ' })).toHaveLength(2);
  });

  it('a null note never matches a non-empty query', () => {
    const a = mk({ id: 1, note: null, categoryName: 'Food' });
    const result = filterAndSortExpenses([a], { search: 'xyz' });
    expect(result).toHaveLength(0);
  });

  it('sorts by amount using base cents across mixed currencies', () => {
    // b is 100 units at rate 2.0 → 200 base cents; a is 150 units at 1:1 → 150 base cents.
    const a = mk({ id: 1, amountCents: 150, rateToBaseX1e6: 1_000_000 });
    const b = mk({ id: 2, amountCents: 100, rateToBaseX1e6: 2_000_000 });
    expect(filterAndSortExpenses([a, b], { sort: 'amount-desc' }).map(e => e.id)).toEqual([2, 1]);
    expect(filterAndSortExpenses([a, b], { sort: 'amount-asc' }).map(e => e.id)).toEqual([1, 2]);
  });

  it('sorts by date ascending', () => {
    const a = mk({ id: 1, occurredAt: new Date(2026, 0, 1) });
    const b = mk({ id: 2, occurredAt: new Date(2026, 0, 3) });
    expect(filterAndSortExpenses([a, b], { sort: 'date-asc' }).map(e => e.id)).toEqual([1, 2]);
  });

  it('applies category + search + sort together', () => {
    const a = mk({ id: 1, categoryId: 1, note: 'lunch', amountCents: 500 });
    const b = mk({ id: 2, categoryId: 1, note: 'dinner', amountCents: 900 });
    const c = mk({ id: 3, categoryId: 2, note: 'lunch', amountCents: 300 });
    const result = filterAndSortExpenses([a, b, c], { categoryId: 1, search: 'lunch', sort: 'amount-desc' });
    expect(result.map(e => e.id)).toEqual([1]);
  });

  it('returns empty when filters exclude everything', () => {
    const a = mk({ id: 1, categoryId: 1 });
    expect(filterAndSortExpenses([a], { categoryId: 999 })).toHaveLength(0);
  });

  it('does not mutate the input array', () => {
    const a = mk({ id: 1, occurredAt: new Date(2026, 0, 1) });
    const b = mk({ id: 2, occurredAt: new Date(2026, 0, 3) });
    const input = [a, b];
    filterAndSortExpenses(input, { sort: 'date-asc' });
    expect(input.map(e => e.id)).toEqual([1, 2]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/expense-filter.test.ts`
Expected: FAIL — `Failed to resolve import "./expense-filter"` (module does not exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/lib/expense-filter.ts`:

```ts
import { amountInBaseCents } from './fx';
import type { ExpenseWithCategory } from '../repositories/expenses';

export type SortKey = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';

export type ExpenseFilter = {
  categoryId?: number | null;
  tagId?: number | null;
  search?: string;
  sort?: SortKey;
};

// Pure, currency-agnostic. Filters then sorts a copy; never mutates the input.
export function filterAndSortExpenses(
  items: ExpenseWithCategory[],
  filter: ExpenseFilter,
): ExpenseWithCategory[] {
  const { categoryId, tagId, search, sort = 'date-desc' } = filter;
  const q = search?.trim().toLowerCase() ?? '';

  const filtered = items.filter((e) => {
    if (categoryId != null && e.categoryId !== categoryId) return false;
    if (tagId != null && e.tagId !== tagId) return false;
    if (q) {
      const inNote = e.note ? e.note.toLowerCase().includes(q) : false;
      const inCategory = e.categoryName.toLowerCase().includes(q);
      if (!inNote && !inCategory) return false;
    }
    return true;
  });

  const sorted = [...filtered];
  switch (sort) {
    case 'date-asc':
      sorted.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
      break;
    case 'date-desc':
      sorted.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
      break;
    case 'amount-asc':
      sorted.sort((a, b) => amountInBaseCents(a) - amountInBaseCents(b));
      break;
    case 'amount-desc':
      sorted.sort((a, b) => amountInBaseCents(b) - amountInBaseCents(a));
      break;
  }
  return sorted;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/expense-filter.test.ts`
Expected: PASS — all 12 tests green.

- [ ] **Step 5: Verify types and lint**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npm run lint`
Expected: no errors for the new files.

- [ ] **Step 6: Commit**

```bash
git add src/lib/expense-filter.ts src/lib/expense-filter.test.ts
git commit -m "feat(expenses): pure filter + sort helper for expense list

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Extend EmptyState with an optional action

The filtered-empty state needs a "Clear filters" button. `EmptyState` currently renders only icon/title/hint; add an optional `action`.

**Files:**
- Modify: `src/components/EmptyState.tsx`

**Interfaces:**
- Produces: `EmptyState` now also accepts `action?: { label: string; onPress: () => void }`. Existing call sites (Home, Stats) are unaffected because `action` is optional.

- [ ] **Step 1: Replace the component**

Replace the entire contents of `src/components/EmptyState.tsx` with:

```tsx
import { View, Text, Pressable } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { theme } from '../theme';

export function EmptyState({
  icon = 'inbox',
  title,
  hint,
  action,
}: {
  icon?: string;
  title: string;
  hint?: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: theme.spacing.xl }}>
      <MaterialCommunityIcons name={icon as any} size={64} color={theme.colors.textMuted} />
      <Text style={{ color: theme.colors.text, fontSize: 18, marginTop: theme.spacing.md }}>{title}</Text>
      {hint && <Text style={{ color: theme.colors.textMuted, marginTop: 4, textAlign: 'center' }}>{hint}</Text>}
      {action && (
        <Pressable
          onPress={action.onPress}
          style={{
            marginTop: theme.spacing.lg,
            paddingVertical: theme.spacing.sm,
            paddingHorizontal: theme.spacing.lg,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.colors.primary,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}
```

- [ ] **Step 2: Verify types and lint**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/EmptyState.tsx
git commit -m "feat(ui): optional action button on EmptyState

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: TagPickerSheet component

A bottom-sheet tag picker, mirroring the existing `CategoryPickerSheet` animation/layout. (There is no existing tag *sheet* — `TagPicker` is an inline pill row for the add/edit form — so this is new but follows the same sheet pattern.)

**Files:**
- Create: `src/components/TagPickerSheet.tsx`

**Interfaces:**
- Consumes: `listTags()` from `src/repositories/tags.ts`; `Tag` from `src/db/schema`.
- Produces: `TagPickerSheet({ visible, onClose, onSelect }: { visible: boolean; onClose: () => void; onSelect: (t: Tag) => void })`.

- [ ] **Step 1: Create the component**

Create `src/components/TagPickerSheet.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, View, Text, Pressable, FlatList, StyleSheet } from 'react-native';
import { listTags } from '../repositories/tags';
import type { Tag } from '../db/schema';
import { theme } from '../theme';

const SLIDE_DISTANCE = 600;
const FADE_DURATION = 200;
const SLIDE_DURATION = 260;

export function TagPickerSheet({ visible, onClose, onSelect }: {
  visible: boolean; onClose: () => void; onSelect: (t: Tag) => void;
}) {
  const [items, setItems] = useState<Tag[]>([]);
  const [shouldRender, setShouldRender] = useState(visible);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(SLIDE_DISTANCE)).current;

  useEffect(() => { if (visible) listTags().then(setItems); }, [visible]);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 1, duration: FADE_DURATION,  useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: SLIDE_DURATION, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 0,              duration: FADE_DURATION,  useNativeDriver: true }),
        Animated.timing(translateY, { toValue: SLIDE_DISTANCE, duration: SLIDE_DURATION, useNativeDriver: true }),
      ]).start(({ finished }) => { if (finished) setShouldRender(false); });
    }
  }, [visible, opacity, translateY]);

  if (!shouldRender) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)', opacity }]}>
        <Pressable onPress={onClose} style={{ flex: 1 }} />
      </Animated.View>
      <Animated.View style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        backgroundColor: theme.colors.surface,
        padding: theme.spacing.lg,
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        maxHeight: '70%',
        transform: [{ translateY }],
      }}>
        <Text style={{ color: theme.colors.text, fontSize: 18, marginBottom: theme.spacing.md }}>Choose tag</Text>
        {items.length === 0 ? (
          <Text style={{ color: theme.colors.textMuted, paddingVertical: theme.spacing.md }}>No tags yet.</Text>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(t) => String(t.id)}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => { onSelect(item); onClose(); }}
                style={{ paddingVertical: theme.spacing.md }}
              >
                <Text style={{ color: theme.colors.text, fontSize: 16 }} numberOfLines={1}>{item.name}</Text>
              </Pressable>
            )}
            ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: theme.colors.border }} />}
          />
        )}
      </Animated.View>
    </Modal>
  );
}
```

- [ ] **Step 2: Verify types and lint**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/TagPickerSheet.tsx
git commit -m "feat(ui): TagPickerSheet bottom sheet

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: SortSheet component

A small bottom sheet with the four sort options, highlighting the current one.

**Files:**
- Create: `src/components/SortSheet.tsx`

**Interfaces:**
- Consumes: `SortKey` from `src/lib/expense-filter.ts` (Task 1).
- Produces: `SortSheet({ visible, selected, onClose, onSelect }: { visible: boolean; selected: SortKey; onClose: () => void; onSelect: (s: SortKey) => void })`.

- [ ] **Step 1: Create the component**

Create `src/components/SortSheet.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Text, Pressable, StyleSheet } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { SortKey } from '../lib/expense-filter';
import { theme } from '../theme';

const SLIDE_DISTANCE = 600;
const FADE_DURATION = 200;
const SLIDE_DURATION = 260;

const OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'date-desc',   label: 'Newest first' },
  { key: 'date-asc',    label: 'Oldest first' },
  { key: 'amount-desc', label: 'Amount: high to low' },
  { key: 'amount-asc',  label: 'Amount: low to high' },
];

export function SortSheet({ visible, selected, onClose, onSelect }: {
  visible: boolean; selected: SortKey; onClose: () => void; onSelect: (s: SortKey) => void;
}) {
  const [shouldRender, setShouldRender] = useState(visible);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(SLIDE_DISTANCE)).current;

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 1, duration: FADE_DURATION,  useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: SLIDE_DURATION, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 0,              duration: FADE_DURATION,  useNativeDriver: true }),
        Animated.timing(translateY, { toValue: SLIDE_DISTANCE, duration: SLIDE_DURATION, useNativeDriver: true }),
      ]).start(({ finished }) => { if (finished) setShouldRender(false); });
    }
  }, [visible, opacity, translateY]);

  if (!shouldRender) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)', opacity }]}>
        <Pressable onPress={onClose} style={{ flex: 1 }} />
      </Animated.View>
      <Animated.View style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        backgroundColor: theme.colors.surface,
        padding: theme.spacing.lg,
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        transform: [{ translateY }],
      }}>
        <Text style={{ color: theme.colors.text, fontSize: 18, marginBottom: theme.spacing.md }}>Sort by</Text>
        {OPTIONS.map((o) => {
          const active = o.key === selected;
          return (
            <Pressable
              key={o.key}
              onPress={() => { onSelect(o.key); onClose(); }}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: theme.spacing.md }}
            >
              <Text style={{ color: active ? theme.colors.primary : theme.colors.text, fontSize: 16 }}>{o.label}</Text>
              {active && <MaterialCommunityIcons name="check" size={20} color={theme.colors.primary} />}
            </Pressable>
          );
        })}
      </Animated.View>
    </Modal>
  );
}
```

- [ ] **Step 2: Verify types and lint**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/SortSheet.tsx
git commit -m "feat(ui): SortSheet bottom sheet

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: The dedicated list screen + FilterChips + route registration

The integration task. Creates the `FilterChips` presentational row and the screen that wires everything together, and registers the route. This is where you verify on-device.

**Files:**
- Create: `src/components/FilterChips.tsx`
- Create: `app/expenses/list.tsx`
- Modify: `app/_layout.tsx` (register the route in the `Stack`)

**Interfaces:**
- Consumes (from earlier tasks): `filterAndSortExpenses`, `SortKey` (Task 1); `EmptyState` with `action` (Task 2); `TagPickerSheet` (Task 3); `SortSheet` (Task 4). Also existing: `listExpenses`/`ExpenseWithCategory` (`src/repositories/expenses.ts`), `getCategory` (`src/repositories/categories.ts`), `ExpenseRow`, `PeriodScope`, `CategoryPickerSheet`, `rateLookup`/`RATE_SCALE`/`amountInBaseCents` (`src/lib/fx.ts`), `scopeRange`/`Scope` (`src/lib/dates.ts`), `formatAmount` (`src/lib/currency.ts`), `Category`/`Tag` (`src/db/schema`), `theme`.
- Produces: the route `/expenses/list`, accepting optional string params `categoryId`, `scope`, `anchor` (ms epoch), `customStart` (ms epoch), `customEnd` (ms epoch). Tasks 6 and 7 navigate to this route.

- [ ] **Step 1: Create the FilterChips component**

Create `src/components/FilterChips.tsx`:

```tsx
import { View, Text, Pressable } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { theme } from '../theme';

export function FilterChips({
  categoryLabel, tagLabel, sortLabel,
  onCategoryPress, onTagPress, onSortPress,
  onClearCategory, onClearTag,
}: {
  categoryLabel: string | null;
  tagLabel: string | null;
  sortLabel: string;
  onCategoryPress: () => void;
  onTagPress: () => void;
  onSortPress: () => void;
  onClearCategory: () => void;
  onClearTag: () => void;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
      <Chip
        icon="shape-outline"
        label={categoryLabel ?? 'Category'}
        active={categoryLabel != null}
        onPress={onCategoryPress}
        onClear={categoryLabel != null ? onClearCategory : undefined}
      />
      <Chip
        icon="tag-outline"
        label={tagLabel ?? 'Tag'}
        active={tagLabel != null}
        onPress={onTagPress}
        onClear={tagLabel != null ? onClearTag : undefined}
      />
      <Chip icon="sort" label={sortLabel} active onPress={onSortPress} />
    </View>
  );
}

function Chip({ icon, label, active, onPress, onClear }: {
  icon: string; label: string; active: boolean; onPress: () => void; onClear?: () => void;
}) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.pill, borderWidth: 1.5,
      borderColor: active ? theme.colors.primary : theme.colors.border,
      backgroundColor: active ? theme.colors.primary : theme.colors.surface,
    }}>
      <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <MaterialCommunityIcons name={icon as any} size={16} color={active ? '#fff' : theme.colors.text} />
        <Text style={{ color: active ? '#fff' : theme.colors.text, fontSize: 13 }}>{label}</Text>
      </Pressable>
      {onClear && (
        <Pressable onPress={onClear} hitSlop={8} style={{ marginLeft: 6 }}>
          <MaterialCommunityIcons name="close" size={14} color="#fff" />
        </Pressable>
      )}
    </View>
  );
}
```

- [ ] **Step 2: Create the screen**

Create `app/expenses/list.tsx`:

```tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, FlatList } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { startOfDay, endOfDay } from 'date-fns';
import { listExpenses, type ExpenseWithCategory } from '../../src/repositories/expenses';
import { getCategory } from '../../src/repositories/categories';
import { ExpenseRow } from '../../src/components/ExpenseRow';
import { EmptyState } from '../../src/components/EmptyState';
import { PeriodScope } from '../../src/components/PeriodScope';
import { FilterChips } from '../../src/components/FilterChips';
import { CategoryPickerSheet } from '../../src/components/CategoryPickerSheet';
import { TagPickerSheet } from '../../src/components/TagPickerSheet';
import { SortSheet } from '../../src/components/SortSheet';
import { filterAndSortExpenses, type SortKey } from '../../src/lib/expense-filter';
import { useSettings } from '../../src/stores/settings';
import { useFxRates } from '../../src/stores/fxRates';
import { rateLookup, RATE_SCALE, amountInBaseCents } from '../../src/lib/fx';
import { scopeRange, type Scope } from '../../src/lib/dates';
import { formatAmount } from '../../src/lib/currency';
import type { Category, Tag } from '../../src/db/schema';
import { theme } from '../../src/theme';

const SORT_LABELS: Record<SortKey, string> = {
  'date-desc': 'Newest',
  'date-asc': 'Oldest',
  'amount-desc': 'Highest',
  'amount-asc': 'Lowest',
};

export default function ExpenseListScreen() {
  const params = useLocalSearchParams<{
    categoryId?: string; scope?: string; anchor?: string; customStart?: string; customEnd?: string;
  }>();

  const displayCurrency = useSettings(s => s.displayCurrency);
  const weekStart = useSettings(s => s.weekStart);
  const rates = useFxRates(s => s.rates);

  const [scope, setScope] = useState<Scope>((params.scope as Scope) ?? 'month');
  const [anchor, setAnchor] = useState<Date>(params.anchor ? new Date(Number(params.anchor)) : new Date());
  const [customRange, setCustomRange] = useState<{ start: Date; end: Date } | null>(
    params.customStart && params.customEnd
      ? { start: new Date(Number(params.customStart)), end: new Date(Number(params.customEnd)) }
      : null,
  );

  const [items, setItems] = useState<ExpenseWithCategory[]>([]);

  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('date-desc');

  const [catOpen, setCatOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  // Seed the category filter from the route param (the Stats drill-down).
  useEffect(() => {
    if (!params.categoryId) return;
    getCategory(Number(params.categoryId)).then((c) => { if (c) setSelectedCategory(c); });
  }, [params.categoryId]);

  const customStartMs = customRange?.start.getTime();
  const customEndMs = customRange?.end.getTime();

  useFocusEffect(useCallback(() => {
    let start: Date;
    let end: Date;
    if (scope === 'custom') {
      if (!customRange) return;
      start = startOfDay(customRange.start);
      end = endOfDay(customRange.end);
    } else {
      ({ start, end } = scopeRange(scope, anchor, weekStart));
    }
    listExpenses({ start, end }).then(setItems);
  }, [scope, anchor.getTime(), weekStart, customStartMs, customEndMs]));

  const filtered = useMemo(
    () => filterAndSortExpenses(items, {
      categoryId: selectedCategory?.id ?? null,
      tagId: selectedTag?.id ?? null,
      search,
      sort,
    }),
    [items, selectedCategory?.id, selectedTag?.id, search, sort],
  );

  const eurToDisplay = rateLookup(rates, displayCurrency);
  const totalBase = filtered.reduce((sum, e) => sum + amountInBaseCents(e), 0);
  const totalDisplay = Math.round((totalBase * eurToDisplay) / RATE_SCALE);

  const hasActiveFilters = selectedCategory != null || selectedTag != null || search.trim() !== '';
  function clearFilters() {
    setSelectedCategory(null);
    setSelectedTag(null);
    setSearch('');
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <FlatList
        data={filtered}
        keyExtractor={(e) => String(e.id)}
        renderItem={({ item }) => <ExpenseRow e={item} />}
        contentContainerStyle={{ padding: theme.spacing.lg, gap: 10, paddingBottom: 96 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ gap: theme.spacing.md, marginBottom: theme.spacing.md }}>
            <PeriodScope
              scope={scope}
              anchor={anchor}
              onScopeChange={setScope}
              onAnchorChange={setAnchor}
              customRange={customRange}
              onCustomRangeChange={setCustomRange}
            />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search notes & categories"
              placeholderTextColor={theme.colors.textMuted}
              style={{
                backgroundColor: theme.colors.surface,
                padding: theme.spacing.md,
                borderRadius: theme.radius.md,
                color: theme.colors.text,
              }}
            />
            <FilterChips
              categoryLabel={selectedCategory?.name ?? null}
              tagLabel={selectedTag?.name ?? null}
              sortLabel={SORT_LABELS[sort]}
              onCategoryPress={() => setCatOpen(true)}
              onTagPress={() => setTagOpen(true)}
              onSortPress={() => setSortOpen(true)}
              onClearCategory={() => setSelectedCategory(null)}
              onClearTag={() => setSelectedTag(null)}
            />
            <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>
              {filtered.length} {filtered.length === 1 ? 'expense' : 'expenses'} · {formatAmount(totalDisplay, displayCurrency)}
            </Text>
          </View>
        }
        ListEmptyComponent={
          hasActiveFilters
            ? (
              <EmptyState
                icon="filter-remove"
                title="No matches"
                hint="No expenses match your filters."
                action={{ label: 'Clear filters', onPress: clearFilters }}
              />
            )
            : <EmptyState icon="cash-remove" title="No expenses" hint="No records in this period." />
        }
      />

      <CategoryPickerSheet visible={catOpen} onClose={() => setCatOpen(false)} onSelect={setSelectedCategory} />
      <TagPickerSheet visible={tagOpen} onClose={() => setTagOpen(false)} onSelect={setSelectedTag} />
      <SortSheet visible={sortOpen} selected={sort} onClose={() => setSortOpen(false)} onSelect={setSort} />
    </View>
  );
}
```

- [ ] **Step 3: Register the route**

In `app/_layout.tsx`, add the screen inside the `<Stack>` (after the `expense/[id]` line, line 81):

```tsx
        <Stack.Screen name="expenses/list" options={{ headerShown: true, title: 'Expenses' }} />
```

- [ ] **Step 4: Verify types and lint**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npm run lint`
Expected: no errors.

- [ ] **Step 5: Verify on device**

The Expo dev client is running with adb connected. Reload the app, then temporarily reach the screen by editing the URL: in a JS console or via a quick manual navigation. Since the "See all" / drill-down entry points arrive in Tasks 6–7, verify this task by temporarily adding a debug link OR proceed to Task 6 first and verify together.

Recommended: implement Task 6 (Home "See all") next, then verify the screen live:
- Open the screen from Home.
- Confirm: PeriodScope switches periods and the list updates; typing in search filters live; Category chip opens the picker and filtering works, chip shows the name with an ✕ that clears; Tag chip works (or shows "No tags yet"); Sort chip changes order; the summary line shows the correct count and total in the display currency; clearing all filters with active filters shows the "No matches" state with a working "Clear filters" button.

- [ ] **Step 6: Commit**

```bash
git add src/components/FilterChips.tsx app/expenses/list.tsx app/_layout.tsx
git commit -m "feat(expenses): dedicated filterable expense list screen

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: "See all" entry point on Home

Add a "See all" link beside the Home list's "History" title that opens the new screen, carrying Home's current period.

**Files:**
- Modify: `app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: the `/expenses/list` route (Task 5).

- [ ] **Step 1: Import `router`**

In `app/(tabs)/index.tsx`, change the `expo-router` import (line 3) from:

```tsx
import { Link, useFocusEffect } from 'expo-router';
```

to:

```tsx
import { Link, router, useFocusEffect } from 'expo-router';
```

- [ ] **Step 2: Replace the "History" title with a title + "See all" row**

In `app/(tabs)/index.tsx`, replace this block (lines 104–106):

```tsx
            <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '600', marginTop: theme.spacing.sm }}>
              History
            </Text>
```

with:

```tsx
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: theme.spacing.sm }}>
              <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '600' }}>
                History
              </Text>
              <Pressable
                hitSlop={8}
                onPress={() => router.push({
                  pathname: '/expenses/list',
                  params: {
                    scope,
                    anchor: String(anchor.getTime()),
                    ...(scope === 'custom' && customRange
                      ? { customStart: String(customRange.start.getTime()), customEnd: String(customRange.end.getTime()) }
                      : {}),
                  },
                })}
              >
                <Text style={{ color: theme.colors.primary, fontSize: 14 }}>See all</Text>
              </Pressable>
            </View>
```

(`Pressable` and `View` are already imported in this file; `scope`, `anchor`, and `customRange` are already in scope.)

- [ ] **Step 3: Verify types and lint**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Verify on device**

Reload the app. On Home, tap "See all" next to History. The dedicated list opens with the same period Home was showing. Run through the Task 5 Step 5 checklist here.

- [ ] **Step 5: Commit**

```bash
git add "app/(tabs)/index.tsx"
git commit -m "feat(home): See all link opens the full expense list

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Category drill-down from the Stats tab

Make the `CategoryMoversList` rows pressable so tapping a category opens the list filtered to that category for the Stats tab's active period.

**Files:**
- Modify: `src/components/CategoryMoversList.tsx`
- Modify: `app/(tabs)/stats.tsx`

**Interfaces:**
- Consumes: the `/expenses/list` route (Task 5).
- `CategoryMoversList` gains required props `scope: Scope` and `anchor: Date`; `stats.tsx` passes them.

- [ ] **Step 1: Update CategoryMoversList imports and props**

In `src/components/CategoryMoversList.tsx`, replace the imports (lines 1–5):

```tsx
import { View, Text } from 'react-native';
import { theme } from '../theme';
import { CategoryIcon } from './CategoryIcon';
import { Sparkline } from './Sparkline';
import { formatAmount, type CurrencyCode } from '../lib/currency';
```

with:

```tsx
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { theme } from '../theme';
import { CategoryIcon } from './CategoryIcon';
import { Sparkline } from './Sparkline';
import { formatAmount, type CurrencyCode } from '../lib/currency';
import type { Scope } from '../lib/dates';
```

- [ ] **Step 2: Thread `scope`/`anchor` through the list props**

In `src/components/CategoryMoversList.tsx`, change the `CategoryMoversList` signature (lines 17–27) from:

```tsx
export function CategoryMoversList({
  movers,
  displayCurrency,
  hasPrevious,
  toDisplay,
}: {
  movers: Mover[];
  displayCurrency: CurrencyCode;
  hasPrevious: boolean;
  toDisplay: (cents: number) => number;
}) {
```

to:

```tsx
export function CategoryMoversList({
  movers,
  displayCurrency,
  hasPrevious,
  toDisplay,
  scope,
  anchor,
}: {
  movers: Mover[];
  displayCurrency: CurrencyCode;
  hasPrevious: boolean;
  toDisplay: (cents: number) => number;
  scope: Scope;
  anchor: Date;
}) {
```

- [ ] **Step 3: Pass `scope`/`anchor` to each row**

In `src/components/CategoryMoversList.tsx`, both `CategoryMoverRow` usages (the gainers map ~line 85 and the decliners map ~line 99) currently read:

```tsx
            <CategoryMoverRow
              key={m.categoryId}
              mover={m}
              displayCurrency={displayCurrency}
              toDisplay={toDisplay}
            />
```

Add `scope` and `anchor` to **both**:

```tsx
            <CategoryMoverRow
              key={m.categoryId}
              mover={m}
              displayCurrency={displayCurrency}
              toDisplay={toDisplay}
              scope={scope}
              anchor={anchor}
            />
```

- [ ] **Step 4: Make the row pressable**

In `src/components/CategoryMoversList.tsx`, change the `CategoryMoverRow` signature (lines 112–118) from:

```tsx
function CategoryMoverRow({
  mover, displayCurrency, toDisplay,
}: {
  mover: Mover & { delta: number };
  displayCurrency: CurrencyCode;
  toDisplay: (cents: number) => number;
}) {
```

to:

```tsx
function CategoryMoverRow({
  mover, displayCurrency, toDisplay, scope, anchor,
}: {
  mover: Mover & { delta: number };
  displayCurrency: CurrencyCode;
  toDisplay: (cents: number) => number;
  scope: Scope;
  anchor: Date;
}) {
```

Then change the row's outer wrapper from `<View ...>` (line 142) to a `<Pressable>` that navigates, and its closing `</View>` (line 156) to `</Pressable>`:

```tsx
    <Pressable
      onPress={() => router.push({
        pathname: '/expenses/list',
        params: {
          categoryId: String(mover.categoryId),
          scope,
          anchor: String(anchor.getTime()),
        },
      })}
      style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}
    >
```

(The inner content — `CategoryIcon`, the name/amount `View`, `Sparkline`, and the delta `Text` — is unchanged.)

- [ ] **Step 5: Pass `scope`/`anchor` from the Stats screen**

In `app/(tabs)/stats.tsx`, the `CategoryMoversList` usage (lines 171–176) reads:

```tsx
          <CategoryMoversList
            movers={movers}
            displayCurrency={displayCurrency}
            hasPrevious={previousBase > 0}
            toDisplay={toDisplay}
          />
```

Add `scope` and `anchor` (both already in scope in `stats.tsx`):

```tsx
          <CategoryMoversList
            movers={movers}
            displayCurrency={displayCurrency}
            hasPrevious={previousBase > 0}
            toDisplay={toDisplay}
            scope={scope}
            anchor={anchor}
          />
```

- [ ] **Step 6: Verify types and lint**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npm run lint`
Expected: no errors.

- [ ] **Step 7: Verify on device**

Reload the app. On the Stats tab (pick a period with category movers, e.g. Month), tap a category row under "Up" or "Down". The list opens filtered to that category (the Category chip shows its name) for the same period. Confirm the expenses shown all belong to that category and match the period.

- [ ] **Step 8: Commit**

```bash
git add src/components/CategoryMoversList.tsx "app/(tabs)/stats.tsx"
git commit -m "feat(stats): category rows drill into the filtered expense list

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Dedicated pushed screen `app/expenses/list.tsx` with back header "Expenses" → Task 5 (+ route registration).
- Route params `categoryId`/`scope`/`anchor`/`customStart`/`customEnd` seeded into state → Task 5.
- Layout: PeriodScope, search, filter chips, summary line, FlatList of ExpenseRow → Task 5.
- Category (single-select), tag, search, sort filters → Task 1 (logic) + Tasks 3/4 (tag & sort UI) + Task 5 (wiring); category reuses existing `CategoryPickerSheet`.
- Client-side filtering via `listExpenses` + `useMemo` + pure `filterAndSortExpenses`; no repo changes → Tasks 1, 5.
- Summary total in display currency via fx helpers → Task 5.
- Home "See all" entry point → Task 6.
- Stats category drill-down (pressable rows, active period) → Task 7.
- Empty states: no-expenses vs filtered-empty with "Clear filters" → Task 2 (EmptyState action) + Task 5.
- Unit tests for the pure filter → Task 1.
- On-device manual verification → Tasks 5–7.

**Placeholder scan:** No TBD/TODO; every code step shows complete code. Task 5 Step 5 defers live verification to Task 6, which is a sequencing note, not a placeholder — the code is complete.

**Type consistency:** `SortKey`/`ExpenseFilter`/`filterAndSortExpenses` defined in Task 1 and consumed with matching signatures in Tasks 4 and 5. `EmptyState`'s `action` prop (Task 2) matches its use in Task 5. `CategoryMoversList` gains `scope: Scope`/`anchor: Date` in Task 7 and Stats passes exactly those. Route params are all strings (ms-epoch for dates), parsed with `Number(...)` on read.

**Note reconciled from the spec:** the spec referred to an "existing tag picker sheet," but the repo's `TagPicker` is an inline pill row for the add/edit form. Task 3 adds a proper `TagPickerSheet` mirroring `CategoryPickerSheet`, keeping the chips-open-sheets UX consistent.

## Out of scope (tracked elsewhere)

- Multi-select category filtering (deliberately single-select).
- Spending heatmap, "add another"/duplicate, budgets — separate roadmap items.
- Persisting last-used filters across launches; bulk actions on the list.

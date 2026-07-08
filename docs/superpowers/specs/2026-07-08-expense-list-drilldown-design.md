# Expense List + Category Drill-down — Design

**Date:** 2026-07-08
**Status:** Approved (brainstorm) — pending implementation plan
**Scope:** A dedicated, filterable expense-list screen plus a category drill-down entry point from the stats tab. One feature. Other roadmap items (spending heatmap, "add another"/duplicate, budgets) are tracked separately in `docs/roadmap.md` and their own specs.

## Problem

The Home tab (`app/(tabs)/index.tsx`) already shows a period-filtered list of expenses (newest-first, alongside the pie chart), but it only filters by `PeriodScope` (day/week/month/year/custom). There is no way to:

- Narrow the list by **category**, **tag**, or a **text search** of the note.
- **Sort** by anything other than newest-first.
- Jump from a category on the **stats tab** into "show me that category's expenses for this period."

The roadmap calls for a full, filterable expense-list screen and a category drill-down, explicitly built as **one list, two entry points** (full list + filtered-by-category), because the drill-down is just a filtered instance of the same list.

## Solution

A new **dedicated, pushed screen** — `app/expenses/list.tsx` — that reuses the app's existing list primitives and adds category/tag/search/sort on top of the period scope. It is reachable from two places:

1. **Home** — a "See all" link next to the list's section title.
2. **Stats** — tapping a category row in `CategoryMoversList` opens the screen pre-filtered to that category for the stats tab's active period.

All filtering and sorting happens **client-side** on the period's already-fetched expenses (chosen approach — see "Data" below). The Home list and the repository layer are unchanged except for the new "See all" link.

## Screen: `app/expenses/list.tsx`

A regular pushed `Stack` screen (not a modal) with a back header titled **"Expenses"**. Registered in the root `Stack` in `app/_layout.tsx`.

### Route params

All optional strings, read once on mount via `useLocalSearchParams` and used to seed local state:

| Param | Purpose |
|-------|---------|
| `categoryId` | Pre-selects the category filter (the stats drill-down). |
| `scope` | Seeds `PeriodScope` (`day`\|`week`\|`month`\|`year`\|`custom`). |
| `anchor` | ms-epoch anchor date for the scope. |
| `customStart`, `customEnd` | ms-epoch bounds when `scope === 'custom'`. |

When no params are given (a hypothetical direct open), the screen defaults to `month` anchored at the current date — matching the Home default.

### Layout (top → bottom)

1. **`PeriodScope`** (existing component) — controls `scope` / `anchor` / `customRange`.
2. **Search field** — a `TextInput` styled to the theme. Case-insensitive substring match against the expense `note` and its `categoryName`. Filters as the user types.
3. **Filter chips row** — a horizontal row of chips: `Category`, `Tag`, `Sort`.
   - Tapping `Category` opens the existing category picker sheet; `Tag` opens the existing tag picker sheet; `Sort` opens a small sort sheet.
   - An **active** filter renders as a filled chip showing its value (e.g. the category name, the tag name, or the sort label) with an ✕ affordance to clear it. Inactive filters render as outline chips with the default label.
4. **Summary line** — `N expenses · <total>` where `<total>` is the summed amount of the **filtered** set in the display currency.
5. **`FlatList`** of **`ExpenseRow`** (reused as-is — it already converts to display currency and links to `/expense/[id]` for editing). `ListEmptyComponent` = `EmptyState` (see States).

## Filter state & logic

Local component state:

- `scope`, `anchor`, `customRange` — same shape and handling as the Home screen.
- `categoryId: number | null` — **single-select** (matches the drill-down; reuses the existing category picker sheet). Seeded from the `categoryId` param.
- `tagId: number | null` — single-select via the existing tag picker sheet.
- `search: string`.
- `sort: SortKey` — one of `date-desc` (default), `date-asc`, `amount-desc`, `amount-asc`.

### Pure helper: `filterAndSortExpenses`

New pure function (location: `src/lib/expense-filter.ts`), currency-agnostic and unit-testable:

```
type SortKey = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';

type ExpenseFilter = {
  categoryId?: number | null;
  tagId?: number | null;
  search?: string;
  sort?: SortKey;
};

filterAndSortExpenses(
  items: ExpenseWithCategory[],
  filter: ExpenseFilter,
): ExpenseWithCategory[]
```

- **Category filter:** keep rows where `categoryId` matches (skip when null/undefined).
- **Tag filter:** keep rows where `tagId` matches (skip when null/undefined).
- **Search:** case-insensitive substring; matches when the trimmed query is empty (no filter) or is contained in `note` or `categoryName`. A `null` note never matches a non-empty query.
- **Sort:** date sorts on `occurredAt`; amount sorts on **base cents** (`amountInBaseCents`) so mixed-currency expenses compare fairly. Default `date-desc` mirrors the existing list order.
- Returns a new array; does not mutate the input.

## Data

**Approach A (client-side filtering).** The screen fetches the period's expenses once and filters/sorts in memory. No repository changes.

- In a `useFocusEffect`, compute `start` / `end` from `scope` / `anchor` / `customRange` (same logic as Home, using `scopeRange` and the `custom` branch) and call the existing **`listExpenses({ start, end })`** → `items` (`ExpenseWithCategory[]`).
- `const filtered = useMemo(() => filterAndSortExpenses(items, { categoryId, tagId, search, sort }), [items, categoryId, tagId, search, sort])`.
- **Summary total:** sum `filtered` base cents via the existing `amountInBaseCents`, convert to display currency with the page's existing `toDisplay` helper, format with `formatAmount`.

Rationale: a personal tracker's per-period set is small; in-memory filtering makes search-as-you-type instant, keeps `listExpenses` untouched, and isolates the logic in one tested pure function. If data volume ever grows, the in-memory step can be swapped for a parametrized DB query without changing the screen's shape.

## Entry points

### Home — "See all" link

In `app/(tabs)/index.tsx`, add a **"See all"** link beside the expense list's section title. It pushes the new screen carrying Home's current period so context is preserved:

```
router.push({
  pathname: '/expenses/list',
  params: { scope, anchor: String(anchor.getTime()), /* + customStart/customEnd when custom */ },
})
```

The Home list itself is unchanged — it remains the period-filtered preview.

### Stats — category drill-down

In `src/components/CategoryMoversList.tsx`, make `CategoryMoverRow` pressable (wrap in `Link`/`Pressable`, matching `ExpenseRow`'s pattern). Tapping pushes the list filtered to that category for the stats tab's **active period**:

```
router.push({
  pathname: '/expenses/list',
  params: { categoryId: String(mover.categoryId), scope, anchor: String(anchor.getTime()), /* + custom */ },
})
```

`app/(tabs)/stats.tsx` passes its current `scope`/`anchor` (and custom range) down so `CategoryMoversList` can build the params. Only the category rows become interactive; the sparklines, badges, and the rest of the stats tab are unchanged.

## States

- **No expenses in the period at all** → existing `EmptyState` ("No expenses" style, consistent with Home).
- **Expenses exist but the active filters exclude all of them** → `EmptyState` with a filters-specific message ("No expenses match your filters") and a **Clear filters** action that resets `categoryId` / `tagId` / `search` (leaving the period scope intact).
- If `EmptyState` does not already accept a custom message + optional action, extend it minimally to do so.

## Components

- **New:** `app/expenses/list.tsx` — the screen.
- **New:** `src/lib/expense-filter.ts` — `filterAndSortExpenses` + `SortKey`/`ExpenseFilter` types.
- **New:** `src/lib/expense-filter.test.ts` — Vitest unit tests.
- **New:** `src/components/FilterChips.tsx` — the chips row (Category/Tag/Sort), rendering active/inactive states and emitting open-sheet / clear callbacks. Kept small and presentational; the screen owns the sheets and state.
- **Changed:** `app/_layout.tsx` — register the `expenses/list` route in the `Stack`.
- **Changed:** `app/(tabs)/index.tsx` — add the "See all" link.
- **Changed:** `src/components/CategoryMoversList.tsx` — pressable category rows.
- **Changed:** `app/(tabs)/stats.tsx` — pass `scope`/`anchor`/custom range into `CategoryMoversList`.
- **Possibly changed:** `src/components/EmptyState.tsx` — accept a message + optional action if not already supported.

Reused as-is: `ExpenseRow`, `PeriodScope`, the category and tag picker sheets, the `fx`/`currency` helpers, and the theme.

## Edge cases

- **Category deleted / not in the period** → the category filter simply yields an empty set; the filtered-empty `EmptyState` + Clear filters covers it.
- **Multi-currency expenses** → all comparisons/sums use base cents via `amountInBaseCents`; display conversion happens last. A display-currency change re-derives the summary (already wired through the store).
- **Custom range** → passed through as `customStart`/`customEnd` params and rehydrated into `customRange`; the `custom` branch of the range computation matches Home.
- **Drill-down into a period with no data for that category** → filtered-empty state.
- **Search matches note vs category name** → both are searched; a `null` note is treated as no match for a non-empty query.
- **Rapid typing** → filtering is a `useMemo` over an in-memory array; no debounce needed, but search state is independent of the data fetch so keystrokes never re-query the DB.

## Testing

Unit tests (Vitest, pure helper — no RN rendering):

- `filterAndSortExpenses`:
  - no filters → returns all, default `date-desc` order.
  - category filter only → keeps just that category.
  - tag filter only → keeps just that tag.
  - search: case-insensitive; matches note; matches category name; empty query is a no-op; `null` note excluded for a non-empty query.
  - each sort order (`date-asc`, `date-desc`, `amount-asc`, `amount-desc`), with amount sorting on base cents across mixed currencies.
  - combined filters (category + search + sort) applied together.
  - filters excluding everything → empty array.
  - input array is not mutated.

Manual verification on-device via Expo (adb connected): the two entry points, live filtering/sorting, the summary total, and both empty states.

## Out of scope (tracked elsewhere)

- Multi-select category filtering — deliberately single-select for this feature.
- Spending heatmap, "add another" / duplicate expense, budgets — separate roadmap items and specs.
- Bulk actions (multi-delete, bulk re-categorize) on the list — not now.
- Persisting the last-used filters across app launches — not now.

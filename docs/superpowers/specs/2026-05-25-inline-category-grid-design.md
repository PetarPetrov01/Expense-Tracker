# Inline Category Grid on Expense Add/Edit — Design

**Date:** 2026-05-25
**Status:** Approved, ready for implementation plan

## 1. Problem

The expense add (`app/expense/new.tsx`) and edit (`app/expense/[id].tsx`) screens currently expose category selection through a single "Choose category" row that opens a full bottom-sheet (`CategoryPickerSheet`). Picking a category is always a two-tap operation, even for the handful of categories the user touches every day.

## 2. Goal

Inline the most-used categories directly on the form as a 4×2 tappable grid (7 categories + a "More" tile). The full-sheet picker remains as the fallback for less-used categories and gains an entry point into category management.

Scope is limited to category selection. Other parts of the form (amount input, date field, note, save) are unchanged.

## 3. Ranking — top 7 categories

- **Source:** count of expenses with `occurredAt >= now - 90 days`.
- **Tie-break:** most recent `occurredAt` desc.
- **Fallback fill:** if fewer than 7 categories have any usage in the window, fill the remainder by alphabetical name from all categories.
- **More tile:** always present at position 8, even if total categories ≤ 7. This guarantees the "Manage categories" entry point is reachable from the form.

### Repository function

New function in `src/repositories/categories.ts`:

```ts
listTopCategoriesByUsage(opts: { sinceDays: number; limit: number }): Promise<Category[]>
```

Single LEFT JOIN `categories ⟕ expenses` filtered by `expenses.occurredAt >= cutoff`, grouped by category id, ordered by `count(expenses.id) desc, max(expenses.occurredAt) desc, categories.name asc`, limited to `limit`. Categories with zero count come through naturally via the LEFT JOIN and fill remaining slots after the used ones.

## 4. Display promotion

When the currently-selected category isn't in the fetched top-7, it is promoted **for display only**:

1. Fetch top 7 from `listTopCategoriesByUsage({ sinceDays: 90, limit: 7 })`.
2. Resolve `lastUsedCategoryId` (or, on the edit screen, the expense's existing category) → pre-select.
3. Compute display order:
   - If `selectedId` is in the fetched top-7 → leave order as-is.
   - If `selectedId` is **not** in the top-7 → prepend the selected category to position 0 and drop position 6 (the last).

This is visual only; the underlying ranking is not persisted or reshuffled. Re-renders during the same session do not change the grid order unless the selection itself changes.

## 5. Grid component

New `src/components/CategoryQuickGrid.tsx`, presentational only:

```ts
props: {
  categories: Category[];     // already ordered + display-promoted (max 7)
  selectedId: number | null;
  onSelect: (c: Category) => void;
  onMore: () => void;
}
```

Layout:
- 4 columns × 2 rows, 8 cells total. Position 8 is the "More" tile.
- Each category tile: `CategoryIcon` on top, name below (`numberOfLines={1}`, fontSize 11–12).
- "More" tile: a neutral icon (e.g. `more-horiz` from the existing icon set), label "More".
- Selected tile: tinted background and 1.5px border in `theme.colors.primary`. Unselected tiles use `theme.colors.surface`.
- Tap a category tile → `onSelect(category)`. Tap More → `onMore()`.

The grid replaces the existing single-row category pressable. No other layout changes to the form.

## 6. Sheet changes

`src/components/CategoryPickerSheet.tsx`:

- Keep the existing "all categories" grid.
- Add a "Manage categories" text-button at the top of the sheet (above the grid), styled as a muted link. Tapping it: call `onClose()`, then `router.push('/category')`.
- No new prop is added; the navigation target is hardcoded to `/category` (the route already used elsewhere).

## 7. Edit-screen specifics

On `app/expense/[id].tsx`, the pre-selected category comes from the loaded expense rather than `lastUsedCategoryId`. Display promotion (§4) still applies: if the expense's category isn't in the top-7, it's promoted to position 0 of the grid so the user sees what's currently set.

## 8. Files touched

- `src/repositories/categories.ts` — add `listTopCategoriesByUsage`.
- `src/components/CategoryQuickGrid.tsx` — new file.
- `src/components/CategoryPickerSheet.tsx` — add "Manage categories" link.
- `app/expense/new.tsx` — replace category row with `CategoryQuickGrid`; load top categories; wire promotion and "More".
- `app/expense/[id].tsx` — same change as new.tsx.

No schema changes. No new dependencies.

## 9. Out of scope

- Changes to amount input, date field, note input, save/delete buttons.
- Persisting a manually reordered category list.
- Surfacing category management anywhere other than the existing `/category` route and the new sheet link.
- Quick-creating a category from inside the picker (the sheet's Manage link is the path to creation).

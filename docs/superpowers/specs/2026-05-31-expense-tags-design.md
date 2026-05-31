# Expense Tags — Design

Date: 2026-05-31
Status: Approved

## Summary

Add reusable **tags** to the expense tracker. A tag is a small, persisted, reusable
label (e.g. "fuel"). Each expense has **at most one** tag. Tags are independent of
categories — a tag does not belong to a category; it is a smaller, cross-cutting
filtering dimension. On the homepage, a category's spending can be expanded to show a
per-tag breakdown for the current date range.

## 1. Data model

New `tags` table + nullable `tagId` FK on `expenses` (one tag per expense).

```ts
export const tags = sqliteTable('tags', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),               // stored as entered, trimmed
  stableId: text('stable_id').notNull(),      // for export, like categories
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

// expenses gains:
//   tagId: integer('tag_id').references(() => tags.id)   // nullable
```

- **Name uniqueness is case-insensitive** (`fuel` == `Fuel`). Creating a name that
  already exists (case-insensitively, after trim) reuses the existing tag rather than
  inserting a duplicate.
- `tagId` is nullable. No delete UI in this iteration, so `ON DELETE` behavior is not
  exercised yet.
- A new Drizzle migration adds the `tags` table and the `tag_id` column on `expenses`.
- `stableId` generated like category user stable IDs (see `lib/export/stable-id.ts`).

### Rejected alternatives
- **Many-to-many join table** (`expense_tags`): supports multiple tags per expense, but
  the requirement is exactly one — YAGNI.
- **Free-text tag column + `SELECT DISTINCT`**: no stable identity, no clean rename path,
  awkward in the export stableId model.

## 2. Repositories

New `src/repositories/tags.ts`:
- `listTags()` — all tags.
- `listTopTagsByUsage({ sinceDays, limit })` — usage-ranked, mirroring
  `listTopCategoriesByUsage` (count desc, recent occurredAt desc, name asc).
- `getOrCreateTag(name)` — trims, case-insensitive lookup, inserts with a generated
  stableId if missing; returns the tag.

Extend `src/repositories/expenses.ts`:
- `ExpenseWithCategory` (and `listExpenses` select) gains `tagId` and `tagName`
  (left join on tags).
- `createExpense` / `updateExpense` accept `tagId` (nullable).
- New `sumByCategoryAndTagInBase(start, end)` — returns rows of
  `{ categoryId, tagId, tagName, total }` in base-cents, grouped by category + tag,
  for the per-category breakdown.

## 3. Expense create/edit UI

New `src/components/TagPicker.tsx`, rendered **directly below the Note field** in both
`app/expense/new.tsx` and `app/expense/[id].tsx`.

- Horizontal row of pills for existing tags, ordered **selected-first, then by recent
  usage**, plus a trailing **`+ Add tag`** pill.
- Single-select: tapping a pill selects it; tapping the selected pill again deselects
  (clears the tag).
- Selected pill uses the app **primary/accent** highlight; unselected pills are neutral.
  No per-tag colors.
- `+ Add tag` reveals a small inline text input; submitting calls `getOrCreateTag`,
  selects the result, and makes it available everywhere immediately.
- On save, the screen writes `tagId` (or null) alongside existing fields.

## 4. Homepage category → tag breakdown

In `src/components/charts/CategoryPieChart.tsx` legend rows:

- A category row is **expandable only if** it has ≥1 tagged expense in the current range.
  Otherwise it renders as a plain row (no caret).
- Expanding shows indented sub-rows — one per tag used in that category/range — **plus a
  `No tag` row** for the untagged remainder, each with its amount in display currency:

  ```
  Travel            120.00   40%
   └ fuel            80.00
   └ No tag          40.00
  ```

- The home screen computes the breakdown via `sumByCategoryAndTagInBase`, converts
  base-cents → display currency like existing slices, and passes it into the chart.
- Expansion state is local UI state in the chart component.

**Out of scope:** a global "filter the whole homepage by tag" control. The per-category
expandable breakdown already provides the per-tag view.

## 5. Export / import

The app is in active dev, so we extend the existing v1 format in place (no v2 ceremony;
data will be rebuilt).

- `format-v1.ts`: add a top-level `tags` array (`stableId`, `name`, `createdAt`) and a
  nullable `tagStableId` field on each exported expense.
- Export (`build-export.ts`): emit tags and each expense's `tagStableId`.
- Import (`import-apply.ts` / parse / preview): resolve `tagStableId` → local tag
  (create if missing by stableId), tolerating files that omit tags entirely.
- Expense `contentHash` will incorporate the tag; acceptable given the dev rebuild.

## Testing

- Unit: `getOrCreateTag` case-insensitive reuse + trim; usage ranking; breakdown
  aggregation (tagged + untagged remainder sums to category total).
- Export/import round-trip preserves tag associations; import of a tag-less file works.

# Stats Tab Redesign — Trends & Movers

**Status:** draft
**Date:** 2026-05-24

## Problem

After PR #3 moved period-scoped totals, category pie, and the transaction list onto the Home tab, the Stats tab is left with only:

- A `day | month | year` chip switcher
- Total + average summary cards
- A "last 7 days / 12 months / 5 years" bar chart

This duplicates information now better presented on Home (the totals and category breakdown) and offers no answer to the question users actually open a stats screen for: **how is my spending changing, and where?**

## Goal

Rebuild Stats around period-over-period comparison and category-level movement. Every section on the screen must answer a question Home cannot.

Stats should tell a story about *change*: total this period vs last, which categories are growing or shrinking, what the recent multi-month trajectory looks like, and which individual expenses stand out.

## Non-goals

- Budgets, income tracking, goal setting (no data model for these yet)
- Calendar heatmap, day-of-week breakdown (v2 candidates)
- Insight-card feed with surprise thresholding (v2 candidate)
- Drill-down from a category row into its expense list (v2)
- Recurring-transaction or merchant detection (no data for this)

## Design

### Layout

Single scrolling column, top to bottom:

1. **Period scope picker** — reuse the shared `PeriodScope` component from Home, constrained to `{week, month, year}`. The `day` scope is intentionally dropped: daily period-over-period comparisons are noisy with sparse data, and Home already provides the daily detail view.

2. **Delta header card** — the hero of the screen.
   - Large total for the selected period (in display currency).
   - Signed delta vs the equivalent previous period: e.g. "May 2026" compared against "April 2026", "this week" against "last week", "2026" against "2025".
   - Sign convention: spending up is rendered in the negative/warning color (red), spending down in the positive color (green). The colors reflect "this is more money out", not "this number went up".
   - When the previous period has zero data, delta renders as `—` with a hint ("No data to compare").

3. **Category movers** — two separate lists of up to three rows each: the categories that grew the most, and the categories that shrank the most. Within each list, rows are ordered by the magnitude of the delta amount (not delta percentage — a tiny category doubling shouldn't outrank a large category moving 20%). A category with zero change appears in neither list.
   - Each row: category color/icon, name, inline sparkline (6 buckets at the picker's granularity — last 6 weeks / last 6 months / last 6 years), delta %, and current-vs-previous amounts.
   - A category that existed this period but had zero spend in the previous period is labeled "new" rather than "+∞%".
   - The entire section is hidden when the previous period has zero data (nothing to compare against).
   - Header includes a one-sentence summary derived from the top mover: e.g. "Groceries up 38% this month" — generates a textual insight for free, no separate insight-card system needed.

4. **6-month total trend** — bar chart of total spending across the last 6 calendar months, fixed window. This section ignores the scope picker on purpose: the trend's value comes from the cross-month view. When the picker's scope is `month` and the anchor falls inside the chart's window, that bar is visually emphasized; for `week` and `year` scopes no bar is emphasized. Reuses the existing `PeriodBarChart` (the unstacked, single-series chart already in the codebase) — no per-category stacking, because the movers section above already answers "which category is creeping up" via the sparklines.

5. **Top 5 largest expenses for the selected period** — sorted by amount descending. Each row: category dot + name + amount + date. Tap opens the existing expense detail route. Hidden when the period has fewer than 1 expense.

### Components

**New**

- `DeltaHeader` — total + signed delta + color. Pure presentational, takes both numbers as props.
- `CategoryMoversList` — receives an array of `{category, currentBase, previousBase, history: number[]}` and renders the sorted top-3-up / top-3-down rows. Owns the "no comparison data" hidden state.
- `CategoryMoverRow` — one row in the movers list. Composes `Sparkline`.
- `Sparkline` — tiny stateless component that renders a sequence of values as a compact line or mini-bar. ~30 lines. Used inside mover rows; not exported for general reuse yet.
- `TopExpensesList` — slim list view over expenses sorted by amount. May reuse or wrap `ExpenseRow`; if the existing row is too tall for a list of 5, introduce a slimmer variant in the same component file.

**Reused**

- `PeriodScope` (from Home) — with a prop to restrict the available scopes to a whitelist.
- `PeriodBarChart` — for the 6-month total trend.
- `EmptyState` — for the no-data path.

**Removed from current Stats**

- The inline `day | month | year` Pressable row.
- The Total / Avg-per-period two-card row (Total moves into the Delta header; Avg-per-period is not load-bearing in the new framing).

### Data flow

All aggregation continues to happen in **base cents** (the project's existing pattern) and conversion to display currency happens once at the render boundary, the same way Home does it.

Queries needed per render:

1. Current period: `listExpenses({start, end})` + `sumExpensesInBase(start, end)` + `sumByCategoryInBase(start, end)` — same calls Home already makes.
2. Previous period: the same three calls with the previous window. Range is computed by `scopeRange(scope, prevAnchor, weekStart)` where `prevAnchor` is `stepAnchor(scope, anchor, -1)`. No new date helpers needed.
3. Six-month trend: six `sumExpensesInBase` calls bucketed by month over the last 6 calendar months. Initial implementation may run these as six awaited queries; if measurable jank appears, collapse to a single grouped query in the expenses repo.
4. Per-category 6-bucket history for sparklines: six `sumByCategoryInBase` calls over the last six buckets at the current scope's granularity. Same simplicity-first approach; can be collapsed to a single query later if needed.

No schema changes. No new tables. No new repos (queries live in `src/repositories/expenses.ts` alongside existing aggregates if any new helpers prove worth extracting).

### Edge cases

- **No data for the selected period** → render the existing `EmptyState` and suppress the movers, trend, and top-5 sections.
- **No previous-period data** → delta renders `—`, movers section hidden, hint surfaces in the delta card ("No comparison data yet").
- **Less than 2 months of total history** → 6-month trend renders only the months we have, labeled honestly.
- **Category with current > 0 and previous = 0** → label "new" in the mover row, sort by current amount.
- **Category with current = 0 and previous > 0** → label "stopped" (or "0") in the mover row, eligible for the top-3-down list.
- **Scope = year** → "previous year" comparison is what users expect; sparkline shows last 6 years (sparse, but honest).

### Visual treatment

- Cards share the existing `theme.colors.surface` / `theme.radius.md` styling. No new theme tokens introduced unless a delta-red / delta-green color is missing — check `src/theme.ts` first and add only if needed.
- Delta arrows: simple `MaterialCommunityIcons` (`arrow-up` / `arrow-down`), matching the icon set already used elsewhere in the app.
- Sparklines: 60px wide × 20px tall, no axes, no labels — just shape.

## Testing

- Manual: scope switches between week/month/year update all four data-driven sections.
- Manual: navigating the anchor backwards (e.g. "April") recomputes delta against March, movers vs March, top-5 from April.
- Manual: a fresh DB (no expenses) shows the empty state and no broken sections.
- Manual: a DB with one period of data shows the period total but no comparison surfaces.

No automated test scaffolding is added as part of this redesign — the project has no test suite today, and introducing one is out of scope for this work.

## Open questions

None at design-approval time. Any sparkline rendering choice (SVG vs simple flex `View`s) is an implementation decision to settle in the plan phase.

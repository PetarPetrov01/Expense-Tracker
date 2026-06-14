# Roadmap

Agreed direction for the stats/expense work, split into independent features. Each "Next up" item is a **decision to build** (not a maybe) and gets its own spec → plan → implementation cycle, in the order listed. Budgets and the parked ideas are deferred until the Next-up list is cleared (or priorities change).

To continue in a fresh session: build the top unchecked item under **Next up**, following the same brainstorm → spec → plan → subagent-driven flow used for the pace comparison (see `docs/superpowers/specs/` and `docs/superpowers/plans/`).

## Done

- **Range-to-date pace comparison** (stats) — cumulative pace chart vs. the previous period, scope-aware, with scope-adaptive x-axis labels. Merged to `main` (PR #8). Spec: `docs/superpowers/specs/2026-06-14-pace-comparison-design.md`, plan: `docs/superpowers/plans/2026-06-14-pace-comparison.md`.
- **Add-expense UX** — amount field autofocuses on open; keyboard dismisses on drag and Save works without closing it. Merged to `main`.

## Next up (decided — build in this order)

1. **Expense list + category drill-down**
   - A full, filterable expense-list screen.
   - Tapping a category row in the stats `CategoryMoversList` opens a filtered view of that category's expenses for the active period.
   - One list component, two entry points (full list + filtered-by-category). These two were intentionally combined because the drill-down is just a filtered instance of the same list.

2. **Spending heatmap / calendar**
   - Calendar-style view of which days you spend most, for the active period.

3. **"Add another" + duplicate**
   - "Add another": after saving a new expense, reset the form and stay instead of navigating back.
   - "Duplicate": from the edit-expense screen, open a new-expense form pre-filled from the existing expense.
   - Small, self-contained — good quick win; can be slotted in anytime.

## Deferred

### Budgets
- Set an overall monthly budget and/or per-category monthly targets.
- Show progress and remaining for the active period.
- Pairs naturally with the range-to-date pace comparison: render the budget as a target line, so pace is measured against a goal, not just against the previous period.
- Optional later: warn when approaching/exceeding a budget.

## Parked ideas (not yet decided)

- Recurring / subscription expense detection and quick-add.
- Daily reminder notification to log expenses.
- Home-screen widget.

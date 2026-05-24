# Stats tab — chart UI bugs

**Reported:** 2026-05-24, during on-device verification of `feat/currency-and-amount-input`.
**Status:** Open. Cosmetic-only — data is correct, math is correct, layout is bad.
**Reproducer:** Stats tab on a phone in dark mode with a single category having spend (e.g. just one Groceries entry of лв31.55).

## Bugs

### 1. Bar chart: column missing on the "Daily" view

When only one day has data in the 7-day window, the bar is not visually rendered — only the value label `лв31.55` floats by itself at the y≈31 gridline with no filled bar beneath it.

**Evidence:** `probe-screenshot.png` (Daily, 31.55 BGN this week) — empty horizontal gridlines, no green bar at any of Mon–Sun, but the label is there.

**Suspect:** `src/components/charts/PeriodBarChart.tsx`. Two possibilities:
- `barWidth = Math.max(8, 220 / bars.length)` with `bars.length === 7` → 31px wide bars. Should be visible. But the visible-chart-area may be narrower than 220px, making rendered bars 0px.
- `react-native-gifted-charts` may be hiding bars whose `value` is far below `maxValue`. We compute `maxValue = Math.ceil(maxC / 100 / 10) * 10 || 10` — for a 31.55 value that's `Math.ceil(0.3155) * 10 = 10`. So maxValue=10 with a bar of 31.55? That's BACKWARDS — the bar would exceed maxValue. Likely the chart clips it and shows label but no fill.

The `maxValue` formula is wrong for display-currency values. It was correct when bars were in display-cents BEFORE Task 17, but Task 17 changed bars to receive *display-currency cents pre-converted* (line in `stats.tsx`: `valueCents: toDisplay(b.valueCents)`). The chart then divides by 100 internally (`value: b.valueCents / 100`), so a 3155-cent bar becomes a 31.55-unit bar — but `maxValue` computation runs on the same `valueCents`, gets `Math.ceil(3155 / 100 / 10) * 10 = Math.ceil(3.155) * 10 = 40` ✓. So maxValue is fine.

Re-examining the screenshot: the gridlines top out at 40, the label floats at ~31. So the y-axis is fine. The bar itself just isn't drawing. May be a gifted-charts quirk where bars below a minimum visible width are skipped silently. Try setting an explicit `barWidth` of e.g. 24 unconditionally and removing the dynamic formula.

### 2. Bar-top labels overflow on top of the columns

When bars DO render (Monthly/Yearly with multiple values), the per-bar value labels (`лв31.5`, etc.) are positioned above each bar but **overflow the column visually and look misaligned** — they bleed past the right edge of the bar and into the neighboring bar's space. With Bulgarian-locale text (`лв` prefix + number) the labels are unusually wide.

**Suspect:** `topLabelComponent` in `PeriodBarChart.tsx`:
```ts
topLabelComponent: () => b.valueCents > 0
  ? <Text style={{ color: theme.colors.text, fontSize: 10 }}>{formatAmount(b.valueCents, currency)}</Text>
  : null,
```
The `<Text>` is unconstrained — gifted-charts positions it centered above the bar but doesn't clip. With 4-char `лв31` it's already wider than a 24px bar.

**Fix sketch:**
- Constrain `<Text>` to `width: barWidth + spacing` with `textAlign: 'center'` and `numberOfLines={1}` and either `adjustsFontSizeToFit` or a smaller font.
- Or: drop the per-bar labels entirely; rely on the tooltip-on-tap behavior of gifted-charts.
- Or: render labels rotated 90° for narrow bars (Yearly = 5 bars wide, Monthly = 12 bars wider, Daily = 7 bars).

Decide one consistent presentation — current behavior is "labels visible always but overflowing".

### 3. Pie chart: center label is white-on-white

In `CategoryPieChart.tsx` the center of the donut renders:
```tsx
<Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>Total</Text>
<Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '600' }}>{formatAmount(total, currency)}</Text>
```

`theme.colors.text` is the light/near-white color used for primary text on the dark app surface. But the donut's center hole is **white** (the default gifted-charts inner fill — `innerRadius={55}` with no `centerLabelComponent` background override). Result: white "Total" text on white circle. Same for the value `лв31.55` underneath.

**Evidence:** `probe-screenshot.png` (the screenshot shown to Claude) — the center reads "Total" faintly and the value is invisible.

**Fix sketch:** the pie chart in gifted-charts has props to override the inner fill, e.g. `innerCircleColor={theme.colors.surface}`. Setting that to the card's dark surface color fixes contrast immediately. Alternatively wrap `centerLabelComponent` in a `<View style={{ backgroundColor: theme.colors.surface, borderRadius: 99, padding: 12 }}>` to overlay.

### 4. (Bonus, since we're here) The whole Stats tab needs visual polish

Overall this screen is functional but charts feel unowned. Specific gaps worth a single follow-up pass:
- Bar chart's y-axis text is `theme.colors.textMuted` but barely visible on the surface; bump contrast.
- Gridline color isn't theme-tokenized — it's whatever gifted-charts ships.
- "Last 7 days" / "Last 12 months" / "Last 5 years" header style is plain; could match the section headers elsewhere in the app (consistent padding, weight).
- Empty state at the chart level shows "No data in this range." in body-style text inside the chart card — fine, but no icon and looks out of place compared to `EmptyState` used on Home.

## Files involved

- `src/components/charts/PeriodBarChart.tsx` — bugs 1, 2
- `src/components/charts/CategoryPieChart.tsx` — bug 3
- `app/(tabs)/stats.tsx` — bug 4 (orchestrates layout, owns spacing)
- Possibly `src/theme.ts` if new tokens are introduced

## Suggested next-session approach

1. Start by fixing #3 (one-line `innerCircleColor` prop) — quickest win, biggest visible improvement.
2. Then #1: explicit `barWidth`, remove the dynamic-from-bars-length formula. Test with 1/7/12 bars.
3. Then #2: pick a labeling strategy and apply it consistently (recommend: drop bar-top labels on Daily where bars are narrow, keep for Yearly with the 5-bar layout, or use a smaller font + numberOfLines).
4. #4 is broad polish — out of scope for a quick PR; consider a separate "stats polish" branch.

A device with multiple categories AND multiple days of spend would make the bugs more obvious — current data has only one category with one day of activity, so most charts degenerate.

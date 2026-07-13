import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  sumExpensesInBase,
  sumByCategoryInBase,
  listExpenses,
  type ExpenseWithCategory,
} from '../../src/repositories/expenses';
import { PeriodScope } from '../../src/components/PeriodScope';
import { PaceChart } from '../../src/components/charts/PaceChart';
import { CategoryMoversList, type Mover } from '../../src/components/CategoryMoversList';
import { PeriodBarChart, type Bar } from '../../src/components/charts/PeriodBarChart';
import { buildCumulativeSeries, comparePace, paceTodayIndex, paceAxisTicks, buildStepSeries, stepTodayIndex, stepAxisTicks, stepGranularity, pointLabels, type CumulativePoint } from '../../src/lib/pace';
import { TopExpensesList } from '../../src/components/TopExpensesList';
import { EmptyState } from '../../src/components/EmptyState';
import { scopeRange, stepAnchor, lastNBuckets, isAtCurrent, type Scope } from '../../src/lib/dates';
import { useSettings } from '../../src/stores/settings';
import { useFxRates } from '../../src/stores/fxRates';
import { rateLookup, RATE_SCALE, amountInBaseCents } from '../../src/lib/fx';
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
  const [movers, setMovers] = useState<Mover[]>([]);
  const [trendBars, setTrendBars] = useState<Bar[]>([]);
  const [topExpenses, setTopExpenses] = useState<ExpenseWithCategory[]>([]);
  const [currSeries, setCurrSeries] = useState<CumulativePoint[]>([]);
  const [prevSeries, setPrevSeries] = useState<CumulativePoint[]>([]);
  const [currStepBase, setCurrStepBase] = useState<number[]>([]);
  const [prevStepBase, setPrevStepBase] = useState<number[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [todayIndex, setTodayIndex] = useState(0);
  const [isInProgress, setIsInProgress] = useState(true);
  const [chartScrubbing, setChartScrubbing] = useState(false);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    (async () => {
      const curr = scopeRange(scope, anchor, weekStart);
      const prevAnchor = stepAnchor(scope, anchor, -1);
      const prev = scopeRange(scope, prevAnchor, weekStart);

      const [currTotal, prevTotal, currCats, prevCats, periodExpenses, prevExpenses] = await Promise.all([
        sumExpensesInBase(curr.start, curr.end),
        sumExpensesInBase(prev.start, prev.end),
        sumByCategoryInBase(curr.start, curr.end),
        sumByCategoryInBase(prev.start, prev.end),
        listExpenses({ start: curr.start, end: curr.end }),
        listExpenses({ start: prev.start, end: prev.end }),
      ]);

      const buckets = lastNBuckets(scope, 6, anchor, weekStart);
      const monthBuckets = lastNBuckets('month', 6, new Date(), weekStart);

      const [bucketCats, monthTotals] = await Promise.all([
        Promise.all(buckets.map(b => sumByCategoryInBase(b.start, b.end))),
        Promise.all(monthBuckets.map(b => sumExpensesInBase(b.start, b.end))),
      ]);

      const ids = new Set<number>();
      for (const r of currCats) ids.add(r.categoryId);
      for (const r of prevCats) ids.add(r.categoryId);

      const currMetaMap = new Map(currCats.map(r => [r.categoryId, r]));
      const prevMetaMap = new Map(prevCats.map(r => [r.categoryId, r]));

      const assembled: Mover[] = [];
      for (const id of ids) {
        const meta = currMetaMap.get(id) ?? prevMetaMap.get(id)!;
        const currentCents = Number(currMetaMap.get(id)?.total ?? 0);
        const previousCents = Number(prevMetaMap.get(id)?.total ?? 0);
        const historyCents = bucketCats.map(rows => {
          const hit = rows.find(r => r.categoryId === id);
          return hit ? Number(hit.total) : 0;
        });
        assembled.push({
          categoryId: id,
          categoryName: meta.categoryName,
          categoryIcon: meta.categoryIcon,
          categoryColor: meta.categoryColor,
          currentCents,
          previousCents,
          historyCents,
        });
      }

      const bars: Bar[] = monthBuckets.map((b, i) => ({
        label: b.label,
        valueCents: monthTotals[i],
      }));

      const topFive = [...periodExpenses]
        .sort((a, b) => amountInBaseCents(b) - amountInBaseCents(a))
        .slice(0, 5);

      const currentSeries = buildCumulativeSeries(periodExpenses, curr.start, curr.end);
      const previousSeries = buildCumulativeSeries(prevExpenses, prev.start, prev.end);
      const gran = stepGranularity(scope);
      const currentStep = buildStepSeries(periodExpenses, curr.start, curr.end, gran);
      const previousStep = buildStepSeries(prevExpenses, prev.start, prev.end, gran);
      const now = new Date();
      const current = isAtCurrent(scope, anchor, weekStart, now);
      const tIndex = paceTodayIndex(curr.start, curr.end, current, now);
      const sIndex = stepTodayIndex(scope, curr.start, curr.end, current, now);

      if (cancelled) return;
      setCurrentBase(currTotal);
      setPreviousBase(prevTotal);
      setMovers(assembled);
      setTrendBars(bars);
      setTopExpenses(topFive);
      setCurrSeries(currentSeries);
      setPrevSeries(previousSeries);
      setCurrStepBase(currentStep);
      setPrevStepBase(previousStep);
      setStepIndex(sIndex);
      setTodayIndex(tIndex);
      setIsInProgress(current);
    })();
    return () => { cancelled = true; };
    // rates/displayCurrency intentionally excluded: currency conversion is done at render time, not in this effect.
  }, [scope, anchor.getTime(), weekStart]));

  const eurToDisplay = rateLookup(rates, displayCurrency);
  const toDisplay = (baseCents: number) => Math.round((baseCents * eurToDisplay) / RATE_SCALE);
  const displayTrendBars: Bar[] = trendBars.map(b => ({
    label: b.label,
    valueCents: toDisplay(b.valueCents),
  }));
  const currentDisplay = currSeries.map(p => toDisplay(p.cumulativeBaseCents));
  const previousDisplay = prevSeries.map(p => toDisplay(p.cumulativeBaseCents));
  const stepCurrentDisplay = currStepBase.map(toDisplay);
  const stepPreviousDisplay = prevStepBase.map(toDisplay);
  const cmp = comparePace(currSeries, prevSeries, todayIndex);
  const currentTotalDisplay = toDisplay(cmp.currentAtPoint);
  const deltaDisplay = cmp.prevAtPoint === null ? null : currentTotalDisplay - toDisplay(cmp.prevAtPoint);
  const periodStart = scopeRange(scope, anchor, weekStart).start;
  const axisTicks = paceAxisTicks(scope, periodStart, currSeries.length);
  const stepXLabels = stepAxisTicks(scope, periodStart, currStepBase.length);
  const stepLabel = stepGranularity(scope) === 'month' ? 'Per month' : 'Per day';
  const cumPointLabels = pointLabels(periodStart, currSeries.length, 'day');
  const stepPointLabels = pointLabels(periodStart, currStepBase.length, stepGranularity(scope));

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}
      scrollEnabled={!chartScrubbing}
    >
      <PeriodScope
        scope={scope}
        anchor={anchor}
        onScopeChange={setScope}
        onAnchorChange={setAnchor}
        scopes={STATS_SCOPES}
      />
      {/* currentBase/previousBase exist solely for this empty-state gate; they equal the
          tails of currSeries/prevSeries (same amountInBaseCents over the same rows). */}
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
          <PaceChart
            scope={scope}
            currentDisplay={currentDisplay}
            previousDisplay={previousDisplay}
            todayIndex={todayIndex}
            isInProgress={isInProgress}
            currentTotalDisplay={currentTotalDisplay}
            deltaDisplay={deltaDisplay}
            displayCurrency={displayCurrency}
            xLabels={axisTicks}
            pointLabels={cumPointLabels}
            stepCurrentDisplay={stepCurrentDisplay}
            stepPreviousDisplay={stepPreviousDisplay}
            stepTodayIndex={stepIndex}
            stepXLabels={stepXLabels}
            stepPointLabels={stepPointLabels}
            stepLabel={stepLabel}
            onActiveChange={setChartScrubbing}
          />
          <CategoryMoversList
            movers={movers}
            displayCurrency={displayCurrency}
            hasPrevious={previousBase > 0}
            toDisplay={toDisplay}
            scope={scope}
            anchor={anchor}
          />
          <PeriodBarChart bars={displayTrendBars} title="Last 6 months" />
          <TopExpensesList
            expenses={topExpenses}
            toDisplay={toDisplay}
            displayCurrency={displayCurrency}
          />
        </>
      )}
    </ScrollView>
  );
}

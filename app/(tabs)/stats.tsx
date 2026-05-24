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
import { DeltaHeader } from '../../src/components/DeltaHeader';
import { CategoryMoversList, type Mover } from '../../src/components/CategoryMoversList';
import { PeriodBarChart, type Bar } from '../../src/components/charts/PeriodBarChart';
import { TopExpensesList } from '../../src/components/TopExpensesList';
import { EmptyState } from '../../src/components/EmptyState';
import { scopeRange, stepAnchor, lastNBuckets, type Scope } from '../../src/lib/dates';
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

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    (async () => {
      const curr = scopeRange(scope, anchor, weekStart);
      const prevAnchor = stepAnchor(scope, anchor, -1);
      const prev = scopeRange(scope, prevAnchor, weekStart);

      const [currTotal, prevTotal, currCats, prevCats, periodExpenses] = await Promise.all([
        sumExpensesInBase(curr.start, curr.end),
        sumExpensesInBase(prev.start, prev.end),
        sumByCategoryInBase(curr.start, curr.end),
        sumByCategoryInBase(prev.start, prev.end),
        listExpenses({ start: curr.start, end: curr.end }),
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

      if (cancelled) return;
      setCurrentBase(currTotal);
      setPreviousBase(prevTotal);
      setMovers(assembled);
      setTrendBars(bars);
      setTopExpenses(topFive);
    })();
    return () => { cancelled = true; };
  }, [scope, anchor.getTime(), weekStart]));

  const eurToDisplay = rateLookup(rates, displayCurrency);
  const toDisplay = (baseCents: number) => Math.round((baseCents * eurToDisplay) / RATE_SCALE);
  const currentDisplay = toDisplay(currentBase);
  const previousDisplay = toDisplay(previousBase);
  const displayTrendBars: Bar[] = trendBars.map(b => ({
    label: b.label,
    valueCents: toDisplay(b.valueCents),
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
            hasPrevious={previousBase > 0}
          />
          <CategoryMoversList
            movers={movers}
            displayCurrency={displayCurrency}
            hasPrevious={previousBase > 0}
            toDisplay={toDisplay}
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

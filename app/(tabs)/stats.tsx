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

  useFocusEffect(useCallback(() => {
    let cancelled = false;
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

      const buckets = lastNBuckets(scope, 6, anchor, weekStart);
      const bucketCats = await Promise.all(
        buckets.map(b => sumByCategoryInBase(b.start, b.end)),
      );

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

      if (cancelled) return;
      setCurrentBase(currTotal);
      setPreviousBase(prevTotal);
      setMovers(assembled);
    })();
    return () => { cancelled = true; };
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
        <>
          <DeltaHeader
            currentDisplay={currentDisplay}
            previousDisplay={previousDisplay}
            displayCurrency={displayCurrency}
            hasPrevious={true}
          />
          <CategoryMoversList
            movers={movers}
            displayCurrency={displayCurrency}
            hasPrevious={previousBase > 0}
            toDisplay={toDisplay}
          />
        </>
      )}
    </ScrollView>
  );
}

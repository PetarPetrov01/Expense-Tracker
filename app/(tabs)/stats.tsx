import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { sumExpensesInBase } from '../../src/repositories/expenses';
import { PeriodScope } from '../../src/components/PeriodScope';
import { DeltaHeader } from '../../src/components/DeltaHeader';
import { EmptyState } from '../../src/components/EmptyState';
import { scopeRange, stepAnchor, type Scope } from '../../src/lib/dates';
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
  const [hasPrevious, setHasPrevious] = useState(false);

  useFocusEffect(useCallback(() => {
    (async () => {
      const curr = scopeRange(scope, anchor, weekStart);
      const prevAnchor = stepAnchor(scope, anchor, -1);
      const prev = scopeRange(scope, prevAnchor, weekStart);

      const [currTotal, prevTotal] = await Promise.all([
        sumExpensesInBase(curr.start, curr.end),
        sumExpensesInBase(prev.start, prev.end),
      ]);

      setCurrentBase(currTotal);
      setPreviousBase(prevTotal);
      setHasPrevious(prevTotal > 0);
    })();
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
        <DeltaHeader
          currentDisplay={currentDisplay}
          previousDisplay={previousDisplay}
          displayCurrency={displayCurrency}
          hasPrevious={hasPrevious}
        />
      )}
    </ScrollView>
  );
}

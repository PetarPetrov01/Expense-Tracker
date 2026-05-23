import { useCallback, useState } from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { listExpenses, sumByCategoryInBase } from '../../src/repositories/expenses';
import { PeriodBarChart, type Bar } from '../../src/components/charts/PeriodBarChart';
import { CategoryPieChart, type Slice } from '../../src/components/charts/CategoryPieChart';
import { bucketsFor, bucketKeyFor, rangeFor, type Period } from '../../src/lib/dates';
import { formatAmount } from '../../src/lib/currency';
import { useSettings } from '../../src/stores/settings';
import { useFxRates } from '../../src/stores/fxRates';
import { amountInBaseCents, rateLookup, RATE_SCALE } from '../../src/lib/fx';
import { theme } from '../../src/theme';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'day', label: 'Daily' }, { key: 'month', label: 'Monthly' }, { key: 'year', label: 'Yearly' },
];

export default function Stats() {
  const displayCurrency = useSettings(s => s.displayCurrency);
  const rates = useFxRates(s => s.rates);
  const [period, setPeriod] = useState<Period>('month');
  const [bars, setBars] = useState<Bar[]>([]);
  const [slices, setSlices] = useState<Slice[]>([]);
  const [totalBase, setTotalBase] = useState(0);

  useFocusEffect(useCallback(() => {
    (async () => {
      const { start, end } = rangeFor(period);
      const buckets = bucketsFor(period);
      const expensesRows = await listExpenses({ start, end });
      const baseTotals = new Map<string, number>();
      let totalBaseLocal = 0;
      for (const e of expensesRows) {
        const baseCents = amountInBaseCents({ amountCents: e.amountCents, rateToBaseX1e6: e.rateToBaseX1e6 });
        const key = bucketKeyFor(period, new Date(e.occurredAt));
        baseTotals.set(key, (baseTotals.get(key) ?? 0) + baseCents);
        totalBaseLocal += baseCents;
      }
      setBars(buckets.map(b => ({ label: b.label, valueCents: baseTotals.get(b.key) ?? 0 })));
      setTotalBase(totalBaseLocal);

      const cats = await sumByCategoryInBase(start, end);
      setSlices(cats.filter(c => c.total > 0).sort((a, b) => b.total - a.total).map(c => ({
        categoryId: c.categoryId, categoryName: c.categoryName, categoryColor: c.categoryColor, total: Number(c.total),
      })));
    })();
  }, [period]));

  const eurToDisplay = rateLookup(rates, displayCurrency);
  const toDisplay = (baseCents: number) => Math.round((baseCents * eurToDisplay) / RATE_SCALE);

  const totalDisplay = toDisplay(totalBase);
  const avgDisplay = bars.length ? totalDisplay / bars.length : 0;
  const displayBars: Bar[] = bars.map(b => ({ label: b.label, valueCents: toDisplay(b.valueCents) }));
  const displaySlices: Slice[] = slices.map(s => ({ ...s, total: toDisplay(s.total) }));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.bg }} contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        {PERIODS.map(p => (
          <Pressable key={p.key} onPress={() => setPeriod(p.key)} style={{
            flex: 1, padding: theme.spacing.sm, borderRadius: theme.radius.pill, alignItems: 'center',
            backgroundColor: period === p.key ? theme.colors.primary : theme.colors.surface,
          }}>
            <Text style={{ color: '#fff' }}>{p.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <View style={{ flex: 1, padding: theme.spacing.md, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md }}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>Total</Text>
          <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '600' }}>{formatAmount(totalDisplay, displayCurrency)}</Text>
        </View>
        <View style={{ flex: 1, padding: theme.spacing.md, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md }}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>Avg / {period}</Text>
          <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '600' }}>{formatAmount(Math.round(avgDisplay), displayCurrency)}</Text>
        </View>
      </View>

      <PeriodBarChart bars={displayBars} title={period === 'day' ? 'Last 7 days' : period === 'month' ? 'Last 12 months' : 'Last 5 years'} />
      <CategoryPieChart slices={displaySlices} />
    </ScrollView>
  );
}

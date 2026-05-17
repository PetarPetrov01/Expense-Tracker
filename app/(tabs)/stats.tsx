import { useCallback, useState } from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { listExpenses, sumByCategory } from '../../src/repositories/expenses';
import { PeriodBarChart, type Bar } from '../../src/components/charts/PeriodBarChart';
import { CategoryPieChart, type Slice } from '../../src/components/charts/CategoryPieChart';
import { bucketsFor, bucketKeyFor, rangeFor, type Period } from '../../src/lib/dates';
import { formatAmount } from '../../src/lib/currency';
import { useSettings } from '../../src/stores/settings';
import { theme } from '../../src/theme';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'day', label: 'Daily' }, { key: 'month', label: 'Monthly' }, { key: 'year', label: 'Yearly' },
];

export default function Stats() {
  const currency = useSettings(s => s.currency);
  const [period, setPeriod] = useState<Period>('month');
  const [bars, setBars] = useState<Bar[]>([]);
  const [slices, setSlices] = useState<Slice[]>([]);
  const [total, setTotal] = useState(0);

  useFocusEffect(useCallback(() => {
    (async () => {
      const { start, end } = rangeFor(period);
      const buckets = bucketsFor(period);
      const expenses = await listExpenses({ start, end });
      const totals = new Map<string, number>();
      for (const e of expenses) {
        const key = bucketKeyFor(period, new Date(e.occurredAt));
        totals.set(key, (totals.get(key) ?? 0) + e.amountCents);
      }
      setBars(buckets.map(b => ({ label: b.label, valueCents: totals.get(b.key) ?? 0 })));
      setTotal(expenses.reduce((s, e) => s + e.amountCents, 0));
      const cats = await sumByCategory(start, end);
      setSlices(cats.filter(c => c.total > 0).sort((a, b) => b.total - a.total).map(c => ({
        categoryId: c.categoryId, categoryName: c.categoryName, categoryColor: c.categoryColor, total: Number(c.total),
      })));
    })();
  }, [period]));

  const avg = bars.length ? total / bars.length : 0;

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
          <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '600' }}>{formatAmount(total, currency)}</Text>
        </View>
        <View style={{ flex: 1, padding: theme.spacing.md, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md }}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>Avg / {period}</Text>
          <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '600' }}>{formatAmount(Math.round(avg), currency)}</Text>
        </View>
      </View>

      <PeriodBarChart bars={bars} title={period === 'day' ? 'Last 7 days' : period === 'month' ? 'Last 12 months' : 'Last 5 years'} />
      <CategoryPieChart slices={slices} />
    </ScrollView>
  );
}

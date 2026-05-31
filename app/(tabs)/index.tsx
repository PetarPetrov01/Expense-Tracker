import { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { startOfDay, endOfDay } from 'date-fns';
import { listExpenses, sumByCategoryInBase, sumByCategoryAndTagInBase, type ExpenseWithCategory } from '../../src/repositories/expenses';
import { ExpenseRow } from '../../src/components/ExpenseRow';
import { EmptyState } from '../../src/components/EmptyState';
import { PeriodScope } from '../../src/components/PeriodScope';
import { CategoryPieChart, type Slice } from '../../src/components/charts/CategoryPieChart';
import { useSettings } from '../../src/stores/settings';
import { useFxRates } from '../../src/stores/fxRates';
import { rateLookup, RATE_SCALE } from '../../src/lib/fx';
import { scopeRange, type Scope } from '../../src/lib/dates';
import { theme } from '../../src/theme';

export default function Home() {
  const displayCurrency = useSettings(s => s.displayCurrency);
  const weekStart = useSettings(s => s.weekStart);
  const rates = useFxRates(s => s.rates);

  const [scope, setScope] = useState<Scope>('month');
  const [anchor, setAnchor] = useState<Date>(new Date());
  const [customRange, setCustomRange] = useState<{ start: Date; end: Date } | null>(null);
  const [items, setItems] = useState<ExpenseWithCategory[]>([]);
  const [slices, setSlices] = useState<Slice[]>([]);

  const customStartMs = customRange?.start.getTime();
  const customEndMs = customRange?.end.getTime();

  const eurToDisplay = rateLookup(rates, displayCurrency);
  const toDisplay = (baseCents: number) => Math.round((baseCents * eurToDisplay) / RATE_SCALE);

  useFocusEffect(useCallback(() => {
    let start: Date;
    let end: Date;
    if (scope === 'custom') {
      if (!customRange) return;
      start = startOfDay(customRange.start);
      end = endOfDay(customRange.end);
    } else {
      ({ start, end } = scopeRange(scope, anchor, weekStart));
    }
    listExpenses({ start, end }).then(setItems);
    Promise.all([
      sumByCategoryInBase(start, end),
      sumByCategoryAndTagInBase(start, end),
    ]).then(([cats, breakdown]) => {
      // Group breakdown rows by category. Only attach tagBreakdown when the category
      // has at least one tagged expense in range. "No tag" remainder goes last.
      const byCat = new Map<number, { tagId: number | null; tagName: string | null; total: number }[]>();
      for (const r of breakdown) {
        const list = byCat.get(r.categoryId) ?? [];
        list.push({ tagId: r.tagId, tagName: r.tagName, total: Number(r.total) });
        byCat.set(r.categoryId, list);
      }
      setSlices(cats
        .filter(c => c.total > 0)
        .sort((a, b) => b.total - a.total)
        .map(c => {
          const rows = byCat.get(c.categoryId) ?? [];
          const hasTagged = rows.some(r => r.tagId !== null);
          const tagBreakdown = hasTagged
            ? [...rows]
                .sort((a, b) => {
                  if ((a.tagId === null) !== (b.tagId === null)) return a.tagId === null ? 1 : -1;
                  return b.total - a.total;
                })
                .map(r => ({ tagId: r.tagId, tagName: r.tagName, total: toDisplay(r.total) }))
            : undefined;
          return {
            categoryId: c.categoryId,
            categoryName: c.categoryName,
            categoryColor: c.categoryColor,
            total: toDisplay(Number(c.total)),
            tagBreakdown,
          };
        })
      );
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, anchor.getTime(), weekStart, customStartMs, customEndMs, rates]));

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <FlatList
        data={items}
        keyExtractor={(e) => String(e.id)}
        renderItem={({ item }) => <ExpenseRow e={item} />}
        contentContainerStyle={{ padding: theme.spacing.lg, gap: 10, paddingBottom: 96 }}
        ListHeaderComponent={
          <View style={{ gap: theme.spacing.lg, marginBottom: theme.spacing.md }}>
            <PeriodScope
              scope={scope}
              anchor={anchor}
              onScopeChange={setScope}
              onAnchorChange={setAnchor}
              customRange={customRange}
              onCustomRangeChange={setCustomRange}
            />
            <CategoryPieChart slices={slices} />
            <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '600', marginTop: theme.spacing.sm }}>
              History
            </Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyState icon="cash-remove" title="No expenses" hint="No records in this period." />
        }
      />

      <Link href="/expense/new" asChild>
        <Pressable style={{
          position: 'absolute', right: 24, bottom: 24,
          width: 60, height: 60, borderRadius: 30,
          backgroundColor: theme.colors.primary,
          justifyContent: 'center', alignItems: 'center',
          elevation: 4,
        }}>
          <MaterialCommunityIcons name="plus" size={32} color="#fff" />
        </Pressable>
      </Link>
    </View>
  );
}

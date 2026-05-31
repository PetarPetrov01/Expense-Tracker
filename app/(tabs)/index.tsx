import { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { startOfDay, endOfDay } from 'date-fns';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { listExpenses, sumByCategoryInBase, type ExpenseWithCategory } from '../../src/repositories/expenses';
import { ExpenseRow } from '../../src/components/ExpenseRow';
import { EmptyState } from '../../src/components/EmptyState';
import { PeriodScope } from '../../src/components/PeriodScope';
import { CategoryPieChart, type Slice } from '../../src/components/charts/CategoryPieChart';
import { useSettings } from '../../src/stores/settings';
import { useFxRates } from '../../src/stores/fxRates';
import { rateLookup, RATE_SCALE } from '../../src/lib/fx';
import { scopeRange, stepAnchor, canGoForward, type Scope } from '../../src/lib/dates';
import { theme } from '../../src/theme';

const SWIPE_DX = 50;
const SWIPE_VX = 350;

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
    sumByCategoryInBase(start, end).then(cats => {
      setSlices(cats
        .filter(c => c.total > 0)
        .sort((a, b) => b.total - a.total)
        .map(c => ({
          categoryId: c.categoryId,
          categoryName: c.categoryName,
          categoryColor: c.categoryColor,
          total: Number(c.total),
        }))
      );
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, anchor.getTime(), weekStart, customStartMs, customEndMs]));

  const eurToDisplay = rateLookup(rates, displayCurrency);
  const toDisplay = (baseCents: number) => Math.round((baseCents * eurToDisplay) / RATE_SCALE);
  const displaySlices: Slice[] = slices.map(s => ({ ...s, total: toDisplay(s.total) }));

  function goPrev() {
    if (scope === 'custom') return;
    setAnchor(stepAnchor(scope, anchor, -1));
  }
  function goNext() {
    if (scope === 'custom') return;
    if (!canGoForward(scope, anchor, weekStart)) return;
    setAnchor(stepAnchor(scope, anchor, 1));
  }

  const swipe = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-15, 15])
    .enabled(scope !== 'custom')
    .onEnd((e) => {
      'worklet';
      if (e.translationX <= -SWIPE_DX || e.velocityX <= -SWIPE_VX) {
        runOnJS(goNext)();
      } else if (e.translationX >= SWIPE_DX || e.velocityX >= SWIPE_VX) {
        runOnJS(goPrev)();
      }
    });

  return (
    <GestureDetector gesture={swipe}>
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <FlatList
        data={items}
        keyExtractor={(e) => String(e.id)}
        renderItem={({ item }) => <ExpenseRow e={item} />}
        contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}
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
            <CategoryPieChart slices={displaySlices} />
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
    </GestureDetector>
  );
}

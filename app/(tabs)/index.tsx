import { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { listExpenses, sumExpenses, type ExpenseWithCategory } from '../../src/repositories/expenses';
import { ExpenseRow } from '../../src/components/ExpenseRow';
import { EmptyState } from '../../src/components/EmptyState';
import { formatAmount } from '../../src/lib/currency';
import { useSettings } from '../../src/stores/settings';
import { startOfMonth, endOfMonth } from 'date-fns';
import { theme } from '../../src/theme';

export default function Home() {
  const currency = useSettings(s => s.displayCurrency);
  const [items, setItems] = useState<ExpenseWithCategory[]>([]);
  const [monthTotal, setMonthTotal] = useState(0);

  useFocusEffect(useCallback(() => {
    const now = new Date();
    listExpenses({ limit: 50 }).then(setItems);
    sumExpenses(startOfMonth(now), endOfMonth(now)).then(setMonthTotal);
  }, []));

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ padding: theme.spacing.lg }}>
        <Text style={{ color: theme.colors.textMuted }}>This month</Text>
        <Text style={{ color: theme.colors.text, fontSize: 32, fontWeight: '700' }}>
          {formatAmount(monthTotal, currency)}
        </Text>
      </View>

      {items.length === 0 ? (
        <EmptyState icon="cash-remove" title="No expenses yet" hint="Tap + to add your first one." />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(e) => String(e.id)}
          renderItem={({ item }) => <ExpenseRow e={item} />}
          contentContainerStyle={{ padding: theme.spacing.lg, paddingTop: 0 }}
        />
      )}

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

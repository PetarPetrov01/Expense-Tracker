import { View, Text, Pressable } from 'react-native';
import { Link } from 'expo-router';
import { format } from 'date-fns';
import { CategoryIcon } from './CategoryIcon';
import { formatAmount, type CurrencyCode } from '../lib/currency';
import { amountInBaseCents } from '../lib/fx';
import { theme } from '../theme';
import type { ExpenseWithCategory } from '../repositories/expenses';

export function TopExpensesList({
  expenses,
  toDisplay,
  displayCurrency,
}: {
  expenses: ExpenseWithCategory[];
  toDisplay: (baseCents: number) => number;
  displayCurrency: CurrencyCode;
}) {
  if (expenses.length === 0) return null;

  return (
    <View style={{
      padding: theme.spacing.md,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
      gap: theme.spacing.sm,
    }}>
      <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '600' }}>
        Largest expenses
      </Text>
      {expenses.map(e => {
        const display = toDisplay(amountInBaseCents(e));
        return (
          <Link key={e.id} href={`/expense/${e.id}`} asChild>
            <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <CategoryIcon icon={e.categoryIcon} color={e.categoryColor} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.text, fontSize: 14 }} numberOfLines={1}>
                  {e.categoryName}{e.note ? ` · ${e.note}` : ''}
                </Text>
                <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>
                  {format(e.occurredAt, 'PP')}
                </Text>
              </View>
              <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '600' }}>
                {formatAmount(display, displayCurrency)}
              </Text>
            </Pressable>
          </Link>
        );
      })}
    </View>
  );
}

import { View, Text, Pressable } from 'react-native';
import { Link } from 'expo-router';
import { format } from 'date-fns';
import { CategoryIcon } from './CategoryIcon';
import { formatAmount } from '../lib/currency';
import { useSettings } from '../stores/settings';
import type { ExpenseWithCategory } from '../repositories/expenses';
import { theme } from '../theme';

export function ExpenseRow({ e }: { e: ExpenseWithCategory }) {
  const currency = useSettings(s => s.currency);
  return (
    <Link href={`/expense/${e.id}`} asChild>
      <Pressable style={{
        flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
        padding: theme.spacing.md, backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.md, marginBottom: theme.spacing.sm,
      }}>
        <CategoryIcon icon={e.categoryIcon} color={e.categoryColor} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.colors.text, fontSize: 16 }}>{e.categoryName}</Text>
          <Text style={{ color: theme.colors.textMuted, fontSize: 12 }} numberOfLines={1}>
            {format(e.occurredAt, 'PP')}{e.note ? ` · ${e.note}` : ''}
          </Text>
        </View>
        <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '600' }}>
          {formatAmount(e.amountCents, currency)}
        </Text>
      </Pressable>
    </Link>
  );
}

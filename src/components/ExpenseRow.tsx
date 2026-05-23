import { View, Text, Pressable } from 'react-native';
import { Link } from 'expo-router';
import { format } from 'date-fns';
import { CategoryIcon } from './CategoryIcon';
import { formatAmount, isCurrencyCode, type CurrencyCode } from '../lib/currency';
import { useSettings } from '../stores/settings';
import { useFxRates } from '../stores/fxRates';
import { amountInDisplayCents } from '../lib/fx';
import type { ExpenseWithCategory } from '../repositories/expenses';
import { theme } from '../theme';

export function ExpenseRow({ e }: { e: ExpenseWithCategory }) {
  const displayCurrency = useSettings(s => s.displayCurrency);
  const rates = useFxRates(s => s.rates);
  const entryCurrency: CurrencyCode = isCurrencyCode(e.currency) ? e.currency : 'EUR';

  const displayCents = amountInDisplayCents(
    { amountCents: e.amountCents, rateToBaseX1e6: e.rateToBaseX1e6 },
    displayCurrency,
    rates,
  );
  const showOriginal = entryCurrency !== displayCurrency;

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
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '600' }}>
            {formatAmount(displayCents, displayCurrency)}
          </Text>
          {showOriginal && (
            <Text style={{ color: theme.colors.textMuted, fontSize: 11, fontStyle: 'italic' }}>
              originally {formatAmount(e.amountCents, entryCurrency)}
            </Text>
          )}
        </View>
      </Pressable>
    </Link>
  );
}

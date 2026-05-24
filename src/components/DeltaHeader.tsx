import { View, Text } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { theme } from '../theme';
import { formatAmount, type CurrencyCode } from '../lib/currency';

export function DeltaHeader({
  currentDisplay,
  previousDisplay,
  displayCurrency,
  hasPrevious,
}: {
  currentDisplay: number;
  previousDisplay: number;
  displayCurrency: CurrencyCode;
  hasPrevious: boolean;
}) {
  const diff = currentDisplay - previousDisplay;
  const pct = previousDisplay === 0 ? null : (diff / previousDisplay) * 100;
  const up = diff > 0;
  // Spending up = red (more money out), spending down = green.
  const deltaColor = up ? theme.colors.danger : theme.colors.primary;

  return (
    <View style={{
      padding: theme.spacing.md,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
      gap: 4,
    }}>
      <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>Total</Text>
      <Text style={{ color: theme.colors.text, fontSize: 32, fontWeight: '700' }}>
        {formatAmount(currentDisplay, displayCurrency)}
      </Text>
      {hasPrevious ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <MaterialCommunityIcons
            name={up ? 'arrow-up' : 'arrow-down'}
            size={16}
            color={deltaColor}
          />
          <Text style={{ color: deltaColor, fontSize: 13, fontWeight: '600' }}>
            {pct === null ? 'new' : `${Math.abs(pct).toFixed(0)}%`}
          </Text>
          <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>
            vs {formatAmount(previousDisplay, displayCurrency)} previous
          </Text>
        </View>
      ) : (
        <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>
          No comparison data yet
        </Text>
      )}
    </View>
  );
}

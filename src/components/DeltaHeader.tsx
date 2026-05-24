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
  const bothZero = currentDisplay === 0 && previousDisplay === 0;
  const flat = diff === 0;
  const up = diff > 0;

  let arrow: 'arrow-up' | 'arrow-down' | 'minus' = 'minus';
  let deltaColor: string = theme.colors.textMuted;
  if (!flat) {
    arrow = up ? 'arrow-up' : 'arrow-down';
    deltaColor = up ? theme.colors.danger : theme.colors.primary;
  }

  let deltaLabel: string;
  if (pct === null) {
    deltaLabel = 'new';
  } else if (flat) {
    deltaLabel = '0%';
  } else {
    const absPct = Math.abs(pct);
    deltaLabel = absPct < 1 ? '<1%' : `${absPct.toFixed(0)}%`;
  }

  const showComparison = hasPrevious && !bothZero;

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
      {showComparison ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <MaterialCommunityIcons name={arrow} size={16} color={deltaColor} />
          <Text style={{ color: deltaColor, fontSize: 13, fontWeight: '600' }}>
            {deltaLabel}
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

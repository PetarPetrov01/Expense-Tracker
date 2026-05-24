import { View, Text } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import { theme } from '../../theme';
import { formatAmount } from '../../lib/currency';
import { useSettings } from '../../stores/settings';

export type Slice = { categoryId: number; categoryName: string; categoryColor: string; total: number };

export function CategoryPieChart({ slices }: { slices: Slice[] }) {
  const currency = useSettings(s => s.displayCurrency);
  const total = slices.reduce((s, x) => s + x.total, 0);
  if (total === 0) {
    return <Text style={{ color: theme.colors.textMuted, textAlign: 'center', padding: theme.spacing.lg }}>No data in this range.</Text>;
  }
  const data = slices.map(s => ({ value: s.total, color: s.categoryColor, text: '' }));

  return (
    <View style={{ backgroundColor: theme.colors.surface, padding: theme.spacing.md, borderRadius: theme.radius.md }}>
      <Text style={{ color: theme.colors.text, fontSize: 16, marginBottom: theme.spacing.sm }}>By category</Text>
      <View style={{ alignItems: 'center', marginVertical: theme.spacing.md }}>
        <PieChart data={data} donut radius={90} innerRadius={55}
          innerCircleColor={theme.colors.surface}
          centerLabelComponent={() => (
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>Total</Text>
              <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '600' }}>{formatAmount(total, currency)}</Text>
            </View>
          )}
        />
      </View>
      <View style={{ gap: 6 }}>
        {slices.map(s => (
          <View key={s.categoryId} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: s.categoryColor, marginRight: 8 }} />
            <Text style={{ flex: 1, color: theme.colors.text }}>{s.categoryName}</Text>
            <Text style={{ color: theme.colors.text }}>{formatAmount(s.total, currency)}</Text>
            <Text style={{ color: theme.colors.textMuted, width: 48, textAlign: 'right' }}>
              {Math.round((s.total / total) * 100)}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

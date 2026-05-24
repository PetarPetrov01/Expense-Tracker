import { View, Text } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { theme } from '../../theme';
import { formatAmount } from '../../lib/currency';
import { useSettings } from '../../stores/settings';

export type Bar = { label: string; valueCents: number };

export function PeriodBarChart({ bars, title }: { bars: Bar[]; title: string }) {
  const currency = useSettings(s => s.displayCurrency);
  if (bars.length === 0) {
    return (
      <View style={{ backgroundColor: theme.colors.surface, padding: theme.spacing.md, borderRadius: theme.radius.md }}>
        <Text style={{ color: theme.colors.text, fontSize: 16, marginBottom: theme.spacing.sm }}>{title}</Text>
        <Text style={{ color: theme.colors.textMuted, textAlign: 'center', padding: theme.spacing.lg }}>No data in this range.</Text>
      </View>
    );
  }
  const maxC = Math.max(1, ...bars.map(b => b.valueCents));
  const data = bars.map(b => ({
    value: b.valueCents / 100,
    label: b.label,
    frontColor: theme.colors.primary,
    topLabelComponent: () => b.valueCents > 0
      ? <Text style={{ color: theme.colors.text, fontSize: 10 }}>{formatAmount(b.valueCents, currency)}</Text>
      : null,
  }));

  return (
    <View style={{ backgroundColor: theme.colors.surface, padding: theme.spacing.md, borderRadius: theme.radius.md }}>
      <Text style={{ color: theme.colors.text, fontSize: 16, marginBottom: theme.spacing.sm }}>{title}</Text>
      <BarChart
        data={data}
        barWidth={Math.max(8, 220 / bars.length)}
        spacing={Math.max(4, 80 / bars.length)}
        yAxisTextStyle={{ color: theme.colors.textMuted }}
        xAxisLabelTextStyle={{ color: theme.colors.textMuted, fontSize: 10 }}
        yAxisColor={theme.colors.border}
        xAxisColor={theme.colors.border}
        noOfSections={4}
        maxValue={Math.ceil(maxC / 100 / 10) * 10 || 10}
        isAnimated
      />
    </View>
  );
}

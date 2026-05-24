import { View, Text } from 'react-native';
import { theme } from '../../theme';
import { EmptyState } from '../EmptyState';

export type Bar = { label: string; valueCents: number };

const PLOT_HEIGHT = 160;
const Y_AXIS_WIDTH = 36;
const TICKS = [1, 0.75, 0.5, 0.25, 0];

export function PeriodBarChart({ bars, title }: { bars: Bar[]; title: string }) {
  if (bars.length === 0) {
    return (
      <View style={{ backgroundColor: theme.colors.surface, padding: theme.spacing.md, borderRadius: theme.radius.md }}>
        <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '600', marginBottom: theme.spacing.sm }}>{title}</Text>
        <EmptyState icon="chart-bar" title="No data" hint="No expenses in this range." />
      </View>
    );
  }

  const maxC = Math.max(1, ...bars.map(b => b.valueCents));
  const niceMax = (Math.ceil(maxC / 100 / 10) * 10) || 10;

  return (
    <View style={{ backgroundColor: theme.colors.surface, padding: theme.spacing.md, borderRadius: theme.radius.md }}>
      <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '600', marginBottom: theme.spacing.sm }}>{title}</Text>
      <View style={{ flexDirection: 'row', height: PLOT_HEIGHT }}>
        <View style={{ width: Y_AXIS_WIDTH, justifyContent: 'space-between', paddingRight: 4 }}>
          {TICKS.map(t => (
            <Text key={t} style={{ color: theme.colors.text, fontSize: 10, textAlign: 'right' }}>
              {Math.round(niceMax * t)}
            </Text>
          ))}
        </View>
        <View style={{ flex: 1, position: 'relative' }}>
          {TICKS.map((t, i) => (
            <View key={i} style={{
              position: 'absolute', left: 0, right: 0,
              top: (1 - t) * PLOT_HEIGHT,
              height: 1, backgroundColor: theme.colors.border,
            }} />
          ))}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: '100%', gap: 4 }}>
            {bars.map((b, i) => {
              const h = Math.max(0, (b.valueCents / 100) / niceMax) * PLOT_HEIGHT;
              return (
                <View key={`${b.label}-${i}`} style={{
                  flex: 1, height: h,
                  backgroundColor: theme.colors.primary,
                  borderTopLeftRadius: 3, borderTopRightRadius: 3,
                }} />
              );
            })}
          </View>
        </View>
      </View>
      <View style={{ flexDirection: 'row', marginLeft: Y_AXIS_WIDTH, marginTop: 4, gap: 4 }}>
        {bars.map((b, i) => (
          <Text key={`${b.label}-${i}`} numberOfLines={1} style={{
            flex: 1, textAlign: 'center',
            color: theme.colors.text, fontSize: 10,
          }}>
            {b.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

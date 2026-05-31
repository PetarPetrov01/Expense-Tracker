import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { PieChart } from 'react-native-gifted-charts';
import { theme } from '../../theme';
import { formatAmount } from '../../lib/currency';
import { useSettings } from '../../stores/settings';
import { EmptyState } from '../EmptyState';

export type TagBreakdownEntry = { tagId: number | null; tagName: string | null; total: number };
export type Slice = {
  categoryId: number;
  categoryName: string;
  categoryColor: string;
  total: number;
  tagBreakdown?: TagBreakdownEntry[];
};

type Mode = 'pie' | 'bar';
const SLOT_PIE = 190;
const SLOT_BAR = 72;
const BAR_HEIGHT = 28;

export function CategoryPieChart({ slices }: { slices: Slice[] }) {
  const currency = useSettings(s => s.displayCurrency);
  const [mode, setMode] = useState<Mode>('pie');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const progress = useSharedValue(0);

  const total = slices.reduce((s, x) => s + x.total, 0);

  const pieStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  const barStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const slotStyle = useAnimatedStyle(() => ({
    height: SLOT_PIE + (SLOT_BAR - SLOT_PIE) * progress.value,
  }));

  const toggle = () => {
    const next: Mode = mode === 'pie' ? 'bar' : 'pie';
    setMode(next);
    progress.value = withTiming(next === 'bar' ? 1 : 0, { duration: 220 });
  };

  if (total === 0) {
    return (
      <View style={{ backgroundColor: theme.colors.surface, padding: theme.spacing.md, borderRadius: theme.radius.md }}>
        <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '600', marginBottom: theme.spacing.sm }}>By category</Text>
        <EmptyState icon="chart-pie" title="No data" hint="No expenses in this range." />
      </View>
    );
  }

  const pieData = slices.map(s => ({ value: s.total, color: s.categoryColor, text: '' }));
  const nextIcon = mode === 'pie' ? 'chart-bar' : 'chart-donut';

  return (
    <View style={{ backgroundColor: theme.colors.surface, padding: theme.spacing.md, borderRadius: theme.radius.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm }}>
        <Text style={{ flex: 1, color: theme.colors.text, fontSize: 16, fontWeight: '600' }}>By category</Text>
        <Pressable onPress={toggle} hitSlop={8} style={{
          width: 28, height: 28, borderRadius: 14,
          backgroundColor: theme.colors.surface2,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <MaterialCommunityIcons name={nextIcon} size={16} color={theme.colors.text} />
        </Pressable>
      </View>

      <Animated.View style={[{ justifyContent: 'center', overflow: 'hidden' }, slotStyle]}>
        <Animated.View pointerEvents={mode === 'pie' ? 'auto' : 'none'} style={[
          { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
          pieStyle,
        ]}>
          <PieChart data={pieData} donut radius={85} innerRadius={52}
            innerCircleColor={theme.colors.surface}
            centerLabelComponent={() => (
              <View style={{ alignItems: 'center' }}>
                <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>Total</Text>
                <Text style={{ color: theme.colors.text, fontSize: 20, fontWeight: '700' }}>{formatAmount(total, currency)}</Text>
              </View>
            )}
          />
        </Animated.View>

        <Animated.View pointerEvents={mode === 'bar' ? 'auto' : 'none'} style={[
          { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'center' },
          barStyle,
        ]}>
          <View style={{ alignItems: 'center', marginBottom: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>Total</Text>
            <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '600' }}>{formatAmount(total, currency)}</Text>
          </View>
          <View style={{
            flexDirection: 'row', height: BAR_HEIGHT,
            borderRadius: BAR_HEIGHT / 2, overflow: 'hidden',
            backgroundColor: theme.colors.surface2,
          }}>
            {slices.map(s => (
              <View key={s.categoryId} style={{ flex: s.total, backgroundColor: s.categoryColor }} />
            ))}
          </View>
        </Animated.View>
      </Animated.View>

      <View style={{ gap: 6, marginTop: theme.spacing.md }}>
        {slices.map(s => {
          const canExpand = !!s.tagBreakdown?.length;
          const expanded = expandedId === s.categoryId;
          return (
            <View key={s.categoryId}>
              <Pressable
                onPress={() => canExpand && setExpandedId(expanded ? null : s.categoryId)}
                style={{ flexDirection: 'row', alignItems: 'center' }}
              >
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: s.categoryColor, marginRight: 8 }} />
                <Text style={{ flex: 1, color: theme.colors.text }}>{s.categoryName}</Text>
                <Text style={{ color: theme.colors.text }}>{formatAmount(s.total, currency)}</Text>
                <Text style={{ color: theme.colors.textMuted, width: 48, textAlign: 'right' }}>
                  {Math.round((s.total / total) * 100)}%
                </Text>
                <View style={{ width: 20, alignItems: 'center' }}>
                  {canExpand && (
                    <MaterialCommunityIcons
                      name={expanded ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={theme.colors.textMuted}
                    />
                  )}
                </View>
              </Pressable>

              {expanded && s.tagBreakdown!.map(b => (
                <View
                  key={b.tagId ?? 'none'}
                  style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 20, marginTop: 4 }}
                >
                  <Text style={{ flex: 1, color: theme.colors.textMuted }}>
                    {b.tagName ?? 'No tag'}
                  </Text>
                  <Text style={{ color: theme.colors.textMuted }}>{formatAmount(b.total, currency)}</Text>
                  <View style={{ width: 48 + 20 }} />
                </View>
              ))}
            </View>
          );
        })}
      </View>
    </View>
  );
}

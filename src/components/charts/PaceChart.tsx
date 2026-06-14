import { useState } from 'react';
import { View, Text, type LayoutChangeEvent } from 'react-native';
import Svg, { Polyline, Line, Circle } from 'react-native-svg';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { theme } from '../../theme';
import { formatAmount, type CurrencyCode } from '../../lib/currency';
import type { Scope } from '../../lib/dates';

const PLOT_HEIGHT = 160;
const PAD = 8;
const PREV_COLOR = '#64748b';
const SCOPE_NOUN: Partial<Record<Scope, string>> = { week: 'week', month: 'month', year: 'year' };

export function PaceChart({
  scope,
  currentDisplay,
  previousDisplay,
  todayIndex,
  isInProgress,
  currentTotalDisplay,
  deltaDisplay,
  displayCurrency,
}: {
  scope: Scope;
  currentDisplay: number[];   // cumulative display cents per day (current period, full length)
  previousDisplay: number[];  // cumulative display cents per day (previous period, full length)
  todayIndex: number;
  isInProgress: boolean;
  currentTotalDisplay: number;
  deltaDisplay: number | null; // null = no previous data
  displayCurrency: CurrencyCode;
}) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const noun = SCOPE_NOUN[scope] ?? 'period';

  // Headline chip styling (red = spent more, green = spent less — matches app convention).
  const flat = deltaDisplay === 0;
  const up = (deltaDisplay ?? 0) > 0;
  let arrow: 'arrow-up' | 'arrow-down' | 'minus' = 'minus';
  let deltaColor: string = theme.colors.textMuted;
  if (deltaDisplay !== null && !flat) {
    arrow = up ? 'arrow-up' : 'arrow-down';
    deltaColor = up ? theme.colors.danger : theme.colors.primary;
  }

  // Geometry. X domain = max period length so the two lines align by elapsed day.
  const drawnCurrent = currentDisplay.slice(0, todayIndex + 1);
  const endIdx = drawnCurrent.length - 1; // last drawn point of the current line
  const maxLen = Math.max(currentDisplay.length, previousDisplay.length, 1);
  const maxC = Math.max(1, ...drawnCurrent, ...previousDisplay); // display cents
  const niceMax = Math.ceil(maxC / 100 / 10) * 10 || 10;          // whole currency units

  const plotW = Math.max(0, width - PAD * 2);
  const x = (i: number) => PAD + (maxLen <= 1 ? 0 : (i / (maxLen - 1)) * plotW);
  const y = (cents: number) => PLOT_HEIGHT - ((cents / 100) / niceMax) * PLOT_HEIGHT;
  const points = (arr: number[]) => arr.map((v, i) => `${x(i)},${y(v)}`).join(' ');

  return (
    <View style={{ backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: theme.spacing.md, gap: 4 }}>
      <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>Total</Text>
      <Text style={{ color: theme.colors.text, fontSize: 32, fontWeight: '700' }}>
        {formatAmount(currentTotalDisplay, displayCurrency)}
      </Text>

      {deltaDisplay === null ? (
        <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>No comparison data yet</Text>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <MaterialCommunityIcons name={arrow} size={16} color={deltaColor} />
          <Text style={{ color: deltaColor, fontSize: 13, fontWeight: '600' }}>
            {flat ? 'same' : `${formatAmount(Math.abs(deltaDisplay), displayCurrency)} ${up ? 'more' : 'less'}`}
          </Text>
          <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>
            {isInProgress ? `than this point last ${noun}` : `than last ${noun}`}
          </Text>
        </View>
      )}

      <View onLayout={onLayout} style={{ marginTop: theme.spacing.sm }}>
        {width > 0 && (
          <Svg width={width} height={PLOT_HEIGHT}>
            <Line x1={PAD} y1={PLOT_HEIGHT} x2={width - PAD} y2={PLOT_HEIGHT} stroke={theme.colors.border} strokeWidth={1} />

            {previousDisplay.length > 1 && (
              <Polyline points={points(previousDisplay)} fill="none" stroke={PREV_COLOR} strokeWidth={2} strokeDasharray="3 3" />
            )}

            {drawnCurrent.length > 1 && (
              <Polyline points={points(drawnCurrent)} fill="none" stroke={theme.colors.primary} strokeWidth={2.5} />
            )}

            {drawnCurrent.length > 0 && (
              <>
                {/* Today marker only while the period is in progress — a completed period has no "today". */}
                {isInProgress && (
                  <Line x1={x(endIdx)} y1={0} x2={x(endIdx)} y2={PLOT_HEIGHT} stroke={theme.colors.text} strokeWidth={1} strokeDasharray="2 3" opacity={0.4} />
                )}
                <Circle cx={x(endIdx)} cy={y(drawnCurrent[endIdx])} r={3.5} fill={theme.colors.primary} />
              </>
            )}
          </Svg>
        )}
      </View>
    </View>
  );
}

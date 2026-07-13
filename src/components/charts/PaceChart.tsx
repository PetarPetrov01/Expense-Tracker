import { useState } from 'react';
import { View, Text, Pressable, type LayoutChangeEvent, type GestureResponderEvent } from 'react-native';
import Svg, { Polyline, Line, Circle, Text as SvgText } from 'react-native-svg';
import type { AxisTick } from '../../lib/pace';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { theme } from '../../theme';
import { formatAmount, codeToSymbol, type CurrencyCode } from '../../lib/currency';
import type { Scope } from '../../lib/dates';

const PLOT_HEIGHT = 160;
const PAD = 8;
const AXIS_W = 34;        // left gutter reserved for y-axis value labels
const TOOLTIP_W = 116;
const PREV_COLOR = '#64748b';
const SCOPE_NOUN: Partial<Record<Scope, string>> = { week: 'week', month: 'month', year: 'year' };

type Mode = 'total' | 'step';

// Compact axis label for whole currency units: 1240 → "1.2k", 80 → "80".
function compactUnits(units: number): string {
  if (units >= 1000) {
    const k = units / 1000;
    return `${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`;
  }
  return String(Math.round(units));
}

export function PaceChart({
  scope,
  currentDisplay,
  previousDisplay,
  todayIndex,
  isInProgress,
  currentTotalDisplay,
  deltaDisplay,
  displayCurrency,
  xLabels,
  pointLabels,
  stepCurrentDisplay,
  stepPreviousDisplay,
  stepTodayIndex,
  stepXLabels,
  stepPointLabels,
  stepLabel,
  onActiveChange,
}: {
  scope: Scope;
  currentDisplay: number[];   // cumulative display cents per day (current period, full length)
  previousDisplay: number[];  // cumulative display cents per day (previous period, full length)
  todayIndex: number;
  isInProgress: boolean;
  currentTotalDisplay: number;
  deltaDisplay: number | null; // null = no previous data
  displayCurrency: CurrencyCode;
  xLabels: AxisTick[];
  pointLabels: string[];         // one label per cumulative index (for the scrubber tooltip)
  stepCurrentDisplay: number[];  // non-cumulative display cents per step (current period)
  stepPreviousDisplay: number[]; // non-cumulative display cents per step (previous period)
  stepTodayIndex: number;
  stepXLabels: AxisTick[];
  stepPointLabels: string[];     // one label per step index
  stepLabel: string;             // segmented-control label for step mode, e.g. "Per day"
  onActiveChange?: (active: boolean) => void; // true while scrubbing, so the parent can freeze scroll
}) {
  const [width, setWidth] = useState(0);
  const [mode, setMode] = useState<Mode>('total');
  const [active, setActive] = useState<number | null>(null); // scrubbed index, null = idle
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const noun = SCOPE_NOUN[scope] ?? 'period';

  // The toggle only reshapes the two lines; the headline stays the period total in both modes.
  const step = mode === 'step';
  const currentArr = step ? stepCurrentDisplay : currentDisplay;
  const previousArr = step ? stepPreviousDisplay : previousDisplay;
  const drawnTodayIndex = step ? stepTodayIndex : todayIndex;
  const ticks = step ? stepXLabels : xLabels;
  const labels = step ? stepPointLabels : pointLabels;

  // Headline chip styling (red = spent more, green = spent less — matches app convention).
  const flat = deltaDisplay === 0;
  const up = (deltaDisplay ?? 0) > 0;
  let arrow: 'arrow-up' | 'arrow-down' | 'minus' = 'minus';
  let deltaColor: string = theme.colors.textMuted;
  if (deltaDisplay !== null && !flat) {
    arrow = up ? 'arrow-up' : 'arrow-down';
    deltaColor = up ? theme.colors.danger : theme.colors.primary;
  }

  // Geometry. X domain = max period length so the two lines align by elapsed step.
  const drawnCurrent = currentArr.slice(0, drawnTodayIndex + 1);
  const endIdx = drawnCurrent.length - 1; // last drawn point of the current line
  const maxLen = Math.max(currentArr.length, previousArr.length, 1);
  const maxC = Math.max(1, ...drawnCurrent, ...previousArr); // display cents
  const niceMax = Math.ceil(maxC / 100 / 10) * 10 || 10;          // whole currency units

  const plotW = Math.max(0, width - AXIS_W - PAD);
  const x = (i: number) => AXIS_W + (maxLen <= 1 ? 0 : (i / (maxLen - 1)) * plotW);
  const y = (cents: number) => PLOT_HEIGHT - ((cents / 100) / niceMax) * PLOT_HEIGHT;
  const points = (arr: number[]) => arr.map((v, i) => `${x(i)},${y(v)}`).join(' ');

  // Map a touch x-coordinate to the nearest data index.
  const onScrub = (e: GestureResponderEvent) => {
    const lx = e.nativeEvent.locationX;
    const frac = plotW <= 0 ? 0 : (lx - AXIS_W) / plotW;
    const idx = Math.round(frac * (maxLen - 1));
    setActive(Math.min(Math.max(idx, 0), maxLen - 1));
  };
  const startScrub = (e: GestureResponderEvent) => { onActiveChange?.(true); onScrub(e); };
  const endScrub = () => { setActive(null); onActiveChange?.(false); };

  // Values under the scrubber. Current only exists up to the drawn ("today") index.
  const ai = active;
  const curVal = ai !== null && ai <= endIdx ? drawnCurrent[ai] : null;
  const prevVal = ai !== null && ai < previousArr.length ? previousArr[ai] : null;
  const tipLeft = ai === null ? 0 : Math.min(Math.max(x(ai) - TOOLTIP_W / 2, 0), Math.max(0, width - TOOLTIP_W));

  // Y gridlines/labels at max, mid, and zero.
  const gridFracs = [1, 0.5, 0];

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
          {flat ? (
            <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>
              {isInProgress ? `same as this point last ${noun}` : `same as last ${noun}`}
            </Text>
          ) : (
            <>
              <Text style={{ color: deltaColor, fontSize: 13, fontWeight: '600' }}>
                {`${formatAmount(Math.abs(deltaDisplay), displayCurrency)} ${up ? 'more' : 'less'}`}
              </Text>
              <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>
                {isInProgress ? `than this point last ${noun}` : `than last ${noun}`}
              </Text>
            </>
          )}
        </View>
      )}

      <View style={{ flexDirection: 'row', gap: 4, marginTop: theme.spacing.sm, alignSelf: 'flex-start' }}>
        {([['total', 'Total'], ['step', stepLabel]] as [Mode, string][]).map(([m, label]) => (
          <Pressable
            key={m}
            onPress={() => { setMode(m); setActive(null); }}
            style={{
              paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radius.pill,
              backgroundColor: mode === m ? theme.colors.primary : theme.colors.surface2,
            }}
          >
            <Text style={{ color: mode === m ? '#fff' : theme.colors.textMuted, fontSize: 12, fontWeight: '600' }}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View
        onLayout={onLayout}
        style={{ marginTop: theme.spacing.sm }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        // Refuse to hand the touch back to the parent ScrollView mid-drag. The parent also
        // freezes vertical scroll via onActiveChange, so a slightly-diagonal drag can't let
        // native scroll steal (and terminate) the scrub.
        onResponderTerminationRequest={() => false}
        onResponderGrant={startScrub}
        onResponderMove={onScrub}
        onResponderRelease={endScrub}
        onResponderTerminate={endScrub}
      >
        {width > 0 && (
          <Svg width={width} height={PLOT_HEIGHT + 18}>
            {gridFracs.map(f => {
              const gy = PLOT_HEIGHT - f * PLOT_HEIGHT;
              return (
                <Line
                  key={f}
                  x1={AXIS_W} y1={gy} x2={width - PAD} y2={gy}
                  stroke={theme.colors.border}
                  strokeWidth={1}
                  opacity={f === 0 ? 1 : 0.35}
                />
              );
            })}

            {gridFracs.map(f => (
              <SvgText
                key={`l${f}`}
                x={AXIS_W - 6}
                y={Math.min(Math.max(PLOT_HEIGHT - f * PLOT_HEIGHT, 8), PLOT_HEIGHT) + 3}
                fill={theme.colors.textMuted}
                fontSize={9}
                textAnchor="end"
              >
                {`${codeToSymbol(displayCurrency)}${compactUnits(niceMax * f)}`}
              </SvgText>
            ))}

            {previousArr.length > 1 && (
              <Polyline points={points(previousArr)} fill="none" stroke={PREV_COLOR} strokeWidth={2} strokeDasharray="3 3" />
            )}

            {drawnCurrent.length > 1 && (
              <Polyline points={points(drawnCurrent)} fill="none" stroke={theme.colors.primary} strokeWidth={2.5} />
            )}

            {drawnCurrent.length > 0 && active === null && (
              <>
                {/* Today marker only while the period is in progress — a completed period has no "today". */}
                {isInProgress && (
                  <Line x1={x(endIdx)} y1={0} x2={x(endIdx)} y2={PLOT_HEIGHT} stroke={theme.colors.text} strokeWidth={1} strokeDasharray="2 3" opacity={0.4} />
                )}
                <Circle cx={x(endIdx)} cy={y(drawnCurrent[endIdx])} r={3.5} fill={theme.colors.primary} />
              </>
            )}

            {/* Scrubber: vertical guide + highlighted points at the touched index. */}
            {ai !== null && (
              <>
                <Line x1={x(ai)} y1={0} x2={x(ai)} y2={PLOT_HEIGHT} stroke={theme.colors.text} strokeWidth={1} opacity={0.5} />
                {prevVal !== null && (
                  <Circle cx={x(ai)} cy={y(prevVal)} r={3.5} fill={PREV_COLOR} />
                )}
                {curVal !== null && (
                  <Circle cx={x(ai)} cy={y(curVal)} r={4} fill={theme.colors.primary} />
                )}
              </>
            )}

            {ticks.map(t => (
              <SvgText
                key={t.index}
                x={x(t.index)}
                y={PLOT_HEIGHT + 13}
                fill={theme.colors.textMuted}
                fontSize={9}
                textAnchor="middle"
              >
                {t.label}
              </SvgText>
            ))}
          </Svg>
        )}

        {/* Tooltip bubble, pinned to the top of the plot and clamped within its width. */}
        {ai !== null && (curVal !== null || prevVal !== null) && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute', top: 0, left: tipLeft, width: TOOLTIP_W,
              backgroundColor: theme.colors.surface2, borderRadius: theme.radius.sm,
              borderWidth: 1, borderColor: theme.colors.border,
              paddingHorizontal: 8, paddingVertical: 6,
            }}
          >
            <Text style={{ color: theme.colors.textMuted, fontSize: 10, marginBottom: 2 }}>
              {labels[ai] ?? ''}
            </Text>
            {curVal !== null && (
              <Text style={{ color: theme.colors.primary, fontSize: 13, fontWeight: '700' }}>
                {formatAmount(curVal, displayCurrency)}
              </Text>
            )}
            {prevVal !== null && (
              <Text style={{ color: PREV_COLOR, fontSize: 11 }}>
                {`${formatAmount(prevVal, displayCurrency)} last ${noun}`}
              </Text>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

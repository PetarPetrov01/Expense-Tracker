import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { startOfMonth, endOfMonth } from 'date-fns';
import { theme } from '../theme';
import { useSettings } from '../stores/settings';
import {
  type Scope,
  stepAnchor,
  canGoForward,
  isAtCurrent,
  formatScope,
  formatCustomRange,
} from '../lib/dates';
import { ScopePickerSheet } from './ScopePickerSheet';
import { CustomRangeSheet } from './CustomRangeSheet';
import { SwipeablePeriodLabel } from './SwipeablePeriodLabel';

const ALL_SCOPES: { key: Scope; label: string }[] = [
  { key: 'day',    label: 'Day' },
  { key: 'week',   label: 'Week' },
  { key: 'month',  label: 'Month' },
  { key: 'year',   label: 'Year' },
];

function defaultCustomRange(): { start: Date; end: Date } {
  const now = new Date();
  return { start: startOfMonth(now), end: endOfMonth(now) };
}

export function PeriodScope({
  scope, anchor, onScopeChange, onAnchorChange, scopes,
  customRange, onCustomRangeChange,
}: {
  scope: Scope;
  anchor: Date;
  onScopeChange: (s: Scope) => void;
  onAnchorChange: (d: Date) => void;
  scopes?: Scope[];
  customRange?: { start: Date; end: Date } | null;
  onCustomRangeChange?: (range: { start: Date; end: Date }) => void;
}) {
  const weekStart = useSettings(s => s.weekStart);
  const isCustom = scope === 'custom';
  const atCurrent = isAtCurrent(scope, anchor, weekStart);
  const forwardOk = canGoForward(scope, anchor, weekStart);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);

  const visibleScopes = scopes
    ? ALL_SCOPES.filter(s => scopes.includes(s.key))
    : ALL_SCOPES;
  const customAllowed = scopes ? scopes.includes('custom') : true;

  const label = isCustom && customRange
    ? formatCustomRange(customRange.start, customRange.end)
    : formatScope(scope, anchor, weekStart);

  function onChipPress(s: Scope) {
    onScopeChange(s);
  }

  function onLabelPress() {
    if (isCustom) setCustomOpen(true);
    else setPickerOpen(true);
  }

  function onCustomApply(range: { start: Date; end: Date }) {
    onCustomRangeChange?.(range);
    onScopeChange('custom');
  }

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        {visibleScopes.map(s => (
          <Pressable
            key={s.key}
            onPress={() => onChipPress(s.key)}
            style={{
              flex: 1, padding: theme.spacing.sm, borderRadius: theme.radius.pill, alignItems: 'center',
              backgroundColor: scope === s.key ? theme.colors.primary : theme.colors.surface,
            }}
          >
            <Text style={{ color: '#fff' }}>{s.label}</Text>
          </Pressable>
        ))}
        {customAllowed && (
          <Pressable
            onPress={() => setCustomOpen(true)}
            hitSlop={6}
            style={{
              width: 40, height: 36, borderRadius: theme.radius.pill,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: isCustom ? theme.colors.primary : theme.colors.surface,
            }}
          >
            <MaterialCommunityIcons name="calendar-range" size={18} color="#fff" />
          </Pressable>
        )}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        {isCustom
          ? <View style={{ width: 36, height: 36 }} />
          : <ChevronButton icon="chevron-left" onPress={() => onAnchorChange(stepAnchor(scope, anchor, -1))} />
        }
        {isCustom ? (
          <Pressable
            onPress={onLabelPress}
            style={{ flex: 1, height: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}
          >
            <Text style={{ color: theme.colors.text, fontSize: 15, fontWeight: '600' }}>{label}</Text>
            <MaterialCommunityIcons name="chevron-down" size={18} color={theme.colors.text} />
          </Pressable>
        ) : (
          <SwipeablePeriodLabel
            anchor={anchor}
            scope={scope}
            weekStart={weekStart}
            canPrev
            canNext={forwardOk}
            onAnchorChange={onAnchorChange}
            onPress={onLabelPress}
          />
        )}
        {!isCustom && forwardOk
          ? <ChevronButton icon="chevron-right" onPress={() => onAnchorChange(stepAnchor(scope, anchor, 1))} />
          : <View style={{ width: 36, height: 36 }} />}
        {!isCustom && (
          <Pressable
            onPress={() => onAnchorChange(new Date())}
            disabled={atCurrent}
            style={{
              paddingHorizontal: 12, height: 36, borderRadius: 18,
              backgroundColor: theme.colors.primary,
              alignItems: 'center', justifyContent: 'center',
              opacity: atCurrent ? 0 : 1,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Today</Text>
          </Pressable>
        )}
      </View>

      {!isCustom && (
        <ScopePickerSheet
          visible={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelect={onAnchorChange}
          scope={scope}
          anchor={anchor}
          weekStart={weekStart}
        />
      )}

      <CustomRangeSheet
        visible={customOpen}
        initial={customRange ?? defaultCustomRange()}
        onClose={() => setCustomOpen(false)}
        onApply={onCustomApply}
      />
    </View>
  );
}

function ChevronButton({ icon, onPress }: { icon: 'chevron-left' | 'chevron-right'; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={{
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: theme.colors.surface2,
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <MaterialCommunityIcons name={icon} size={22} color={theme.colors.text} />
    </Pressable>
  );
}

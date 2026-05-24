import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { theme } from '../theme';
import { useSettings } from '../stores/settings';
import {
  type Scope,
  stepAnchor,
  canGoForward,
  isAtCurrent,
  formatScope,
} from '../lib/dates';
import { ScopePickerSheet } from './ScopePickerSheet';

const SCOPES: { key: Scope; label: string }[] = [
  { key: 'day',   label: 'Day' },
  { key: 'week',  label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year',  label: 'Year' },
];

export function PeriodScope({
  scope, anchor, onScopeChange, onAnchorChange,
}: {
  scope: Scope;
  anchor: Date;
  onScopeChange: (s: Scope) => void;
  onAnchorChange: (d: Date) => void;
}) {
  const weekStart = useSettings(s => s.weekStart);
  const atCurrent = isAtCurrent(scope, anchor, weekStart);
  const forwardOk = canGoForward(scope, anchor, weekStart);
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        {SCOPES.map(s => (
          <Pressable
            key={s.key}
            onPress={() => onScopeChange(s.key)}
            style={{
              flex: 1, padding: theme.spacing.sm, borderRadius: theme.radius.pill, alignItems: 'center',
              backgroundColor: scope === s.key ? theme.colors.primary : theme.colors.surface,
            }}
          >
            <Text style={{ color: '#fff' }}>{s.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <ChevronButton icon="chevron-left" onPress={() => onAnchorChange(stepAnchor(scope, anchor, -1))} />
        <Pressable
          onPress={() => setPickerOpen(true)}
          style={{ flex: 1, height: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}
        >
          <Text style={{
            color: theme.colors.text, fontSize: 15, fontWeight: '600',
          }}>
            {formatScope(scope, anchor, weekStart)}
          </Text>
          <MaterialCommunityIcons name="chevron-down" size={18} color={theme.colors.text} />
        </Pressable>
        {forwardOk
          ? <ChevronButton icon="chevron-right" onPress={() => onAnchorChange(stepAnchor(scope, anchor, 1))} />
          : <View style={{ width: 36, height: 36 }} />}
        {!atCurrent && (
          <Pressable
            onPress={() => onAnchorChange(new Date())}
            style={{
              paddingHorizontal: 12, height: 36, borderRadius: 18,
              backgroundColor: theme.colors.primary,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Today</Text>
          </Pressable>
        )}
      </View>

      <ScopePickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={onAnchorChange}
        scope={scope}
        anchor={anchor}
        weekStart={weekStart}
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

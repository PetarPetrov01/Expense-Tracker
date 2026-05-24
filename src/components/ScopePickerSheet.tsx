import { useEffect, useState } from 'react';
import {
  Modal, ScrollView, View, Text, Pressable, Dimensions,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, runOnJS,
} from 'react-native-reanimated';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  startOfDay, startOfMonth, startOfYear,
  eachDayOfInterval, eachWeekOfInterval, endOfMonth,
  addMonths, subMonths, addYears, subYears,
  isSameDay, isSameWeek, isSameMonth, isSameYear,
  isAfter, format,
} from 'date-fns';
import { type Scope, type WeekStart, weekStartsOn } from '../lib/dates';
import { theme } from '../theme';

const SCREEN_H = Dimensions.get('window').height;

export function ScopePickerSheet({
  visible, onClose, onSelect, scope, anchor, weekStart,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (d: Date) => void;
  scope: Scope;
  anchor: Date;
  weekStart: WeekStart;
}) {
  const initialBrowse = scope === 'month' ? startOfYear(anchor) : startOfMonth(anchor);
  const [browse, setBrowse] = useState<Date>(initialBrowse);
  const [pending, setPending] = useState<Date>(anchor);
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    if (visible) {
      setBrowse(scope === 'month' ? startOfYear(anchor) : startOfMonth(anchor));
      setPending(anchor);
      setMounted(true);
      progress.value = 0;
      const raf = requestAnimationFrame(() => {
        progress.value = withTiming(1, { duration: 240 });
      });
      return () => cancelAnimationFrame(raf);
    } else {
      progress.value = withTiming(0, { duration: 200 }, finished => {
        if (finished) runOnJS(setMounted)(false);
      });
    }
  }, [visible, scope, anchor]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value * 0.6 }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * SCREEN_H }],
  }));

  const confirm = () => { onSelect(pending); onClose(); };

  return (
    <Modal visible={mounted} animationType="none" transparent onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <Animated.View style={[{ ...StyleAbsoluteFill, backgroundColor: '#000' }, backdropStyle]}>
          <Pressable onPress={onClose} style={{ flex: 1 }} />
        </Animated.View>
        <Animated.View style={[{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          backgroundColor: theme.colors.surface,
          padding: theme.spacing.lg,
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          gap: theme.spacing.md,
        }, sheetStyle]}>
          <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '600' }}>
            {titleFor(scope)}
          </Text>

          {scope === 'week' && (
            <SubStepper
              label={format(browse, 'MMMM yyyy')}
              onPrev={() => setBrowse(subMonths(browse, 1))}
              onNext={() => setBrowse(addMonths(browse, 1))}
              forwardOk={!isSameMonthOrAfter(browse, new Date())}
            />
          )}
          {scope === 'month' && (
            <SubStepper
              label={format(browse, 'yyyy')}
              onPrev={() => setBrowse(subYears(browse, 1))}
              onNext={() => setBrowse(addYears(browse, 1))}
              forwardOk={browse.getFullYear() < new Date().getFullYear()}
            />
          )}

          <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={{ paddingBottom: theme.spacing.sm, gap: theme.spacing.md }}>
            {scope === 'day'   && <DayPicker browse={browse} setBrowse={setBrowse} pending={pending} weekStart={weekStart} onPick={setPending} />}
            {scope === 'week'  && <WeekList  browse={browse} pending={pending} weekStart={weekStart} onPick={setPending} />}
            {scope === 'month' && <MonthGrid browse={browse} pending={pending} onPick={setPending} />}
            {scope === 'year'  && <YearList  pending={pending} onPick={setPending} />}
          </ScrollView>

          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
            <Pressable
              onPress={onClose}
              style={{
                flex: 1, padding: theme.spacing.md, borderRadius: theme.radius.md, alignItems: 'center',
                backgroundColor: theme.colors.surface2,
              }}
            >
              <Text style={{ color: theme.colors.text, fontSize: 15, fontWeight: '600' }}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={confirm}
              style={{
                flex: 1, padding: theme.spacing.md, borderRadius: theme.radius.md, alignItems: 'center',
                backgroundColor: theme.colors.primary,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>OK</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const StyleAbsoluteFill = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };

function DayPicker({ browse, setBrowse, pending, weekStart, onPick }: {
  browse: Date; setBrowse: (d: Date) => void; pending: Date; weekStart: WeekStart; onPick: (d: Date) => void;
}) {
  const now = new Date();
  return (
    <View style={{ gap: theme.spacing.md }}>
      <SubStepper
        label={format(browse, 'yyyy')}
        onPrev={() => setBrowse(subYears(browse, 1))}
        onNext={() => setBrowse(addYears(browse, 1))}
        forwardOk={browse.getFullYear() < now.getFullYear()}
      />
      <MonthStrip
        year={browse.getFullYear()}
        selectedMonth={browse.getMonth()}
        onPick={(m) => setBrowse(new Date(browse.getFullYear(), m, 1))}
      />
      <DayGrid browse={browse} pending={pending} weekStart={weekStart} onPick={onPick} />
    </View>
  );
}

function MonthStrip({ year, selectedMonth, onPick }: {
  year: number; selectedMonth: number; onPick: (m: number) => void;
}) {
  const now = new Date();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {Array.from({ length: 12 }, (_, m) => {
        const d = new Date(year, m, 1);
        const disabled = isAfter(d, startOfMonth(now));
        const selected = m === selectedMonth;
        return (
          <Pressable
            key={m}
            disabled={disabled}
            onPress={() => onPick(m)}
            style={{ width: '25%', padding: 3 }}
          >
            <View style={{
              paddingVertical: 8, alignItems: 'center',
              borderRadius: theme.radius.sm,
              backgroundColor: selected ? theme.colors.primary : theme.colors.surface2,
              opacity: disabled ? 0.3 : 1,
            }}>
              <Text style={{ color: selected ? '#fff' : theme.colors.text, fontSize: 12 }}>
                {format(d, 'MMM')}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function titleFor(scope: Scope): string {
  if (scope === 'day') return 'Pick a day';
  if (scope === 'week') return 'Pick a week';
  if (scope === 'month') return 'Pick a month';
  return 'Pick a year';
}

function isSameMonthOrAfter(a: Date, b: Date): boolean {
  return a.getFullYear() > b.getFullYear()
    || (a.getFullYear() === b.getFullYear() && a.getMonth() >= b.getMonth());
}

function SubStepper({ label, onPrev, onNext, forwardOk }: {
  label: string; onPrev: () => void; onNext: () => void; forwardOk: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
      <SubButton icon="chevron-left" onPress={onPrev} />
      <Text style={{ flex: 1, textAlign: 'center', color: theme.colors.text, fontSize: 15, fontWeight: '600' }}>
        {label}
      </Text>
      {forwardOk
        ? <SubButton icon="chevron-right" onPress={onNext} />
        : <View style={{ width: 32, height: 32 }} />}
    </View>
  );
}

function SubButton({ icon, onPress }: { icon: 'chevron-left' | 'chevron-right'; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={{
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: theme.colors.surface2,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <MaterialCommunityIcons name={icon} size={20} color={theme.colors.text} />
    </Pressable>
  );
}

function DayGrid({ browse, pending, weekStart, onPick }: {
  browse: Date; pending: Date; weekStart: WeekStart; onPick: (d: Date) => void;
}) {
  const wso = weekStartsOn(weekStart);
  const monthStart = startOfMonth(browse);
  const monthEnd = endOfMonth(browse);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const leading = (monthStart.getDay() - wso + 7) % 7;
  const dayHeaders = wso === 1
    ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = startOfDay(new Date());

  const animH = useSharedValue<number>(0);
  const animStyle = useAnimatedStyle(() => ({
    height: animH.value > 0 ? animH.value : undefined,
    overflow: 'hidden',
  }));
  const onContentLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h <= 0) return;
    if (animH.value === 0) animH.value = h;
    else if (Math.abs(h - animH.value) > 0.5) animH.value = withTiming(h, { duration: 220 });
  };

  return (
    <View>
      <View style={{ flexDirection: 'row' }}>
        {dayHeaders.map(h => (
          <Text key={h} style={{ width: `${100 / 7}%`, textAlign: 'center', color: theme.colors.textMuted, fontSize: 11, marginBottom: 6 }}>
            {h}
          </Text>
        ))}
      </View>
      <Animated.View style={animStyle}>
      <View onLayout={onContentLayout} style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {Array.from({ length: leading }).map((_, i) => (
          <View key={`lead-${i}`} style={{ width: `${100 / 7}%`, height: 40 }} />
        ))}
        {days.map(d => {
          const disabled = isAfter(startOfDay(d), today);
          const selected = isSameDay(d, pending);
          const isToday = isSameDay(d, today);
          return (
            <Pressable
              key={d.toISOString()}
              disabled={disabled}
              onPress={() => onPick(d)}
              style={{ width: `${100 / 7}%`, height: 40, padding: 2 }}
            >
              <View style={{
                flex: 1, alignItems: 'center', justifyContent: 'center',
                borderRadius: theme.radius.md,
                backgroundColor: selected ? theme.colors.primary : 'transparent',
                borderWidth: isToday && !selected ? 1 : 0,
                borderColor: theme.colors.primary,
                opacity: disabled ? 0.3 : 1,
              }}>
                <Text style={{ color: selected ? '#fff' : theme.colors.text, fontSize: 14 }}>
                  {format(d, 'd')}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      </Animated.View>
    </View>
  );
}

function WeekList({ browse, pending, weekStart, onPick }: {
  browse: Date; pending: Date; weekStart: WeekStart; onPick: (d: Date) => void;
}) {
  const wso = weekStartsOn(weekStart);
  const weeks = eachWeekOfInterval(
    { start: startOfMonth(browse), end: endOfMonth(browse) },
    { weekStartsOn: wso },
  );
  const now = new Date();

  return (
    <View style={{ gap: 6 }}>
      {weeks.map(weekStartDate => {
        const end = new Date(weekStartDate); end.setDate(end.getDate() + 6);
        const disabled = isAfter(weekStartDate, now);
        const selected = isSameWeek(weekStartDate, pending, { weekStartsOn: wso });
        const sameMonth = weekStartDate.getMonth() === end.getMonth();
        const label = sameMonth
          ? `${format(weekStartDate, 'd')} – ${format(end, 'd MMM')}`
          : `${format(weekStartDate, 'd MMM')} – ${format(end, 'd MMM')}`;
        return (
          <Pressable
            key={weekStartDate.toISOString()}
            disabled={disabled}
            onPress={() => onPick(weekStartDate)}
            style={{
              padding: theme.spacing.md, borderRadius: theme.radius.md,
              backgroundColor: selected ? theme.colors.primary : theme.colors.surface2,
              opacity: disabled ? 0.3 : 1,
            }}
          >
            <Text style={{ color: selected ? '#fff' : theme.colors.text, fontSize: 15 }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function MonthGrid({ browse, pending, onPick }: { browse: Date; pending: Date; onPick: (d: Date) => void }) {
  const year = browse.getFullYear();
  const now = new Date();
  const months = Array.from({ length: 12 }, (_, m) => new Date(year, m, 1));
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {months.map(m => {
        const disabled = isAfter(m, startOfMonth(now));
        const selected = isSameMonth(m, pending);
        return (
          <Pressable
            key={m.toISOString()}
            disabled={disabled}
            onPress={() => onPick(m)}
            style={{ width: '25%', padding: 4 }}
          >
            <View style={{
              padding: theme.spacing.md, alignItems: 'center',
              borderRadius: theme.radius.md,
              backgroundColor: selected ? theme.colors.primary : theme.colors.surface2,
              opacity: disabled ? 0.3 : 1,
            }}>
              <Text style={{ color: selected ? '#fff' : theme.colors.text, fontSize: 14 }}>
                {format(m, 'MMM')}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function YearList({ pending, onPick }: { pending: Date; onPick: (d: Date) => void }) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 15 }, (_, i) => currentYear - i);
  return (
    <View style={{ gap: 6 }}>
      {years.map(y => {
        const d = new Date(y, 0, 1);
        const selected = isSameYear(d, pending);
        return (
          <Pressable
            key={y}
            onPress={() => onPick(d)}
            style={{
              padding: theme.spacing.md, borderRadius: theme.radius.md,
              backgroundColor: selected ? theme.colors.primary : theme.colors.surface2,
            }}
          >
            <Text style={{ color: selected ? '#fff' : theme.colors.text, fontSize: 15 }}>{y}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

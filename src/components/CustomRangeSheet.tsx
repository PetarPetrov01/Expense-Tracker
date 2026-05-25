import { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { startOfDay, endOfDay } from 'date-fns';
import { DateField } from './DateField';
import { theme } from '../theme';

export function CustomRangeSheet({ visible, initial, onClose, onApply }: {
  visible: boolean;
  initial: { start: Date; end: Date };
  onClose: () => void;
  onApply: (range: { start: Date; end: Date }) => void;
}) {
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);

  useEffect(() => {
    if (visible) {
      setStart(initial.start);
      setEnd(initial.end);
    }
  }, [visible, initial.start, initial.end]);

  function apply() {
    const a = startOfDay(start);
    const b = endOfDay(end);
    const range = a <= b ? { start: a, end: b } : { start: startOfDay(end), end: endOfDay(start) };
    onApply(range);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)' }]} />
      <View style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        backgroundColor: theme.colors.surface,
        padding: theme.spacing.lg,
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        gap: theme.spacing.lg,
      }}>
        <Text style={{ color: theme.colors.text, fontSize: 18 }}>Custom range</Text>

        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>From</Text>
          <DateField value={start} onChange={setStart} />
        </View>
        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>To</Text>
          <DateField value={end} onChange={setEnd} />
        </View>

        <View style={{ flexDirection: 'row', gap: theme.spacing.lg, justifyContent: 'flex-end' }}>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={{ color: theme.colors.textMuted, fontSize: 16 }}>Cancel</Text>
          </Pressable>
          <Pressable onPress={apply} hitSlop={8}>
            <Text style={{ color: theme.colors.primary, fontSize: 16, fontWeight: '600' }}>Apply</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

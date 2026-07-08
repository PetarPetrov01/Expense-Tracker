import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Text, Pressable, StyleSheet } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { SortKey } from '../lib/expense-filter';
import { theme } from '../theme';

const SLIDE_DISTANCE = 600;
const FADE_DURATION = 200;
const SLIDE_DURATION = 260;

const OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'date-desc',   label: 'Newest first' },
  { key: 'date-asc',    label: 'Oldest first' },
  { key: 'amount-desc', label: 'Amount: high to low' },
  { key: 'amount-asc',  label: 'Amount: low to high' },
];

export function SortSheet({ visible, selected, onClose, onSelect }: {
  visible: boolean; selected: SortKey; onClose: () => void; onSelect: (s: SortKey) => void;
}) {
  const [shouldRender, setShouldRender] = useState(visible);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(SLIDE_DISTANCE)).current;

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 1, duration: FADE_DURATION,  useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: SLIDE_DURATION, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 0,              duration: FADE_DURATION,  useNativeDriver: true }),
        Animated.timing(translateY, { toValue: SLIDE_DISTANCE, duration: SLIDE_DURATION, useNativeDriver: true }),
      ]).start(({ finished }) => { if (finished) setShouldRender(false); });
    }
  }, [visible, opacity, translateY]);

  if (!shouldRender) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)', opacity }]}>
        <Pressable onPress={onClose} style={{ flex: 1 }} />
      </Animated.View>
      <Animated.View style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        backgroundColor: theme.colors.surface,
        padding: theme.spacing.lg,
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        transform: [{ translateY }],
      }}>
        <Text style={{ color: theme.colors.text, fontSize: 18, marginBottom: theme.spacing.md }}>Sort by</Text>
        {OPTIONS.map((o) => {
          const active = o.key === selected;
          return (
            <Pressable
              key={o.key}
              onPress={() => { onSelect(o.key); onClose(); }}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: theme.spacing.md }}
            >
              <Text style={{ color: active ? theme.colors.primary : theme.colors.text, fontSize: 16 }}>{o.label}</Text>
              {active && <MaterialCommunityIcons name="check" size={20} color={theme.colors.primary} />}
            </Pressable>
          );
        })}
      </Animated.View>
    </Modal>
  );
}

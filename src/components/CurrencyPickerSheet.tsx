import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { CURRENCY_CODES, codeToSymbol, type CurrencyCode } from '../lib/currency';
import { theme } from '../theme';

const SLIDE_DISTANCE = 600;
const FADE_DURATION = 200;
const SLIDE_DURATION = 260;

export function CurrencyPickerSheet({
  visible,
  onClose,
  onSelect,
  current,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (code: CurrencyCode) => void;
  current: CurrencyCode;
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
        <Text style={{ color: theme.colors.text, fontSize: 18, marginBottom: theme.spacing.md }}>
          Choose currency
        </Text>
        {CURRENCY_CODES.map(code => {
          const isSelected = code === current;
          return (
            <Pressable
              key={code}
              onPress={() => { onSelect(code); onClose(); }}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
                padding: theme.spacing.md, borderRadius: theme.radius.md,
                backgroundColor: isSelected ? theme.colors.primary : 'transparent',
              }}
            >
              <Text style={{ color: isSelected ? '#fff' : theme.colors.text, fontSize: 24, width: 32, textAlign: 'center' }}>
                {codeToSymbol(code)}
              </Text>
              <Text style={{ color: isSelected ? '#fff' : theme.colors.text, fontSize: 16 }}>
                {code}
              </Text>
            </Pressable>
          );
        })}
      </Animated.View>
    </Modal>
  );
}

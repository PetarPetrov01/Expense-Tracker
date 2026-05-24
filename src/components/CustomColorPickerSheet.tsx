import { useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ColorPickerLib, { Panel3, BrightnessSlider, InputWidget } from 'reanimated-color-picker';
import { theme } from '../theme';

export function CustomColorPickerSheet({
  visible, initial, onClose, onConfirm,
}: {
  visible: boolean;
  initial: string;
  onClose: () => void;
  onConfirm: (hex: string) => void;
}) {
  const [hex, setHex] = useState(initial);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
      <Pressable onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)' }]} />
      <View style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        backgroundColor: theme.colors.surface,
        padding: theme.spacing.lg,
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        gap: theme.spacing.lg,
      }}>
        <Text style={{ color: theme.colors.text, fontSize: 18 }}>Pick a color</Text>

        <ColorPickerLib
          value={initial}
          onCompleteJS={({ hex }) => setHex(hex)}
          style={{ gap: theme.spacing.md }}
        >
          <Panel3 style={{ width: '100%' }} />
          <BrightnessSlider style={{ borderRadius: theme.radius.pill }} />
          <InputWidget defaultFormat="HEX" inputStyle={{ color: theme.colors.text, backgroundColor: theme.colors.surface2, borderRadius: theme.radius.md, paddingVertical: theme.spacing.sm }} />
        </ColorPickerLib>

        <View style={{ flexDirection: 'row', gap: theme.spacing.lg, justifyContent: 'flex-end' }}>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={{ color: theme.colors.textMuted, fontSize: 16 }}>Cancel</Text>
          </Pressable>
          <Pressable onPress={() => { onConfirm(hex); onClose(); }} hitSlop={8}>
            <Text style={{ color: theme.colors.primary, fontSize: 16, fontWeight: '600' }}>Use</Text>
          </Pressable>
        </View>
      </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

import { Modal, View, Text, Pressable } from 'react-native';
import { CURRENCY_CODES, codeToSymbol, type CurrencyCode } from '../lib/currency';
import { theme } from '../theme';

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
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} />
      <View style={{
        backgroundColor: theme.colors.surface, padding: theme.spacing.lg,
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
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
      </View>
    </Modal>
  );
}

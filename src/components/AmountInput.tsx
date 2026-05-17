import { TextInput, View, Text } from 'react-native';
import { theme } from '../theme';
import { useSettings } from '../stores/settings';

export function AmountInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const currency = useSettings(s => s.currency);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface,
      paddingHorizontal: theme.spacing.md, borderRadius: theme.radius.md }}>
      <Text style={{ color: theme.colors.textMuted, fontSize: 28, marginRight: 8 }}>{currency}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="0.00"
        placeholderTextColor={theme.colors.textMuted}
        keyboardType="decimal-pad"
        style={{ flex: 1, color: theme.colors.text, fontSize: 32, paddingVertical: 16 }}
      />
    </View>
  );
}

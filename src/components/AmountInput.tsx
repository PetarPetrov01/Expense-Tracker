import { useEffect, useRef, useState } from 'react';
import { TextInput, View, Text } from 'react-native';
import { theme } from '../theme';
import { useSettings } from '../stores/settings';
import { clampWhileTyping, padOnBlur } from '../lib/amountInput';

// `value` is the canonical string the parent owns (post-pad form, e.g. "5.90").
// Internally we keep a more permissive "draft" string so the user can transiently
// have values like "5.", "5.9" while typing. We only emit cleaned values to the parent.
export function AmountInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  // Display the parent's value; internal draft tracks the user's in-progress text.
  const [draft, setDraft] = useState(value);
  const lastParentValue = useRef(value);
  // Currency symbol comes from displayCurrency once Phase 5 lands.
  // For Phase 1 the existing settings shape is still { currency: CurrencySymbol }.
  const currency = useSettings(s => s.displayCurrency);

  // If the parent supplies a new value (mount / route reload), normalize once.
  useEffect(() => {
    if (value !== lastParentValue.current) {
      lastParentValue.current = value;
      const normalized = padOnBlur(clampWhileTyping('', value));
      setDraft(normalized);
    }
  }, [value]);

  function handleChangeText(next: string) {
    const accepted = clampWhileTyping(draft, next);
    setDraft(accepted);
    onChange(accepted);
  }

  function handleBlur() {
    const padded = padOnBlur(draft);
    setDraft(padded);
    onChange(padded);
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface,
      paddingHorizontal: theme.spacing.md, borderRadius: theme.radius.md }}>
      <Text style={{ color: theme.colors.textMuted, fontSize: 28, marginRight: 8 }}>{currency}</Text>
      <TextInput
        value={draft}
        onChangeText={handleChangeText}
        onBlur={handleBlur}
        placeholder="0.00"
        placeholderTextColor={theme.colors.textMuted}
        keyboardType="decimal-pad"
        style={{ flex: 1, color: theme.colors.text, fontSize: 32, paddingVertical: 16 }}
      />
    </View>
  );
}

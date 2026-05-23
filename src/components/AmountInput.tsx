import { useEffect, useRef, useState } from 'react';
import { TextInput, View, Text, Pressable } from 'react-native';
import { theme } from '../theme';
import { clampWhileTyping, padOnBlur } from '../lib/amountInput';
import { CurrencyPickerSheet } from './CurrencyPickerSheet';
import { codeToSymbol, type CurrencyCode } from '../lib/currency';

// Controlled component. Parent owns both the amount string and the entry currency.
// On a new expense, parent should initialize `currency = displayCurrency`.
// On an edit, parent should initialize `currency = expense.currency`.
export function AmountInput({
  value,
  onChange,
  currency,
  onCurrencyChange,
}: {
  value: string;
  onChange: (v: string) => void;
  currency: CurrencyCode;
  onCurrencyChange: (c: CurrencyCode) => void;
}) {
  const [draft, setDraft] = useState(value);
  const lastParentValue = useRef(value);
  const [pickerOpen, setPickerOpen] = useState(false);

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
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: theme.colors.surface,
      paddingHorizontal: theme.spacing.md, borderRadius: theme.radius.md,
    }}>
      <Pressable onPress={() => setPickerOpen(true)} hitSlop={8} style={{ marginRight: 8 }}>
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 4,
          paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.radius.pill,
          backgroundColor: theme.colors.bg,
        }}>
          <Text style={{ color: theme.colors.text, fontSize: 18 }}>{codeToSymbol(currency)}</Text>
          <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>{currency}</Text>
        </View>
      </Pressable>
      <TextInput
        value={draft}
        onChangeText={handleChangeText}
        onBlur={handleBlur}
        placeholder="0.00"
        placeholderTextColor={theme.colors.textMuted}
        keyboardType="decimal-pad"
        style={{ flex: 1, color: theme.colors.text, fontSize: 32, paddingVertical: 16 }}
      />
      <CurrencyPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={onCurrencyChange}
        current={currency}
      />
    </View>
  );
}

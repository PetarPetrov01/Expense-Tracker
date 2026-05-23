import { useEffect, useState } from 'react';
import { View, Text, Pressable, Alert, ScrollView, TextInput } from 'react-native';
import { router } from 'expo-router';
import { AmountInput } from '../../src/components/AmountInput';
import { DateField } from '../../src/components/DateField';
import { CategoryIcon } from '../../src/components/CategoryIcon';
import { CategoryPickerSheet } from '../../src/components/CategoryPickerSheet';
import { parseAmountToCents } from '../../src/lib/currency';
import { createExpense } from '../../src/repositories/expenses';
import { getCategory } from '../../src/repositories/categories';
import type { Category } from '../../src/db/schema';
import { useSettings } from '../../src/stores/settings';
import { useFxRates } from '../../src/stores/fxRates';
import { deriveRateToBaseX1e6 } from '../../src/lib/fx';
import type { CurrencyCode } from '../../src/lib/currency';
import { theme } from '../../src/theme';

export default function NewExpense() {
  const displayCurrency = useSettings(s => s.displayCurrency);
  const [amount, setAmount] = useState('');
  const [entryCurrency, setEntryCurrency] = useState<CurrencyCode>(displayCurrency);
  const [category, setCategory] = useState<Category | null>(null);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date());
  const [pickerOpen, setPickerOpen] = useState(false);

  const lastUsedCategoryId = useSettings(s => s.lastUsedCategoryId);
  const setLastUsedCategoryId = useSettings(s => s.setLastUsedCategoryId);
  const rates = useFxRates(s => s.rates);

  useEffect(() => {
    if (!lastUsedCategoryId || category) return;
    (async () => {
      const row = await getCategory(lastUsedCategoryId);
      if (row) setCategory(row);
    })();
  }, [lastUsedCategoryId, category]);

  async function save() {
    const cents = parseAmountToCents(amount);
    if (cents === null || cents <= 0) return Alert.alert('Invalid amount');
    if (!category) return Alert.alert('Pick a category');
    const rateToBaseX1e6 = deriveRateToBaseX1e6(rates, entryCurrency);
    await createExpense({
      amountCents: cents,
      currency: entryCurrency,
      rateToBaseX1e6,
      categoryId: category.id,
      note: note || null,
      occurredAt: date,
    });
    setLastUsedCategoryId(category.id);
    router.back();
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.bg }} contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
      <AmountInput
        value={amount}
        onChange={setAmount}
        currency={entryCurrency}
        onCurrencyChange={setEntryCurrency}
      />

      <Pressable onPress={() => setPickerOpen(true)} style={{
        backgroundColor: theme.colors.surface, padding: theme.spacing.md, borderRadius: theme.radius.md,
        flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
      }}>
        {category
          ? <><CategoryIcon icon={category.icon} color={category.color} size={32} /><Text style={{ color: theme.colors.text, fontSize: 16 }}>{category.name}</Text></>
          : <Text style={{ color: theme.colors.textMuted, fontSize: 16 }}>Choose category</Text>}
      </Pressable>

      <DateField value={date} onChange={setDate} />

      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Note (optional)"
        placeholderTextColor={theme.colors.textMuted}
        style={{ backgroundColor: theme.colors.surface, padding: theme.spacing.md, borderRadius: theme.radius.md, color: theme.colors.text }}
      />

      <Pressable onPress={save} style={{ backgroundColor: theme.colors.primary, padding: theme.spacing.md, borderRadius: theme.radius.md, alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Save expense</Text>
      </Pressable>

      <CategoryPickerSheet visible={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={setCategory} />
    </ScrollView>
  );
}

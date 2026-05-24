import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, Text, TextInput, Pressable } from 'react-native';
import { router } from 'expo-router';
import { AmountInput } from '../../src/components/AmountInput';
import { DateField } from '../../src/components/DateField';
import { CategoryQuickGrid } from '../../src/components/CategoryQuickGrid';
import { CategoryPickerSheet } from '../../src/components/CategoryPickerSheet';
import { parseAmountToCents } from '../../src/lib/currency';
import { createExpense } from '../../src/repositories/expenses';
import { getCategory, listTopCategoriesByUsage } from '../../src/repositories/categories';
import { promoteSelectedToGrid } from '../../src/lib/categoryGrid';
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
  const [topCategories, setTopCategories] = useState<Category[]>([]);

  const lastUsedCategoryId = useSettings(s => s.lastUsedCategoryId);
  const setLastUsedCategoryId = useSettings(s => s.setLastUsedCategoryId);
  const rates = useFxRates(s => s.rates);

  useEffect(() => {
    listTopCategoriesByUsage({ sinceDays: 90, limit: 7 }).then(setTopCategories);
  }, []);

  useEffect(() => {
    if (!lastUsedCategoryId || category) return;
    (async () => {
      const row = await getCategory(lastUsedCategoryId);
      if (row) setCategory(row);
    })();
  }, [lastUsedCategoryId, category]);

  const gridCategories = useMemo(
    () => promoteSelectedToGrid(topCategories, category),
    [topCategories, category],
  );

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

      <CategoryQuickGrid
        categories={gridCategories}
        selectedId={category?.id ?? null}
        onSelect={setCategory}
        onMore={() => setPickerOpen(true)}
      />

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

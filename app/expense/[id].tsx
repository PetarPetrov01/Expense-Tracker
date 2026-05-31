import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, Text, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { AmountInput } from '../../src/components/AmountInput';
import { DateField } from '../../src/components/DateField';
import { CategoryQuickGrid } from '../../src/components/CategoryQuickGrid';
import { CategoryPickerSheet } from '../../src/components/CategoryPickerSheet';
import { TagPicker } from '../../src/components/TagPicker';
import { parseAmountToCents } from '../../src/lib/currency';
import { listExpenses, updateExpense, deleteExpense } from '../../src/repositories/expenses';
import { getCategory, listTopCategoriesByUsage } from '../../src/repositories/categories';
import { promoteSelectedToGrid } from '../../src/lib/categoryGrid';
import { useFxRates } from '../../src/stores/fxRates';
import { useSettings } from '../../src/stores/settings';
import { deriveRateToBaseX1e6 } from '../../src/lib/fx';
import type { Category } from '../../src/db/schema';
import type { CurrencyCode } from '../../src/lib/currency';
import { isCurrencyCode } from '../../src/lib/currency';
import { theme } from '../../src/theme';

export default function EditExpense() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const expenseId = Number(id);
  const displayCurrency = useSettings(s => s.displayCurrency);
  const [amount, setAmount] = useState('');
  const [entryCurrency, setEntryCurrency] = useState<CurrencyCode>(displayCurrency);
  const [category, setCategory] = useState<Category | null>(null);
  const [note, setNote] = useState('');
  const [tagId, setTagId] = useState<number | null>(null);
  const [date, setDate] = useState(new Date());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [topCategories, setTopCategories] = useState<Category[]>([]);
  const rates = useFxRates(s => s.rates);

  useEffect(() => {
    listTopCategoriesByUsage({ sinceDays: 90, limit: 7 }).then(setTopCategories);
  }, []);

  useEffect(() => {
    (async () => {
      const rows = await listExpenses({ limit: 1000 });
      const found = rows.find(r => r.id === expenseId);
      if (!found) return router.back();
      setAmount((found.amountCents / 100).toFixed(2));
      setNote(found.note ?? '');
      setTagId(found.tagId ?? null);
      setDate(new Date(found.occurredAt));
      // currency column is NOT NULL — guard for hand-edited DBs only.
      setEntryCurrency(isCurrencyCode(found.currency) ? found.currency : 'EUR');
      const cat = await getCategory(found.categoryId);
      if (cat) setCategory(cat);
    })();
  }, [expenseId]);

  const gridCategories = useMemo(
    () => promoteSelectedToGrid(topCategories, category),
    [topCategories, category],
  );

  async function save() {
    const cents = parseAmountToCents(amount);
    if (cents === null || cents <= 0) return Alert.alert('Invalid amount');
    if (!category) return Alert.alert('Pick a category');
    // Spec §1.5: ALWAYS re-snapshot rate on edit-save, regardless of which fields changed.
    const rateToBaseX1e6 = deriveRateToBaseX1e6(rates, entryCurrency);
    await updateExpense(expenseId, {
      amountCents: cents,
      currency: entryCurrency,
      rateToBaseX1e6,
      categoryId: category.id,
      note: note || null,
      tagId,
      occurredAt: date,
    });
    router.back();
  }

  function confirmDelete() {
    Alert.alert('Delete expense?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteExpense(expenseId); router.back(); } },
    ]);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: theme.spacing.xl * 2 }}
      keyboardShouldPersistTaps="handled"
    >
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

      <TagPicker selectedTagId={tagId} onChange={setTagId} />

      <Pressable onPress={save} style={{ backgroundColor: theme.colors.primary, padding: theme.spacing.md, borderRadius: theme.radius.md, alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Save changes</Text>
      </Pressable>

      <Pressable onPress={confirmDelete} style={{ padding: theme.spacing.md, alignItems: 'center' }}>
        <Text style={{ color: theme.colors.danger, fontSize: 16 }}>Delete</Text>
      </Pressable>

      <CategoryPickerSheet visible={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={setCategory} />
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

import { useEffect, useState } from 'react';
import { View, Text, Pressable, Alert, ScrollView, TextInput } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { AmountInput } from '../../src/components/AmountInput';
import { DateField } from '../../src/components/DateField';
import { CategoryIcon } from '../../src/components/CategoryIcon';
import { CategoryPickerSheet } from '../../src/components/CategoryPickerSheet';
import { parseAmountToCents } from '../../src/lib/currency';
import { listExpenses, updateExpense, deleteExpense } from '../../src/repositories/expenses';
import { getCategory } from '../../src/repositories/categories';
import type { Category } from '../../src/db/schema';
import { theme } from '../../src/theme';

export default function EditExpense() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const expenseId = Number(id);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date());
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const rows = await listExpenses({ limit: 1000 });
      const found = rows.find(r => r.id === expenseId);
      if (!found) return router.back();
      setAmount((found.amountCents / 100).toFixed(2));
      setNote(found.note ?? '');
      setDate(new Date(found.occurredAt));
      const cat = await getCategory(found.categoryId);
      if (cat) setCategory(cat);
    })();
  }, [expenseId]);

  async function save() {
    const cents = parseAmountToCents(amount);
    if (cents === null || cents <= 0) return Alert.alert('Invalid amount');
    if (!category) return Alert.alert('Pick a category');
    await updateExpense(expenseId, { amountCents: cents, categoryId: category.id, note: note || null, occurredAt: date });
    router.back();
  }

  function confirmDelete() {
    Alert.alert('Delete expense?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteExpense(expenseId); router.back(); } },
    ]);
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.bg }} contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
      <AmountInput value={amount} onChange={setAmount} />

      <Pressable onPress={() => setPickerOpen(true)} style={{
        backgroundColor: theme.colors.surface, padding: theme.spacing.md, borderRadius: theme.radius.md,
        flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
      }}>
        {category
          ? <><CategoryIcon icon={category.icon} color={category.color} size={32} /><Text style={{ color: theme.colors.text, fontSize: 16 }}>{category.name}</Text></>
          : <Text style={{ color: theme.colors.textMuted }}>Choose category</Text>}
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
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Save changes</Text>
      </Pressable>

      <Pressable onPress={confirmDelete} style={{ padding: theme.spacing.md, alignItems: 'center' }}>
        <Text style={{ color: theme.colors.danger, fontSize: 16 }}>Delete</Text>
      </Pressable>

      <CategoryPickerSheet visible={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={setCategory} />
    </ScrollView>
  );
}

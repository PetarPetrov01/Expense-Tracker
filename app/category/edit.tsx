import { useEffect, useState } from 'react';
import { ScrollView, View, Text, TextInput, Pressable, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CategoryIcon } from '../../src/components/CategoryIcon';
import { ColorPicker } from '../../src/components/ColorPicker';
import { IconPicker } from '../../src/components/IconPicker';
import { createCategory, updateCategory, getCategory, deleteCategory } from '../../src/repositories/categories';
import { theme } from '../../src/theme';

export default function CategoryEdit() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = id != null;
  const [name, setName] = useState('');
  const [color, setColor] = useState('#10b981');
  const [icon, setIcon] = useState('cart');
  const [isSeed, setIsSeed] = useState(false);

  useEffect(() => {
    if (!editing) return;
    getCategory(Number(id)).then(c => {
      if (!c) return router.back();
      setName(c.name); setColor(c.color); setIcon(c.icon); setIsSeed(c.isSeed);
    });
  }, [id]);

  async function save() {
    if (!name.trim()) return Alert.alert('Name is required');
    if (editing) await updateCategory(Number(id), { name: name.trim(), color, icon });
    else await createCategory({ name: name.trim(), color, icon });
    router.back();
  }

  function confirmDelete() {
    Alert.alert(`Delete "${name}"?`, 'Expenses in this category will be orphaned.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteCategory(Number(id));
        router.back();
      } },
    ]);
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.bg }} contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
      <View style={{ alignItems: 'center' }}>
        <CategoryIcon icon={icon} color={color} size={72} />
      </View>

      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Category name"
        placeholderTextColor={theme.colors.textMuted}
        style={{ backgroundColor: theme.colors.surface, padding: theme.spacing.md, borderRadius: theme.radius.md, color: theme.colors.text, fontSize: 16 }}
      />

      <Text style={{ color: theme.colors.textMuted }}>Color</Text>
      <ColorPicker value={color} onChange={setColor} />

      <Text style={{ color: theme.colors.textMuted }}>Icon</Text>
      <IconPicker value={icon} color={color} onChange={setIcon} />

      <Pressable onPress={save} style={{ backgroundColor: theme.colors.primary, padding: theme.spacing.md, borderRadius: theme.radius.md, alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>{editing ? 'Save changes' : 'Create category'}</Text>
      </Pressable>

      {editing && !isSeed && (
        <Pressable onPress={confirmDelete} style={{ padding: theme.spacing.md, alignItems: 'center' }}>
          <Text style={{ color: theme.colors.danger, fontSize: 16 }}>Delete category</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

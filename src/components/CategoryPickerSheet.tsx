import { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, FlatList } from 'react-native';
import { router } from 'expo-router';
import { listCategories } from '../repositories/categories';
import type { Category } from '../db/schema';
import { CategoryIcon } from './CategoryIcon';
import { theme } from '../theme';

export function CategoryPickerSheet({ visible, onClose, onSelect }: {
  visible: boolean; onClose: () => void; onSelect: (c: Category) => void;
}) {
  const [items, setItems] = useState<Category[]>([]);
  useEffect(() => { if (visible) listCategories().then(setItems); }, [visible]);

  function openManage() {
    onClose();
    router.push('/category');
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} />
      <View style={{ backgroundColor: theme.colors.surface, padding: theme.spacing.lg, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '70%' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md }}>
          <Text style={{ color: theme.colors.text, fontSize: 18 }}>Choose category</Text>
          <Pressable onPress={openManage} hitSlop={8}>
            <Text style={{ color: theme.colors.primary, fontSize: 14 }}>Manage</Text>
          </Pressable>
        </View>
        <FlatList
          data={items}
          numColumns={4}
          keyExtractor={(c) => String(c.id)}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => { onSelect(item); onClose(); }}
              style={{ flex: 1, alignItems: 'center', padding: theme.spacing.sm }}
            >
              <CategoryIcon icon={item.icon} color={item.color} />
              <Text style={{ color: theme.colors.text, marginTop: 4, fontSize: 12, textAlign: 'center' }} numberOfLines={1}>{item.name}</Text>
            </Pressable>
          )}
        />
      </View>
    </Modal>
  );
}

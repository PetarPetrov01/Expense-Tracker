import { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { Link, useFocusEffect, router } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { listCategories } from '../../src/repositories/categories';
import { CategoryIcon } from '../../src/components/CategoryIcon';
import type { Category } from '../../src/db/schema';
import { theme } from '../../src/theme';

export default function Categories() {
  const [items, setItems] = useState<Category[]>([]);
  useFocusEffect(useCallback(() => { listCategories().then(setItems); }, []));

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <FlatList
        data={items}
        keyExtractor={(c) => String(c.id)}
        contentContainerStyle={{ padding: theme.spacing.lg }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/category/edit', params: { id: String(item.id) } })}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
              padding: theme.spacing.md, backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.md, marginBottom: theme.spacing.sm,
            }}>
            <CategoryIcon icon={item.icon} color={item.color} size={36} />
            <Text style={{ flex: 1, color: theme.colors.text, fontSize: 16 }}>{item.name}</Text>
            {item.isSeed && <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>seed</Text>}
          </Pressable>
        )}
      />

      <Link href="/category/edit" asChild>
        <Pressable style={{
          position: 'absolute', right: 24, bottom: 24,
          width: 60, height: 60, borderRadius: 30,
          backgroundColor: theme.colors.primary,
          justifyContent: 'center', alignItems: 'center', elevation: 4,
        }}>
          <MaterialCommunityIcons name="plus" size={32} color="#fff" />
        </Pressable>
      </Link>
    </View>
  );
}

import { View, Text, Pressable } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { CategoryIcon } from './CategoryIcon';
import type { Category } from '../db/schema';
import { theme } from '../theme';

export function CategoryQuickGrid({
  categories,
  selectedId,
  onSelect,
  onMore,
}: {
  categories: Category[];
  selectedId: number | null;
  onSelect: (c: Category) => void;
  onMore: () => void;
}) {
  const visible = categories.slice(0, 7);

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {visible.map((c) => {
        const selected = c.id === selectedId;
        return (
          <View key={c.id} style={{ width: '25%', padding: theme.spacing.xs }}>
            <Pressable onPress={() => onSelect(c)} style={tileStyle(selected)}>
              <CategoryIcon icon={c.icon} color={c.color} size={52} />
              <Text style={tileLabel} numberOfLines={1}>{c.name}</Text>
            </Pressable>
          </View>
        );
      })}

      <View key="__more" style={{ width: '25%', padding: theme.spacing.xs }}>
        <Pressable onPress={onMore} style={tileStyle(false)}>
          <View style={{
            width: 52, height: 52, borderRadius: 26,
            backgroundColor: theme.colors.surface2,
            justifyContent: 'center', alignItems: 'center',
          }}>
            <MaterialCommunityIcons name="dots-horizontal" size={28} color={theme.colors.text} />
          </View>
          <Text style={tileLabel} numberOfLines={1}>More</Text>
        </Pressable>
      </View>
    </View>
  );
}

function tileStyle(selected: boolean) {
  return {
    alignItems: 'center' as const,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: selected ? theme.colors.primary : 'transparent',
    backgroundColor: selected ? theme.colors.surface : 'transparent',
  };
}

const tileLabel = {
  color: theme.colors.text,
  marginTop: 6,
  fontSize: 13,
  textAlign: 'center' as const,
};

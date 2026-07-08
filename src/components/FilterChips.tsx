import { View, Text, Pressable } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { theme } from '../theme';

export function FilterChips({
  categoryLabel, tagLabel, sortLabel,
  onCategoryPress, onTagPress, onSortPress,
  onClearCategory, onClearTag,
}: {
  categoryLabel: string | null;
  tagLabel: string | null;
  sortLabel: string;
  onCategoryPress: () => void;
  onTagPress: () => void;
  onSortPress: () => void;
  onClearCategory: () => void;
  onClearTag: () => void;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
      <Chip
        icon="shape-outline"
        label={categoryLabel ?? 'Category'}
        active={categoryLabel != null}
        onPress={onCategoryPress}
        onClear={categoryLabel != null ? onClearCategory : undefined}
      />
      <Chip
        icon="tag-outline"
        label={tagLabel ?? 'Tag'}
        active={tagLabel != null}
        onPress={onTagPress}
        onClear={tagLabel != null ? onClearTag : undefined}
      />
      <Chip icon="sort" label={sortLabel} active onPress={onSortPress} />
    </View>
  );
}

function Chip({ icon, label, active, onPress, onClear }: {
  icon: string; label: string; active: boolean; onPress: () => void; onClear?: () => void;
}) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.pill, borderWidth: 1.5,
      borderColor: active ? theme.colors.primary : theme.colors.border,
      backgroundColor: active ? theme.colors.primary : theme.colors.surface,
    }}>
      <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <MaterialCommunityIcons name={icon as any} size={16} color={active ? '#fff' : theme.colors.text} />
        <Text style={{ color: active ? '#fff' : theme.colors.text, fontSize: 13 }}>{label}</Text>
      </Pressable>
      {onClear && (
        <Pressable onPress={onClear} hitSlop={8} style={{ marginLeft: 6 }}>
          <MaterialCommunityIcons name="close" size={14} color="#fff" />
        </Pressable>
      )}
    </View>
  );
}

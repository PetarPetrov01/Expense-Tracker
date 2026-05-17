import { FlatList, Pressable } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { PICKABLE_ICONS } from '../lib/icons';
import { theme } from '../theme';

export function IconPicker({ value, color, onChange }: { value: string; color: string; onChange: (icon: string) => void }) {
  return (
    <FlatList
      data={PICKABLE_ICONS as readonly string[]}
      numColumns={6}
      keyExtractor={(i) => i}
      scrollEnabled={false}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => onChange(item)}
          style={{
            flex: 1, aspectRatio: 1, justifyContent: 'center', alignItems: 'center',
            margin: 4, borderRadius: theme.radius.md,
            backgroundColor: value === item ? color : theme.colors.surface2,
          }}>
          <MaterialCommunityIcons name={item as any} size={26} color="#fff" />
        </Pressable>
      )}
    />
  );
}

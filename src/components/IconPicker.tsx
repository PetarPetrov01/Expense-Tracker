import { View, Pressable } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { PICKABLE_ICONS } from '../lib/icons';
import { contrastFg } from '../lib/contrast';
import { theme } from '../theme';

export function IconPicker({ value, color, onChange }: { value: string; color: string; onChange: (icon: string) => void }) {
  const selectedFg = contrastFg(color);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {PICKABLE_ICONS.map(item => {
        const selected = value === item;
        return (
          <View key={item} style={{ width: '16.666%', padding: 3 }}>
            <Pressable
              onPress={() => onChange(item)}
              style={{
                aspectRatio: 1,
                justifyContent: 'center', alignItems: 'center',
                borderRadius: theme.radius.md,
                backgroundColor: selected ? color : theme.colors.surface2,
              }}>
              <MaterialCommunityIcons name={item as any} size={26} color={selected ? selectedFg : '#fff'} />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

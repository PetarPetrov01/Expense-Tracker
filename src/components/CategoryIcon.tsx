import { View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

export function CategoryIcon({ icon, color, size = 40 }: { icon: string; color: string; size?: number }) {
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: color, justifyContent: 'center', alignItems: 'center',
    }}>
      <MaterialCommunityIcons name={icon as any} size={size * 0.55} color="#fff" />
    </View>
  );
}

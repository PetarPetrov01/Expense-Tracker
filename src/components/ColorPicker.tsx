import { View, Pressable } from 'react-native';
import { theme } from '../theme';

const SWATCHES = ['#10b981','#3b82f6','#8b5cf6','#ec4899','#ef4444','#f59e0b','#eab308','#14b8a6','#06b6d4','#6b7280'];

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
      {SWATCHES.map(c => (
        <Pressable key={c} onPress={() => onChange(c)} style={{
          width: 36, height: 36, borderRadius: 18, backgroundColor: c,
          borderWidth: value === c ? 3 : 0, borderColor: theme.colors.text,
        }} />
      ))}
    </View>
  );
}

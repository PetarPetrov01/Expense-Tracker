import { View } from 'react-native';
import { theme } from '../theme';

export function Sparkline({
  values, width = 60, height = 20, color = theme.colors.primary,
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  const max = Math.max(1, ...values);
  return (
    <View style={{ width, height, flexDirection: 'row', alignItems: 'flex-end', gap: 1 }}>
      {values.map((v, i) => {
        const h = Math.max(2, (v / max) * height);
        return (
          <View
            key={i}
            style={{
              flex: 1,
              height: h,
              backgroundColor: color,
              borderTopLeftRadius: 1,
              borderTopRightRadius: 1,
              opacity: v === 0 ? 0.25 : 1,
            }}
          />
        );
      })}
    </View>
  );
}

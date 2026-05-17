import { View, Text } from 'react-native';
import { theme } from '../../src/theme';
export default function Stats() {
  return <View style={{ flex: 1, backgroundColor: theme.colors.bg, padding: theme.spacing.lg }}>
    <Text style={{ color: theme.colors.text }}>Stats (placeholder)</Text>
  </View>;
}

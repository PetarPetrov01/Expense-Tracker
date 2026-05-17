import { View, Text } from 'react-native';
import { theme } from '../../src/theme';
export default function Settings() {
  return <View style={{ flex: 1, backgroundColor: theme.colors.bg, padding: theme.spacing.lg }}>
    <Text style={{ color: theme.colors.text }}>Settings (placeholder)</Text>
  </View>;
}

import { View, Text } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { theme } from '../theme';

export function EmptyState({ icon = 'inbox', title, hint }: { icon?: string; title: string; hint?: string }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: theme.spacing.xl }}>
      <MaterialCommunityIcons name={icon as any} size={64} color={theme.colors.textMuted} />
      <Text style={{ color: theme.colors.text, fontSize: 18, marginTop: theme.spacing.md }}>{title}</Text>
      {hint && <Text style={{ color: theme.colors.textMuted, marginTop: 4, textAlign: 'center' }}>{hint}</Text>}
    </View>
  );
}

import { View, Text, Pressable } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { theme } from '../theme';

export function EmptyState({
  icon = 'inbox',
  title,
  hint,
  action,
}: {
  icon?: string;
  title: string;
  hint?: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: theme.spacing.xl }}>
      <MaterialCommunityIcons name={icon as any} size={64} color={theme.colors.textMuted} />
      <Text style={{ color: theme.colors.text, fontSize: 18, marginTop: theme.spacing.md }}>{title}</Text>
      {hint && <Text style={{ color: theme.colors.textMuted, marginTop: 4, textAlign: 'center' }}>{hint}</Text>}
      {action && (
        <Pressable
          onPress={action.onPress}
          style={{
            marginTop: theme.spacing.lg,
            paddingVertical: theme.spacing.sm,
            paddingHorizontal: theme.spacing.lg,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.colors.primary,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

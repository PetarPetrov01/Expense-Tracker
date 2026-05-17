import { View, Text, Pressable } from 'react-native';
import { Link } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSettings } from '../../src/stores/settings';
import type { CurrencySymbol } from '../../src/lib/currency';
import { theme } from '../../src/theme';

const SYMBOLS: CurrencySymbol[] = ['€', '$', '£', 'лв'];

export default function Settings() {
  const { currency, setCurrency } = useSettings();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg, padding: theme.spacing.lg, gap: theme.spacing.lg }}>
      <View>
        <Text style={{ color: theme.colors.textMuted, marginBottom: theme.spacing.sm }}>Currency</Text>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          {SYMBOLS.map(s => (
            <Pressable key={s} onPress={() => setCurrency(s)} style={{
              flex: 1, padding: theme.spacing.md, borderRadius: theme.radius.md, alignItems: 'center',
              backgroundColor: currency === s ? theme.colors.primary : theme.colors.surface,
            }}>
              <Text style={{ color: '#fff', fontSize: 18 }}>{s}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Link href="/category" asChild>
        <Pressable style={{
          flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
          padding: theme.spacing.md, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md,
        }}>
          <MaterialCommunityIcons name="shape" size={24} color={theme.colors.text} />
          <Text style={{ flex: 1, color: theme.colors.text, fontSize: 16 }}>Manage categories</Text>
          <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.textMuted} />
        </Pressable>
      </Link>
    </View>
  );
}

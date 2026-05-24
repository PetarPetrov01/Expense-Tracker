import { useMemo } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Link } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSettings } from '../../src/stores/settings';
import { useFxRates } from '../../src/stores/fxRates';
import { CURRENCY_CODES, codeToSymbol, type CurrencyCode } from '../../src/lib/currency';
import { theme } from '../../src/theme';

export default function Settings() {
  const displayCurrency = useSettings(s => s.displayCurrency);
  const setDisplayCurrency = useSettings(s => s.setDisplayCurrency);
  const weekStart = useSettings(s => s.weekStart);
  const setWeekStart = useSettings(s => s.setWeekStart);
  const fxLastFetchedAt = useFxRates(s => s.fxLastFetchedAt);
  const refreshing = useFxRates(s => s.refreshing);
  const refreshNow = useFxRates(s => s.refreshNow);
  const refreshError = useFxRates(s => s.refreshError);

  const lastFetchLabel = useMemo(() => {
    if (!fxLastFetchedAt) return 'never';
    return `${formatDistanceToNow(new Date(fxLastFetchedAt))} ago`;
  }, [fxLastFetchedAt]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg, padding: theme.spacing.lg, gap: theme.spacing.lg }}>
      <View>
        <Text style={{ color: theme.colors.textMuted, marginBottom: theme.spacing.sm }}>Display currency</Text>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          {CURRENCY_CODES.map((code: CurrencyCode) => (
            <Pressable
              key={code}
              onPress={() => setDisplayCurrency(code)}
              style={{
                flex: 1, padding: theme.spacing.md, borderRadius: theme.radius.md, alignItems: 'center',
                backgroundColor: displayCurrency === code ? theme.colors.primary : theme.colors.surface,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 16 }}>{codeToSymbol(code)} {code}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View>
        <Text style={{ color: theme.colors.textMuted, marginBottom: theme.spacing.sm }}>Week starts on</Text>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          {(['mon', 'sun'] as const).map(w => (
            <Pressable
              key={w}
              onPress={() => setWeekStart(w)}
              style={{
                flex: 1, padding: theme.spacing.md, borderRadius: theme.radius.md, alignItems: 'center',
                backgroundColor: weekStart === w ? theme.colors.primary : theme.colors.surface,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 16 }}>{w === 'mon' ? 'Monday' : 'Sunday'}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
        padding: theme.spacing.md, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md,
      }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.colors.text, fontSize: 14 }}>Last FX update: {lastFetchLabel}</Text>
          {refreshError && (
            <Text style={{ color: theme.colors.danger, fontSize: 11 }} numberOfLines={1}>
              {refreshError}
            </Text>
          )}
        </View>
        <Pressable
          onPress={refreshNow}
          disabled={refreshing}
          style={{
            paddingHorizontal: 14, paddingVertical: 8, borderRadius: theme.radius.pill,
            backgroundColor: theme.colors.primary, opacity: refreshing ? 0.6 : 1,
            flexDirection: 'row', alignItems: 'center', gap: 6,
          }}
        >
          {refreshing
            ? <ActivityIndicator size="small" color="#fff" />
            : <MaterialCommunityIcons name="refresh" size={16} color="#fff" />}
          <Text style={{ color: '#fff', fontSize: 13 }}>Refresh</Text>
        </Pressable>
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

      <Link href="/settings/data" asChild>
        <Pressable style={{
          flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
          padding: theme.spacing.md, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md,
        }}>
          <MaterialCommunityIcons name="database" size={24} color={theme.colors.text} />
          <Text style={{ flex: 1, color: theme.colors.text, fontSize: 16 }}>Data (import / export)</Text>
          <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.textMuted} />
        </Pressable>
      </Link>
    </View>
  );
}

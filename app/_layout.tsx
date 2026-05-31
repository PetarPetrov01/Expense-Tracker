import { Stack } from 'expo-router';
import { Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect, useState } from 'react';
import { useRunMigrations } from '../src/db/migrate';
import { seedIfEmpty } from '../src/db/seed';
import { useSettings } from '../src/stores/settings';
import { useFxRates } from '../src/stores/fxRates';
import { theme } from '../src/theme';

export default function RootLayout() {
  const { success, error } = useRunMigrations();
  const [seeded, setSeeded] = useState(false);
  const settingsLoaded = useSettings(s => s.loaded);
  const hydrate = useSettings(s => s.hydrate);
  const hydrateFx = useFxRates(s => s.hydrate);
  const refreshFxIfStale = useFxRates(s => s.refreshIfStale);
  const fxLoaded = useFxRates(s => s.loaded);

  useEffect(() => {
    if (success) seedIfEmpty().then(() => setSeeded(true));
  }, [success]);

  useEffect(() => {
    if (seeded) hydrate();
  }, [seeded, hydrate]);

  useEffect(() => {
    if (!seeded) return;
    hydrateFx().then(() => refreshFxIfStale());
  }, [seeded, hydrateFx, refreshFxIfStale]);

  if (error) return <View><Text>Migration error: {error.message}</Text></View>;
  if (!success || !seeded || !settingsLoaded || !fxLoaded) return <View><Text>Loading…</Text></View>;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <Stack screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: theme.colors.bg },
        headerTintColor: theme.colors.text,
        headerTitleStyle: { color: theme.colors.text },
        contentStyle: { backgroundColor: theme.colors.bg },
      }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="expense/new" options={{ presentation: 'modal', headerShown: true, title: 'New expense' }} />
        <Stack.Screen name="expense/[id]" options={{ presentation: 'modal', headerShown: true, title: 'Edit expense' }} />
        <Stack.Screen name="category/index" options={{ headerShown: true, title: 'Categories' }} />
        <Stack.Screen name="category/edit"  options={{ presentation: 'modal', headerShown: true, title: 'Edit category' }} />
        <Stack.Screen name="settings/data" options={{ headerShown: true, title: 'Data' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}

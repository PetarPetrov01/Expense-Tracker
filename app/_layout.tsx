import { Stack } from 'expo-router';
import { Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import { useRunMigrations } from '../src/db/migrate';
import { seedIfEmpty } from '../src/db/seed';
import { useSettings } from '../src/stores/settings';

export default function RootLayout() {
  const { success, error } = useRunMigrations();
  const [seeded, setSeeded] = useState(false);
  const settingsLoaded = useSettings(s => s.loaded);
  const hydrate = useSettings(s => s.hydrate);

  useEffect(() => {
    if (success) seedIfEmpty().then(() => setSeeded(true));
  }, [success]);

  useEffect(() => {
    if (seeded) hydrate();
  }, [seeded, hydrate]);

  if (error) return <View><Text>Migration error: {error.message}</Text></View>;
  if (!success || !seeded || !settingsLoaded) return <View><Text>Loading…</Text></View>;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="expense/new" options={{ presentation: 'modal', headerShown: true, title: 'New expense' }} />
      <Stack.Screen name="expense/[id]" options={{ presentation: 'modal', headerShown: true, title: 'Edit expense' }} />
      <Stack.Screen name="category/index" options={{ headerShown: true, title: 'Categories' }} />
      <Stack.Screen name="category/edit"  options={{ presentation: 'modal', headerShown: true, title: 'Edit category' }} />
      <Stack.Screen name="settings/data" options={{ headerShown: true, title: 'Data' }} />
    </Stack>
  );
}

import { Stack } from 'expo-router';
import { Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import { useRunMigrations } from '../src/db/migrate';
import { seedIfEmpty } from '../src/db/seed';

export default function RootLayout() {
  const { success, error } = useRunMigrations();
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (success) seedIfEmpty().then(() => setSeeded(true));
  }, [success]);

  if (error) return <View><Text>Migration error: {error.message}</Text></View>;
  if (!success || !seeded) return <View><Text>Loading…</Text></View>;

  return <Stack screenOptions={{ headerShown: false }} />;
}

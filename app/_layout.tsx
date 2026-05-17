import { Stack } from 'expo-router';
import { Text, View } from 'react-native';
import { useRunMigrations } from '../src/db/migrate';

export default function RootLayout() {
  const { success, error } = useRunMigrations();

  if (error) {
    return <View><Text>Migration error: {error.message}</Text></View>;
  }
  if (!success) {
    return <View><Text>Setting up database…</Text></View>;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

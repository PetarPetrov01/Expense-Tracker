import { Stack } from 'expo-router';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { useRunMigrations } from '../src/db/migrate';
import { seedIfEmpty } from '../src/db/seed';
import { useSettings } from '../src/stores/settings';
import { useFxRates } from '../src/stores/fxRates';
import { theme } from '../src/theme';

// Keep the native splash up until the DB + stores are ready, so there's no white flash.
SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ fade: true });

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

  const ready = success && seeded && settingsLoaded && fxLoaded;

  useEffect(() => {
    if (ready || error) SplashScreen.hideAsync().catch(() => {});
  }, [ready, error]);

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.bg, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xl }}>
        <Text style={{ color: theme.colors.danger, fontSize: 16, fontWeight: '600', marginBottom: theme.spacing.sm }}>
          Couldn’t start the app
        </Text>
        <Text style={{ color: theme.colors.textMuted, textAlign: 'center' }}>{error.message}</Text>
      </View>
    );
  }

  // Splash stays visible while !ready; this themed view is just a safety net (e.g. if the
  // native splash is dismissed early) so the user never sees a bare white screen.
  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.bg, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.xl }}>
        <Image
          source={require('../assets/images/splash-icon.png')}
          style={{ width: 120, height: 120 }}
          resizeMode="contain"
        />
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

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
        <Stack.Screen name="expenses/list" options={{ headerShown: true, title: 'Expenses' }} />
        <Stack.Screen name="category/index" options={{ headerShown: true, title: 'Categories' }} />
        <Stack.Screen name="category/edit"  options={{ presentation: 'modal', headerShown: true, title: 'Edit category' }} />
        <Stack.Screen name="settings/data" options={{ headerShown: true, title: 'Data' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}

import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { VaaniProvider } from './state/VaaniProvider';
import { MainScreen } from './screens/MainScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { ModelsScreen } from './screens/ModelsScreen';
import { BenchmarkScreen } from './screens/BenchmarkScreen';
import { MetricsScreen } from './screens/MetricsScreen';
import { AboutScreen } from './screens/AboutScreen';
import { theme } from './ui/theme';

type Screen = 'Main' | 'Settings' | 'Models' | 'Benchmark' | 'Metrics' | 'About';

function Router() {
  const [screen, setScreen] = useState<Screen>('Main');
  if (screen === 'Settings') return <SettingsScreen onBack={() => setScreen('Main')} />;
  if (screen === 'Models') return <ModelsScreen onBack={() => setScreen('Main')} />;
  if (screen === 'Benchmark') return <BenchmarkScreen onBack={() => setScreen('Main')} />;
  if (screen === 'Metrics') return <MetricsScreen onBack={() => setScreen('Main')} />;
  if (screen === 'About') return <AboutScreen onBack={() => setScreen('Main')} />;
  return <MainScreen open={(name) => setScreen(name as Screen)} />;
}

export default function App() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_600SemiBold });
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
        <StatusBar style="light" />
        {fontsLoaded ? (
          <VaaniProvider>
            <Router />
          </VaaniProvider>
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={theme.accent} />
          </View>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

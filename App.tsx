import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { initAds } from './src/ads';
import JourneyScreen from './src/JourneyScreen';
import MainMenuScreen from './src/MainMenuScreen';
import { loadProgress, saveProgress } from './src/progress';
import PuzzleScreen from './src/PuzzleScreen';
import StudioSplashScreen from './src/StudioSplashScreen';

// Keep the native launch splash (assets/splash-icon.png, see app.json) up
// until the studio splash below is ready to take over — otherwise there's a
// blank flash between the native splash disappearing and JS rendering.
SplashScreen.preventAutoHideAsync().catch(() => {});

type Screen = 'studioSplash' | 'menu' | 'game' | 'journey';

export default function App() {
  const [screen, setScreen] = useState<Screen>('studioSplash');
  const [furthestLevel, setFurthestLevel] = useState<number | null>(null);

  useEffect(() => {
    loadProgress().then((progress) => setFurthestLevel(progress.furthestLevel));
    // No-ops safely if the native ads module isn't available (e.g. Expo Go).
    initAds();
  }, []);

  useEffect(() => {
    // The studio splash component renders its own logo immediately, so the
    // native splash can come down the moment it's mounted.
    if (screen === 'studioSplash') SplashScreen.hideAsync().catch(() => {});
  }, [screen]);

  const handleLevelChange = useCallback((level: number) => {
    setFurthestLevel((prev) => {
      const next = Math.max(prev ?? 1, level);
      if (next !== prev) saveProgress({ furthestLevel: next });
      return next;
    });
  }, []);

  if (screen === 'studioSplash') {
    return (
      <StudioSplashScreen
        onFinish={() => {
          // Progress may still be loading — PuzzleScreen/App itself waits on
          // furthestLevel below, so it's safe to switch as soon as the
          // animation ends even if loadProgress hasn't resolved yet.
          setScreen('menu');
        }}
      />
    );
  }

  if (furthestLevel === null) return null;

  if (screen === 'menu') {
    return (
      <MainMenuScreen
        onSelectJourney={() => setScreen('game')}
        // Settings screen lands in Phase 9 — no-op for now.
        onOpenSettings={() => {}}
      />
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {screen === 'game' ? (
        <PuzzleScreen
          initialLevel={furthestLevel}
          onLevelChange={handleLevelChange}
          onOpenJourney={() => setScreen('journey')}
        />
      ) : (
        <JourneyScreen furthestLevel={furthestLevel} onClose={() => setScreen('game')} />
      )}
      <StatusBar style={screen === 'game' ? 'dark' : 'light'} />
    </GestureHandlerRootView>
  );
}

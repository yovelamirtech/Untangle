import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useRef, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { initAds } from './src/ads';
import BadgeCollectionScreen from './src/BadgeCollectionScreen';
import { resetBadgeProgress } from './src/badgeProgress';
import BadgePuzzleScreen from './src/BadgePuzzleScreen';
import JourneyScreen from './src/JourneyScreen';
import MainMenuScreen from './src/MainMenuScreen';
import { loadProgress, resetProgress, saveProgress } from './src/progress';
import PuzzleScreen from './src/PuzzleScreen';
import { loadSettings } from './src/settings';
import SettingsScreen from './src/SettingsScreen';
import StudioSplashScreen from './src/StudioSplashScreen';

// Keep the native launch splash (assets/splash-icon.png, see app.json) up
// until the studio splash below is ready to take over — otherwise there's a
// blank flash between the native splash disappearing and JS rendering.
SplashScreen.preventAutoHideAsync().catch(() => {});

type Screen = 'studioSplash' | 'menu' | 'game' | 'journey' | 'settings' | 'badges' | 'badgePuzzle';

export default function App() {
  const [screen, setScreen] = useState<Screen>('studioSplash');
  const [furthestLevel, setFurthestLevel] = useState<number | null>(null);
  const [activeBadgeId, setActiveBadgeId] = useState<string | null>(null);
  // Where "Back" from Settings should return to — it can be opened from
  // either the main menu or from inside a game screen.
  const screenBeforeSettings = useRef<Screen>('menu');

  useEffect(() => {
    loadProgress().then((progress) => setFurthestLevel(progress.furthestLevel));
    loadSettings();
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

  const openSettings = useCallback(() => {
    screenBeforeSettings.current = screen;
    setScreen('settings');
  }, [screen]);

  const handleResetProgress = useCallback(async () => {
    await Promise.all([resetProgress(), resetBadgeProgress()]);
    setFurthestLevel(1);
    setScreen('menu');
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

  // Every screen below is wrapped in one shared GestureHandlerRootView:
  // react-native-gesture-handler's GestureDetector (used by BadgePuzzleScreen
  // and PuzzleScreen) silently does nothing without a RootView ancestor, so
  // this can't be scoped to just the screens that obviously use gestures.
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {screen === 'menu' && (
        <MainMenuScreen
          onSelectJourney={() => setScreen('game')}
          onSelectBadgeChallenge={() => setScreen('badges')}
          onOpenSettings={openSettings}
        />
      )}
      {screen === 'settings' && (
        <SettingsScreen onBack={() => setScreen(screenBeforeSettings.current)} onResetProgress={handleResetProgress} />
      )}
      {screen === 'badges' && (
        <BadgeCollectionScreen
          onClose={() => setScreen('menu')}
          onSelectBadge={(badgeId) => {
            setActiveBadgeId(badgeId);
            setScreen('badgePuzzle');
          }}
        />
      )}
      {screen === 'badgePuzzle' && activeBadgeId && (
        <BadgePuzzleScreen
          badgeId={activeBadgeId}
          onBack={() => setScreen('badges')}
          onSolved={() => setScreen('badges')}
        />
      )}
      {screen === 'game' && (
        <PuzzleScreen
          initialLevel={furthestLevel}
          onLevelChange={handleLevelChange}
          onOpenJourney={() => setScreen('journey')}
          onOpenSettings={openSettings}
          onExitToMenu={() => setScreen('menu')}
        />
      )}
      {screen === 'journey' && <JourneyScreen furthestLevel={furthestLevel} onClose={() => setScreen('game')} />}
      <StatusBar style={screen === 'game' ? 'dark' : 'light'} />
    </GestureHandlerRootView>
  );
}

import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { initAds } from './src/ads';
import JourneyScreen from './src/JourneyScreen';
import { loadProgress, saveProgress } from './src/progress';
import PuzzleScreen from './src/PuzzleScreen';

type Screen = 'game' | 'journey';

export default function App() {
  const [screen, setScreen] = useState<Screen>('game');
  const [furthestLevel, setFurthestLevel] = useState<number | null>(null);

  useEffect(() => {
    loadProgress().then((progress) => setFurthestLevel(progress.furthestLevel));
    // No-ops safely if the native ads module isn't available (e.g. Expo Go).
    initAds();
  }, []);

  const handleLevelChange = useCallback((level: number) => {
    setFurthestLevel((prev) => {
      const next = Math.max(prev ?? 1, level);
      if (next !== prev) saveProgress({ furthestLevel: next });
      return next;
    });
  }, []);

  if (furthestLevel === null) return null;

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

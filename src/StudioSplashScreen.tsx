import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';

// assets/studio-splash-logo.png is generated from assets/studio_logo/icon-appstore.svg
// via scripts/generate-icons.mjs — re-run that script if the source SVG changes.
const STUDIO_LOGO = require('../assets/studio-splash-logo.png');

const FADE_IN_MS = 700;
const HOLD_MS = 1200;
const FADE_OUT_MS = 700;
// Matches the dark-violet hub identity used everywhere outside gameplay
// (MainMenuScreen/JourneyScreen/SettingsScreen/BadgeCollectionScreen) rather
// than the studio logo's own isolated purple (#5B4B87) — the logo itself is
// untouched (it doubles as the App Store icon source), so its rounded square
// now reads as a card on the app's own background instead of blending flat.
const BACKGROUND_COLOR = '#1B1530';

interface StudioSplashScreenProps {
  onFinish: () => void;
}

export default function StudioSplashScreen({ onFinish }: StudioSplashScreenProps) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withSequence(
      withTiming(1, { duration: FADE_IN_MS, easing: Easing.out(Easing.quad) }),
      withDelay(HOLD_MS, withTiming(0, { duration: FADE_OUT_MS, easing: Easing.in(Easing.quad) }))
    );
    const totalMs = FADE_IN_MS + HOLD_MS + FADE_OUT_MS;
    const timer = setTimeout(onFinish, totalMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container}>
      <Animated.Image source={STUDIO_LOGO} style={[styles.logo, { opacity }]} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 220,
    height: 220,
  },
});

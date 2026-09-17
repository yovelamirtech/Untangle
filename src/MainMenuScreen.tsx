import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

// assets/game-logo-wordmark.png is generated from assets/game_logo/wordmark.svg
// via scripts/generate-icons.mjs — re-run that script if the source SVG changes.
const WORDMARK = require('../assets/game-logo-wordmark.png');

// Matches the dark-violet identity used everywhere outside of gameplay
// itself (JourneyScreen, SettingsScreen, BadgeCollectionScreen,
// BadgePuzzleScreen) — gameplay screens rotate through the pastel level
// palettes (see palette.ts), but the app's own hub screens share this one
// look, so the main menu should too instead of borrowing a level palette.
const COLORS = {
  background: '#1B1530',
  title: '#E4DBFA',
  journeyButton: '#F6A8B8',
  journeyButtonText: '#241B38',
  badgeButton: 'rgba(228,219,250,0.1)',
  badgeButtonBorder: 'rgba(228,219,250,0.25)',
  badgeButtonText: '#E4DBFA',
  gearIcon: '#E4DBFA',
  gearButtonBg: 'rgba(0,0,0,0.35)',
};

interface MainMenuScreenProps {
  onSelectJourney: () => void;
  onSelectBadgeChallenge: () => void;
  onOpenSettings: () => void;
}

export default function MainMenuScreen({ onSelectJourney, onSelectBadgeChallenge, onOpenSettings }: MainMenuScreenProps) {
  return (
    <View style={styles.container}>
      <Pressable style={styles.settingsButton} onPress={onOpenSettings} hitSlop={12}>
        <Ionicons name="settings-outline" size={24} color={COLORS.gearIcon} />
      </Pressable>

      <View style={styles.content}>
        <Image source={WORDMARK} style={styles.wordmark} resizeMode="contain" />

        <View style={styles.buttons}>
          <Pressable style={[styles.button, styles.journeyButton]} onPress={onSelectJourney}>
            <Text style={styles.journeyButtonText}>Journey</Text>
          </Pressable>

          <Pressable style={[styles.button, styles.badgeButton]} onPress={onSelectBadgeChallenge}>
            <Text style={styles.badgeButtonText}>Badge Challenge</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  settingsButton: {
    position: 'absolute',
    top: 56,
    left: 20,
    zIndex: 1,
    backgroundColor: COLORS.gearButtonBg,
    padding: 8,
    borderRadius: 14,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  wordmark: {
    width: 260,
    height: 81,
    marginBottom: 64,
  },
  buttons: {
    width: '100%',
    gap: 16,
  },
  button: {
    borderRadius: 20,
    paddingVertical: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  journeyButton: {
    backgroundColor: COLORS.journeyButton,
    shadowColor: COLORS.journeyButton,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  journeyButtonText: {
    color: COLORS.journeyButtonText,
    fontSize: 20,
    fontWeight: '700',
  },
  badgeButton: {
    backgroundColor: COLORS.badgeButton,
    borderWidth: 1,
    borderColor: COLORS.badgeButtonBorder,
  },
  badgeButtonText: {
    color: COLORS.badgeButtonText,
    fontSize: 20,
    fontWeight: '700',
  },
});

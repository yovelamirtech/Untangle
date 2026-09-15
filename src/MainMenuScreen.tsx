import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

// assets/game-logo-wordmark.png is generated from assets/game_logo/wordmark.svg
// via scripts/generate-icons.mjs — re-run that script if the source SVG changes.
const WORDMARK = require('../assets/game-logo-wordmark.png');

const COLORS = {
  background: '#EAF4FF',
  title: '#2B4A6B',
  journeyButton: '#4E93D9',
  journeyButtonText: '#FFFFFF',
  badgeButton: 'rgba(78,147,217,0.12)',
  badgeButtonText: 'rgba(43,74,107,0.55)',
  gearIcon: '#2B4A6B',
};

interface MainMenuScreenProps {
  onSelectJourney: () => void;
  onOpenSettings: () => void;
}

export default function MainMenuScreen({ onSelectJourney, onOpenSettings }: MainMenuScreenProps) {
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

          {/* Badge Challenge mode lands in Phase 10 — shown as a disabled
              "coming soon" placeholder rather than hidden, so the mode
              select already reads as a two-option hub. */}
          <View style={[styles.button, styles.badgeButton]}>
            <Text style={styles.badgeButtonText}>Badge Challenge</Text>
            <Text style={styles.comingSoonText}>Coming soon</Text>
          </View>
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
  },
  journeyButtonText: {
    color: COLORS.journeyButtonText,
    fontSize: 20,
    fontWeight: '700',
  },
  badgeButton: {
    backgroundColor: COLORS.badgeButton,
  },
  badgeButtonText: {
    color: COLORS.badgeButtonText,
    fontSize: 20,
    fontWeight: '700',
  },
  comingSoonText: {
    color: COLORS.badgeButtonText,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
});

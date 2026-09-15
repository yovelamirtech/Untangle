import { useState } from 'react';
import * as Haptics from 'expo-haptics';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import ConfirmModal from './ConfirmModal';
import ReportModal from './ReportModal';
import { isHapticEnabled, isSoundEffectsEnabled, setHapticEnabled, setSoundEffectsEnabled } from './settings';
import { SETTINGS_COLORS } from './settingsTheme';
import SettingsRow from './SettingsRow';
import SettingsSection from './SettingsSection';
import Toggle from './Toggle';
import { useReportForm } from './useReportForm';

// Hosted as a Markdown file in this repo (see PRIVACY.md) rather than a
// separate web page — same approach as letter-wheel. App stores that show
// ads require a privacy policy link reachable from inside the app itself.
const PRIVACY_POLICY_URL = 'https://github.com/yovelamirtech/Untangle/blob/main/PRIVACY.md';

interface SettingsScreenProps {
  onBack: () => void;
  onResetProgress: () => void;
}

export default function SettingsScreen({ onBack, onResetProgress }: SettingsScreenProps) {
  const [soundEffectsEnabled, setSoundEffectsEnabledState] = useState(isSoundEffectsEnabled());
  const [hapticEnabled, setHapticEnabledState] = useState(isHapticEnabled());
  const [confirmVisible, setConfirmVisible] = useState(false);

  const bugReport = useReportForm({
    fromName: 'Untangle bug report',
    buildSubject: (title) => `Bug report: ${title}`,
    buildFields: (title, description) => ({
      Title: title,
      'What happened': description || 'No description provided',
    }),
  });

  function handleSoundEffectsChange(enabled: boolean) {
    setSoundEffectsEnabledState(enabled);
    setSoundEffectsEnabled(enabled);
  }

  function handleHapticChange(enabled: boolean) {
    setHapticEnabledState(enabled);
    setHapticEnabled(enabled);
  }

  function handleConfirmReset() {
    setConfirmVisible(false);
    onResetProgress();
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={styles.backButton}>{'‹'} Back</Text>
        </Pressable>
        <Text style={styles.title}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <SettingsSection title="Sound & haptics">
          <SettingsRow
            label="Sound effects"
            right={<Toggle value={soundEffectsEnabled} onValueChange={handleSoundEffectsChange} />}
          />
          <SettingsRow
            label="Haptic feedback on solve"
            right={<Toggle value={hapticEnabled} onValueChange={handleHapticChange} />}
          />
        </SettingsSection>

        <SettingsSection title="Help">
          <SettingsRow label="Report a bug" onPress={bugReport.open} />
        </SettingsSection>

        <SettingsSection title="Info">
          <SettingsRow label="Privacy policy" onPress={() => Linking.openURL(PRIVACY_POLICY_URL)} />
        </SettingsSection>

        <Pressable style={styles.dangerButton} onPress={() => setConfirmVisible(true)}>
          <Text style={styles.dangerButtonText}>Reset progress</Text>
        </Pressable>
      </ScrollView>

      <ConfirmModal
        visible={confirmVisible}
        title="Reset progress"
        message="This clears your journey progress and badge collection. This can't be undone."
        confirmLabel="Yes, reset"
        onConfirm={handleConfirmReset}
        onCancel={() => setConfirmVisible(false)}
      />

      <ReportModal
        visible={bugReport.visible}
        submitted={bugReport.submitted}
        title="Report a bug"
        message="Tell us what happened and how to reproduce it, and we'll take a look."
        primaryField={{
          label: 'Title',
          value: bugReport.primary,
          onChangeText: bugReport.setPrimary,
          placeholder: 'Short description of the issue',
        }}
        secondaryField={{
          label: 'What happened?',
          value: bugReport.secondary,
          onChangeText: bugReport.setSecondary,
          placeholder: 'Tell us what happened and how to reproduce it',
          multiline: true,
        }}
        sending={bugReport.sending}
        error={bugReport.error}
        canSubmit={bugReport.primary.trim().length > 0}
        onSubmit={bugReport.submit}
        onClose={bugReport.close}
        confirmationTitle="Thanks!"
        confirmationMessage="Your report was sent."
      />
    </View>
  );
}

// Haptics.notificationAsync gates on the settings toggle, mirroring the check
// PuzzleScreen should use for its own solve-haptic.
export async function fireSolveHapticIfEnabled(): Promise<void> {
  if (!isHapticEnabled()) return;
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SETTINGS_COLORS.screenBg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  backButton: {
    color: SETTINGS_COLORS.textMuted,
    fontSize: 15,
    fontWeight: '600',
  },
  title: {
    color: SETTINGS_COLORS.text,
    fontSize: 18,
    fontWeight: '700',
  },
  // Balances the header row so the title stays visually centered against the
  // "‹ Back" button on the left.
  headerSpacer: {
    width: 50,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  dangerButton: {
    marginTop: 32,
    backgroundColor: SETTINGS_COLORS.danger,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  dangerButtonText: {
    color: SETTINGS_COLORS.dangerText,
    fontSize: 16,
    fontWeight: '700',
  },
});

import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SETTINGS_COLORS } from './settingsTheme';

interface SettingsSectionProps {
  title: string;
  children: ReactNode;
}

export default function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 24,
  },
  title: {
    color: SETTINGS_COLORS.textMuted,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  card: {
    backgroundColor: SETTINGS_COLORS.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: SETTINGS_COLORS.cardBorder,
  },
});

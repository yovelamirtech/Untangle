import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SETTINGS_COLORS } from './settingsTheme';

interface SettingsRowProps {
  label: string;
  onPress?: () => void;
  /** Content on the row's trailing edge (e.g. a Toggle). Defaults to a
   * chevron when onPress is set and right isn't — hinting the row is tappable. */
  right?: ReactNode;
}

export default function SettingsRow({ label, onPress, right }: SettingsRowProps) {
  const content = right ?? (onPress ? <Text style={styles.chevron}>{'›'}</Text> : null);
  const Wrapper = onPress ? Pressable : View;

  return (
    <Wrapper style={styles.row} onPress={onPress}>
      <Text style={styles.label}>{label}</Text>
      {content}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  label: {
    color: SETTINGS_COLORS.text,
    fontSize: 16,
    fontWeight: '500',
  },
  chevron: {
    fontSize: 18,
    color: SETTINGS_COLORS.textFaint,
  },
});

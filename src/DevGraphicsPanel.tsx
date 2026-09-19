import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { DevGraphicsFlags, setDevGraphicsFlag, useDevGraphicsFlags } from './devGraphicsFlags';
import { modalStyles } from './modalStyles';
import { SETTINGS_COLORS } from './settingsTheme';
import Toggle from './Toggle';

const ROWS: { key: keyof DevGraphicsFlags; label: string }[] = [
  { key: 'nodeGradient', label: 'Node gradient' },
  { key: 'nodeShadow', label: 'Node shadow' },
  { key: 'edgeGlow', label: 'Rope glow' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

/** DEV-ONLY: lets testing A/B the graphics-polish effects on a real device
 * without a rebuild. Render only behind `__DEV__` at the call site; strip
 * before release. */
export default function DevGraphicsPanel({ visible, onClose }: Props) {
  const flags = useDevGraphicsFlags();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={modalStyles.overlay} onPress={onClose}>
        <Pressable style={modalStyles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={modalStyles.title}>Graphics FX (dev)</Text>
          {ROWS.map(({ key, label }) => (
            <View key={key} style={styles.row}>
              <Text style={styles.rowLabel}>{label}</Text>
              <Toggle value={flags[key]} onValueChange={(value) => setDevGraphicsFlag(key, value)} />
            </View>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  rowLabel: {
    color: SETTINGS_COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
});

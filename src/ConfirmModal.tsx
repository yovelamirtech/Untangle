import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { modalStyles } from './modalStyles';
import { SETTINGS_COLORS } from './settingsTheme';

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.card}>
          <Text style={modalStyles.title}>{title}</Text>
          <Text style={modalStyles.message}>{message}</Text>
          <View style={modalStyles.buttons}>
            <Pressable style={[modalStyles.button, styles.dangerButton]} onPress={onConfirm}>
              <Text style={styles.dangerText}>{confirmLabel}</Text>
            </Pressable>
            <Pressable style={[modalStyles.button, modalStyles.cancelButton]} onPress={onCancel}>
              <Text style={modalStyles.cancelText}>{cancelLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dangerButton: {
    backgroundColor: SETTINGS_COLORS.danger,
  },
  dangerText: {
    color: SETTINGS_COLORS.dangerText,
    fontSize: 15,
    fontWeight: '700',
  },
});

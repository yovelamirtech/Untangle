import { Fragment } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { modalStyles } from './modalStyles';
import { SETTINGS_COLORS } from './settingsTheme';

interface FieldConfig {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  multiline?: boolean;
}

interface ReportModalProps {
  visible: boolean;
  submitted: boolean;
  title: string;
  message: string;
  primaryField: FieldConfig;
  secondaryField: FieldConfig;
  sending: boolean;
  error: string | null;
  canSubmit: boolean;
  onSubmit: () => void;
  onClose: () => void;
  confirmationTitle: string;
  confirmationMessage: string;
}

/** Generic bug-report modal: two text fields, submit, and a "thanks" state
 * that closes on tap or on its own. */
export default function ReportModal({
  visible,
  submitted,
  title,
  message,
  primaryField,
  secondaryField,
  sending,
  error,
  canSubmit,
  onSubmit,
  onClose,
  confirmationTitle,
  confirmationMessage,
}: ReportModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {submitted ? (
        <Pressable style={modalStyles.overlay} onPress={onClose}>
          <View style={modalStyles.card}>
            <Text style={modalStyles.title}>{confirmationTitle}</Text>
            <Text style={[modalStyles.message, styles.noMarginBottom]}>{confirmationMessage}</Text>
          </View>
        </Pressable>
      ) : (
        <KeyboardAvoidingView style={modalStyles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={modalStyles.card}>
            <Text style={modalStyles.title}>{title}</Text>
            <Text style={modalStyles.message}>{message}</Text>

            {[primaryField, secondaryField].map((field) => (
              <Fragment key={field.label}>
                <Text style={modalStyles.fieldLabel}>{field.label}</Text>
                <TextInput
                  style={[modalStyles.input, field.multiline && modalStyles.inputMultiline]}
                  value={field.value}
                  onChangeText={field.onChangeText}
                  placeholder={field.placeholder}
                  placeholderTextColor={SETTINGS_COLORS.textFaint}
                  multiline={field.multiline}
                  editable={!sending}
                />
              </Fragment>
            ))}

            {error !== null && <Text style={modalStyles.errorText}>{error}</Text>}

            <View style={modalStyles.buttons}>
              <Pressable
                style={[styles.submitButton, (sending || !canSubmit) && modalStyles.buttonDisabled]}
                onPress={onSubmit}
                disabled={sending || !canSubmit}
              >
                <Text style={styles.submitText}>{sending ? 'Sending…' : 'Send'}</Text>
              </Pressable>
              <Pressable
                style={[modalStyles.button, modalStyles.cancelButton, sending && modalStyles.buttonDisabled]}
                onPress={onClose}
                disabled={sending}
              >
                <Text style={modalStyles.cancelText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  noMarginBottom: {
    marginBottom: 0,
  },
  submitButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: SETTINGS_COLORS.accent,
  },
  submitText: {
    color: SETTINGS_COLORS.accentText,
    fontSize: 15,
    fontWeight: '700',
  },
});

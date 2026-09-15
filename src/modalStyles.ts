import { StyleSheet } from 'react-native';

import { SETTINGS_COLORS } from './settingsTheme';

export const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: SETTINGS_COLORS.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: SETTINGS_COLORS.card,
    borderRadius: 16,
    padding: 20,
  },
  title: {
    color: SETTINGS_COLORS.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 8,
  },
  message: {
    color: SETTINGS_COLORS.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  fieldLabel: {
    color: SETTINGS_COLORS.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    backgroundColor: SETTINGS_COLORS.cardBorder,
    color: SETTINGS_COLORS.text,
    fontSize: 15,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  errorText: {
    color: SETTINGS_COLORS.error,
    fontSize: 13,
    marginBottom: 12,
  },
  buttons: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  cancelButton: {
    backgroundColor: SETTINGS_COLORS.cardBorder,
  },
  cancelText: {
    color: SETTINGS_COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
});

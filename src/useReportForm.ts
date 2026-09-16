import { useEffect, useState } from 'react';
import * as Haptics from 'expo-haptics';

import { submitToWeb3Forms, Web3FormsFields } from './web3forms';

const CONFIRMATION_DURATION_MS = 2200;

interface UseReportFormOptions {
  fromName: string;
  buildSubject: (primary: string) => string;
  buildFields: (primary: string, secondary: string) => Web3FormsFields;
}

/** Shared state machine for the bug-report form: open/close, two text fields,
 * submission to Web3Forms, and a "thanks" confirmation that closes itself. */
export function useReportForm({ fromName, buildSubject, buildFields }: UseReportFormOptions) {
  const [visible, setVisible] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [primary, setPrimary] = useState('');
  const [secondary, setSecondary] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!submitted || !visible) return;
    const timer = setTimeout(() => setVisible(false), CONFIRMATION_DURATION_MS);
    return () => clearTimeout(timer);
  }, [submitted, visible]);

  function open() {
    setSubmitted(false);
    setPrimary('');
    setSecondary('');
    setError(null);
    setVisible(true);
  }

  function close() {
    // Blocked while sending so the modal can't disappear mid-request.
    if (sending) return;
    setError(null);
    setVisible(false);
  }

  async function submit() {
    if (sending || !primary.trim()) return;
    setSending(true);
    setError(null);

    const trimmedPrimary = primary.trim();
    const result = await submitToWeb3Forms(
      buildSubject(trimmedPrimary),
      fromName,
      buildFields(trimmedPrimary, secondary.trim())
    );

    setSending(false);

    if (!result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(result.message ?? 'Send failed. Try again.');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSubmitted(true);
  }

  return { visible, submitted, primary, setPrimary, secondary, setSecondary, sending, error, open, close, submit };
}

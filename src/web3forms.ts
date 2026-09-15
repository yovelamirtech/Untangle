import Constants from 'expo-constants';
import { Platform } from 'react-native';

const WEB3FORMS_ENDPOINT = 'https://api.web3forms.com/submit';

// Longest we'll wait for a response — without this a stuck request would
// leave the form showing "Sending..." forever.
const REQUEST_TIMEOUT_MS = 15000;

export interface Web3FormsResult {
  success: boolean;
  /** User-facing message to show when the submission fails. */
  message?: string;
}

/**
 * Extra fields sent alongside the form. Web3Forms turns every key into a
 * line in the resulting email, so the key names are what shows up there.
 */
export type Web3FormsFields = Record<string, string>;

function getAccessKey(): string {
  const fromConfig = Constants.expoConfig?.extra?.web3formsAccessKey;
  if (typeof fromConfig === 'string' && fromConfig.length > 0) {
    return fromConfig;
  }
  // Fallback: an EXPO_PUBLIC_-prefixed env var baked into the bundle at build time.
  return process.env.EXPO_PUBLIC_WEB3FORMS_ACCESS_KEY ?? '';
}

/** Environment context attached to every report, to help reproduce the bug. */
function deviceContext(): Web3FormsFields {
  return {
    Platform: `${Platform.OS} ${String(Platform.Version)}`,
    'App version': Constants.expoConfig?.version ?? 'unknown',
  };
}

/**
 * Submits a form to Web3Forms. Never throws — always resolves with a result
 * object, so callers can just show whatever message it comes back with.
 */
export async function submitToWeb3Forms(
  subject: string,
  fromName: string,
  fields: Web3FormsFields
): Promise<Web3FormsResult> {
  const accessKey = getAccessKey();
  if (!accessKey) {
    return { success: false, message: 'Bug reporting isn’t set up yet. Please try again later.' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(WEB3FORMS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        access_key: accessKey,
        subject,
        from_name: fromName,
        // Web3Forms spam honeypot: a filled-in value drops the submission.
        botcheck: '',
        ...deviceContext(),
        ...fields,
      }),
      signal: controller.signal,
    });

    const data: unknown = await response.json().catch(() => null);
    const succeeded =
      response.ok &&
      typeof data === 'object' &&
      data !== null &&
      (data as { success?: boolean }).success === true;

    if (succeeded) {
      return { success: true };
    }

    return { success: false, message: 'Send failed. Check your connection and try again.' };
  } catch {
    return { success: false, message: 'Send failed. Check your connection and try again.' };
  } finally {
    clearTimeout(timeout);
  }
}

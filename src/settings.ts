import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'untangle:settings:v1';

interface StoredSettings {
  soundEffectsEnabled: boolean;
  hapticEnabled: boolean;
}

const DEFAULT_SETTINGS: StoredSettings = {
  soundEffectsEnabled: true,
  hapticEnabled: true,
};

// In-memory mirror so other modules (e.g. the solve-haptic in PuzzleScreen)
// can check the current value synchronously on every interaction, without
// waiting on AsyncStorage each time.
let currentSettings: StoredSettings = { ...DEFAULT_SETTINGS };

export function isSoundEffectsEnabled(): boolean {
  return currentSettings.soundEffectsEnabled;
}

export function isHapticEnabled(): boolean {
  return currentSettings.hapticEnabled;
}

export async function loadSettings(): Promise<StoredSettings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      currentSettings = { ...DEFAULT_SETTINGS };
      return currentSettings;
    }
    const parsed = JSON.parse(raw) as Partial<StoredSettings>;
    currentSettings = {
      soundEffectsEnabled: parsed.soundEffectsEnabled ?? DEFAULT_SETTINGS.soundEffectsEnabled,
      hapticEnabled: parsed.hapticEnabled ?? DEFAULT_SETTINGS.hapticEnabled,
    };
    return currentSettings;
  } catch (err) {
    console.warn('Failed to load settings, using defaults:', err);
    currentSettings = { ...DEFAULT_SETTINGS };
    return currentSettings;
  }
}

export async function setSoundEffectsEnabled(enabled: boolean): Promise<void> {
  currentSettings = { ...currentSettings, soundEffectsEnabled: enabled };
  await persistSettings();
}

export async function setHapticEnabled(enabled: boolean): Promise<void> {
  currentSettings = { ...currentSettings, hapticEnabled: enabled };
  await persistSettings();
}

async function persistSettings(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(currentSettings));
  } catch (err) {
    console.warn('Failed to persist settings:', err);
  }
}

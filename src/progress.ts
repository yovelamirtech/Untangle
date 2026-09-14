import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'untangle:progress:v1';

export interface Progress {
  /** The furthest level the player has reached (i.e. the level currently in play). */
  furthestLevel: number;
}

const DEFAULT_PROGRESS: Progress = { furthestLevel: 1 };

export async function loadProgress(): Promise<Progress> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROGRESS;
    const parsed = JSON.parse(raw);
    if (typeof parsed.furthestLevel === 'number' && parsed.furthestLevel >= 1) {
      return { furthestLevel: Math.floor(parsed.furthestLevel) };
    }
    return DEFAULT_PROGRESS;
  } catch {
    return DEFAULT_PROGRESS;
  }
}

export async function saveProgress(progress: Progress): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Best-effort persistence — losing a save shouldn't crash the game.
  }
}

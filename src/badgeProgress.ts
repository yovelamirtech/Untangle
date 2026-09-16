import AsyncStorage from '@react-native-async-storage/async-storage';

import { Node } from './puzzle';

// Bumped to v2: badge graphs were restructured (every graph-based badge is
// now a single linearized line — see singleLineify) and rtx5090's data was
// regenerated outright, so a v1 save's node ids no longer line up with the
// same physical points on the new graph. Loading it via applySavedPositions
// would silently scatter the wrong old (id, x, y) pairs onto the new
// nodes — not a fresh scramble, just a garbled one that never looked like
// the badge at all. Bumping the key orphans old saves so they're never
// read, instead of rendering that garbled state.
const STORAGE_KEY = 'untangle:badgeProgress:v2';

export type BadgeStatus = 'not-started' | 'in-progress' | 'solved';

interface BadgeSaveState {
  status: 'in-progress' | 'solved';
  /** Current node positions, so a player can leave mid-solve and come back
   * to the exact same layout. Absent once solved — nothing left to resume. */
  nodePositions?: Node[];
}

export type BadgeProgress = Record<string, BadgeSaveState>;

export async function loadBadgeProgress(): Promise<BadgeProgress> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as BadgeProgress;
  } catch {
    return {};
  }
}

export function getBadgeStatus(progress: BadgeProgress, badgeId: string): BadgeStatus {
  return progress[badgeId]?.status ?? 'not-started';
}

async function persist(progress: BadgeProgress): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Best-effort — losing a save shouldn't crash the game.
  }
}

export async function saveBadgeInProgress(badgeId: string, nodePositions: Node[]): Promise<void> {
  const progress = await loadBadgeProgress();
  progress[badgeId] = { status: 'in-progress', nodePositions };
  await persist(progress);
}

export async function saveBadgeSolved(badgeId: string): Promise<void> {
  const progress = await loadBadgeProgress();
  progress[badgeId] = { status: 'solved' };
  await persist(progress);
}

export async function getSavedNodePositions(badgeId: string): Promise<Node[] | undefined> {
  const progress = await loadBadgeProgress();
  return progress[badgeId]?.nodePositions;
}

export async function resetBadgeProgress(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // Best-effort.
  }
}

export interface DifficultySettings {
  nodeCount: number;
  edgeCount: number;
}

const MIN_NODES = 5;
const MAX_NODES = 12;
const LEVELS_PER_TIER = 3;
const MAX_EXTRA_CHORDS = 5;

/**
 * Difficulty scaling: every 3 levels, add one more node (capped at 12) and
 * one more chord beyond the boundary cycle (capped at +5), so puzzles get
 * gradually bigger and more tangled without ever feeling like a jump.
 */
export function getDifficultyForLevel(level: number): DifficultySettings {
  const tier = Math.floor((level - 1) / LEVELS_PER_TIER);
  const nodeCount = Math.min(MIN_NODES + tier, MAX_NODES);
  const extraChords = Math.min(1 + tier, MAX_EXTRA_CHORDS);
  return { nodeCount, edgeCount: nodeCount + extraChords };
}

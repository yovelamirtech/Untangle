export interface DifficultySettings {
  nodeCount: number;
}

const MIN_NODES = 8;
const MAX_NODES = 20;
const LEVELS_PER_TIER = 3;

/**
 * Difficulty scaling: every 3 levels, the rope gets one more segment
 * (capped at 20), starting from 8 at level 1.
 */
export function getDifficultyForLevel(level: number): DifficultySettings {
  const tier = Math.floor((level - 1) / LEVELS_PER_TIER);
  const nodeCount = Math.min(MIN_NODES + tier, MAX_NODES);
  return { nodeCount };
}

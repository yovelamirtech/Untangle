export interface DifficultySettings {
  nodeCount: number;
}

const MIN_NODES = 30;
const MAX_NODES = 100;
const LEVELS_PER_TIER = 3;
const NODES_PER_TIER = 3;

/**
 * Difficulty scaling: every 3 levels, the rope gets three more segments
 * (capped at 100), starting from 30 at level 1.
 */
export function getDifficultyForLevel(level: number): DifficultySettings {
  const tier = Math.floor((level - 1) / LEVELS_PER_TIER);
  const nodeCount = Math.min(MIN_NODES + tier * NODES_PER_TIER, MAX_NODES);
  return { nodeCount };
}

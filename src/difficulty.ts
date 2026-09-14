export interface DifficultySettings {
  nodeCount: number;
}

const MIN_NODES = 9;
const MAX_NODES = 30;
const LEVELS_PER_TIER = 2;
const NODES_PER_TIER = 1;

/**
 * Difficulty scaling: every 2 levels, the rope gets one more segment
 * (capped at 30), starting from 9 at level 1 — a gentle, near-continuous
 * ramp rather than big jumps.
 */
export function getDifficultyForLevel(level: number): DifficultySettings {
  const tier = Math.floor((level - 1) / LEVELS_PER_TIER);
  const nodeCount = Math.min(MIN_NODES + tier * NODES_PER_TIER, MAX_NODES);
  return { nodeCount };
}

/**
 * Minimum number of crossings a freshly-scrambled level should have, so
 * early/small puzzles never start out trivially close to solved.
 */
export function getMinCrossingsForLevel(nodeCount: number): number {
  return Math.max(3, Math.round(nodeCount * 0.5));
}

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

/** Ceiling on getMinCrossingsForLevel's output — see there. */
const MAX_TARGET_CROSSINGS = 40;

/**
 * Minimum number of crossings a freshly-scrambled level should have, so
 * early/small puzzles never start out trivially close to solved. Capped
 * because it's also used for graph-based badges (e.g. rtx5090's 321
 * nodes), where the uncapped formula would demand as many as ~160 —
 * a target only reachable by scattering the graph so thoroughly that
 * it's no longer tractable to untangle by dragging one node at a time
 * (see scrambleGraphAtLeast). A normal level never exceeds 30 nodes, so
 * the cap never actually changes its value (15 at most).
 */
export function getMinCrossingsForLevel(nodeCount: number): number {
  return Math.max(3, Math.min(Math.round(nodeCount * 0.5), MAX_TARGET_CROSSINGS));
}

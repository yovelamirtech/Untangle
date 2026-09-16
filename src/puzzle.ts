import { Point, segmentsIntersect } from './geometry';

export interface Node {
  id: number;
  x: number;
  y: number;
}

export interface Edge {
  a: number;
  b: number;
}

export interface Graph {
  nodes: Node[];
  edges: Edge[];
}

function edgesShareEndpoint(a: Edge, b: Edge): boolean {
  return a.a === b.a || a.a === b.b || a.b === b.a || a.b === b.b;
}

/**
 * Builds a single open path (a "rope") through N nodes: nodes are laid out
 * around a circle in order and connected consecutively, leaving out the
 * final edge that would close the loop. Since it's a sub-path of a convex
 * polygon's boundary, it can never cross itself — this is the puzzle's
 * solution.
 */
export function generateSolvedGraph(n: number, center: Point, radius: number): Graph {
  const nodes: Node[] = Array.from({ length: n }, (_, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    return {
      id: i,
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
    };
  });

  const edges: Edge[] = [];
  for (let i = 0; i < n - 1; i++) {
    edges.push({ a: i, b: i + 1 });
  }

  return { nodes, edges };
}

/**
 * Returns a new graph with the same nodes/edges but node positions
 * randomized within the given bounds, so lines now cross.
 */
export function scrambleGraph(graph: Graph, width: number, height: number, margin: number): Graph {
  const nodes = graph.nodes.map((node) => ({
    id: node.id,
    x: margin + Math.random() * (width - 2 * margin),
    y: margin + Math.random() * (height - 2 * margin),
  }));
  return { nodes, edges: graph.edges };
}

/**
 * Returns a new graph with each node displaced from its *solved* position
 * by a random offset up to `radius` (clamped to stay in bounds), rather
 * than placed completely independently of where it started. Unlike
 * scrambleGraph, this gives fine control over how tangled the result
 * is — a fully independent random placement's crossing count grows
 * roughly with the square of the edge count, so for a graph with a few
 * hundred edges (a vectorized badge like toaster or rtx5090) it can only
 * ever land somewhere in the thousands, with no way to dial it back.
 */
function scrambleGraphJitter(graph: Graph, width: number, height: number, margin: number, radius: number): Graph {
  const nodes = graph.nodes.map((node) => {
    const angle = Math.random() * 2 * Math.PI;
    const distance = Math.random() * radius;
    return {
      id: node.id,
      x: Math.min(Math.max(node.x + distance * Math.cos(angle), margin), width - margin),
      y: Math.min(Math.max(node.y + distance * Math.sin(angle), margin), height - margin),
    };
  });
  return { nodes, edges: graph.edges };
}

/**
 * Binary-searches scrambleGraphJitter's radius for a result whose crossing
 * count falls in [minCrossings, maxCrossings], returning whichever
 * candidate it saw land closest to that range if it never lands exactly
 * inside it within the iteration budget.
 */
function scrambleGraphByJitterRadius(
  graph: Graph,
  width: number,
  height: number,
  margin: number,
  minCrossings: number,
  maxCrossings: number
): Graph {
  let lo = 0;
  let hi = Math.max(width, height);
  let closest = scrambleGraphJitter(graph, width, height, margin, hi);
  let closestDistance = Infinity;

  for (let i = 0; i < 14; i++) {
    const radius = (lo + hi) / 2;
    const candidate = scrambleGraphJitter(graph, width, height, margin, radius);
    const crossings = countCrossings(candidate);

    if (crossings >= minCrossings && crossings <= maxCrossings) return candidate;

    const distance = crossings < minCrossings ? minCrossings - crossings : crossings - maxCrossings;
    if (distance < closestDistance) {
      closest = candidate;
      closestDistance = distance;
    }

    if (crossings > maxCrossings) hi = radius;
    else lo = radius;
  }

  return closest;
}

/**
 * Scrambles the graph, retrying (up to a cap) only if the result falls
 * below a minimum crossing count. This cuts off the unlucky "too easy"
 * outliers a single scramble occasionally produces without forcing the
 * layout toward a maximally tangled (and frustrating) extreme.
 *
 * `maxCrossings` guards the other direction: a fully independent random
 * scatter (scrambleGraph) is fine for a normal level's handful of nodes,
 * but for a graph with hundreds of edges it reliably produces thousands
 * of crossings on the very first attempt — unsolvable by dragging one
 * node at a time in practice, and this loop only ever raises the
 * crossing count further, never lowers it. When the scatter overshoots
 * that ceiling, falls back to scrambleGraphByJitterRadius instead, which
 * can be dialed down to a tractable tangle.
 */
export function scrambleGraphAtLeast(
  graph: Graph,
  width: number,
  height: number,
  margin: number,
  minCrossings: number,
  maxAttempts = 8,
  maxCrossings = Infinity
): Graph {
  let best = scrambleGraph(graph, width, height, margin);
  let bestCrossings = countCrossings(best);

  for (let i = 1; i < maxAttempts && bestCrossings < minCrossings; i++) {
    const candidate = scrambleGraph(graph, width, height, margin);
    const crossings = countCrossings(candidate);
    if (crossings > bestCrossings) {
      best = candidate;
      bestCrossings = crossings;
    }
  }

  if (bestCrossings <= maxCrossings) return best;
  return scrambleGraphByJitterRadius(graph, width, height, margin, minCrossings, maxCrossings);
}

/**
 * Counts how many pairs of (non-adjacent) edges currently cross.
 *
 * Builds a node-id lookup once up front — with an O(N) linear scan per
 * lookup instead, this is O(E^2 * N), which turns a badge with a few
 * hundred nodes/edges (toaster, rtx5090) into a multi-second-or-worse
 * freeze on every drag update, since this runs synchronously on the JS
 * thread.
 */
export function countCrossings(graph: Graph): number {
  let count = 0;
  const { nodes, edges } = graph;
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      if (edgesShareEndpoint(edges[i], edges[j])) continue;
      const p1 = nodeById.get(edges[i].a)!;
      const p2 = nodeById.get(edges[i].b)!;
      const p3 = nodeById.get(edges[j].a)!;
      const p4 = nodeById.get(edges[j].b)!;
      if (segmentsIntersect(p1, p2, p3, p4)) count++;
    }
  }
  return count;
}

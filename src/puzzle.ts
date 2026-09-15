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
 * Scrambles the graph, retrying (up to a cap) only if the result falls
 * below a minimum crossing count. This cuts off the unlucky "too easy"
 * outliers a single scramble occasionally produces without forcing the
 * layout toward a maximally tangled (and frustrating) extreme.
 */
export function scrambleGraphAtLeast(
  graph: Graph,
  width: number,
  height: number,
  margin: number,
  minCrossings: number,
  maxAttempts = 8
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

  return best;
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

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
 * Returns a new graph with each node in `movable` displaced from its
 * *solved* position by a random offset up to `radius` (clamped to stay in
 * bounds); every other node is left exactly where it was. Unlike
 * scrambleGraph, this gives fine control over how tangled the result is —
 * a fully independent random placement's crossing count grows roughly
 * with the square of the edge count, so for a graph with a few hundred
 * edges (a vectorized badge like toaster or rtx5090) it can only ever
 * land somewhere in the thousands, with no way to dial it back.
 */
function scrambleGraphJitter(
  graph: Graph,
  width: number,
  height: number,
  margin: number,
  radius: number,
  movable: Set<number>
): Graph {
  const nodes = graph.nodes.map((node) => {
    if (!movable.has(node.id)) return node;
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
  maxCrossings: number,
  movable: Set<number>,
  maxRadius: number = Math.max(width, height)
): Graph {
  let lo = 0;
  let hi = maxRadius;
  let closest = scrambleGraphJitter(graph, width, height, margin, hi, movable);
  let closestDistance = Infinity;

  for (let i = 0; i < 14; i++) {
    const radius = (lo + hi) / 2;
    const candidate = scrambleGraphJitter(graph, width, height, margin, radius, movable);
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
 * Traces a graph's outer (unbounded) face as a cycle of node ids, walking
 * from `start` via `startNext` and, at each subsequent node, always
 * turning to the neighbor `offset` positions away (in angular order
 * around that node) from the edge just arrived on — the standard
 * half-edge "next edge in this face" rule. Which offset (+1 or -1) yields
 * the *outer* face rather than some inner one depends on the winding
 * convention the graph's coordinates happen to use, which isn't uniform
 * across every badge's data, so traceOuterBoundaryIds tries both and
 * keeps whichever encloses more area.
 */
function traceFace(
  adjacency: Map<number, number[]>,
  start: number,
  startNext: number,
  offset: 1 | -1
): number[] {
  const boundary = [start];
  let prev = start;
  let cur = startNext;
  const maxSteps = adjacency.size * 8 + 20;
  for (let step = 0; step < maxSteps; step++) {
    boundary.push(cur);
    const neighbors = adjacency.get(cur)!;
    const idx = neighbors.indexOf(prev);
    const nextIdx = ((idx + offset) % neighbors.length + neighbors.length) % neighbors.length;
    const next = neighbors[nextIdx];
    if (cur === start && next === startNext) break;
    prev = cur;
    cur = next;
  }
  return boundary;
}

function shoelaceArea(boundary: number[], byId: Map<number, Node>): number {
  let area = 0;
  for (let i = 0; i < boundary.length - 1; i++) {
    const a = byId.get(boundary[i])!;
    const b = byId.get(boundary[i + 1])!;
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) / 2;
}

/**
 * Ids of the nodes on a graph's outer boundary (its outer face's cycle),
 * via half-edge face tracing rather than a convex hull — a shape with any
 * concave detail (a wing's notch, a card's chamfered corner) has an outer
 * boundary that dips inward past its convex hull, and a badge built from
 * several disconnected pieces (rtx5090's card outline plus three
 * unconnected fan icons) only traces the piece the starting node happens
 * to be part of, which is what we want: the fans' own rims are a separate
 * inner detail, not part of the card's outer silhouette.
 */
export function traceOuterBoundaryIds(graph: Graph): Set<number> {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const adjacency = new Map<number, number[]>();
  for (const n of graph.nodes) adjacency.set(n.id, []);
  for (const e of graph.edges) {
    adjacency.get(e.a)!.push(e.b);
    adjacency.get(e.b)!.push(e.a);
  }
  const angleFrom = (u: number, v: number) => {
    const pu = byId.get(u)!;
    const pv = byId.get(v)!;
    // Screen y grows downward; flip it so angle comparisons behave like
    // the usual math (y-up) convention.
    return Math.atan2(-(pv.y - pu.y), pv.x - pu.x);
  };
  for (const [id, neighbors] of adjacency) neighbors.sort((a, b) => angleFrom(id, a) - angleFrom(id, b));

  // The node with the largest y (lowest on screen, tie-broken leftmost) is
  // always on *some* outer boundary; starting the trace from its most
  // clockwise-from-straight-up edge is what makes traceFace follow that
  // boundary rather than double back into the interior immediately.
  let start = graph.nodes[0];
  for (const n of graph.nodes) {
    if (n.y > start.y || (n.y === start.y && n.x < start.x)) start = n;
  }
  const startNeighbors = adjacency.get(start.id)!;
  let startNext = startNeighbors[0];
  let bestAngle = Infinity;
  for (const n of startNeighbors) {
    const angle = angleFrom(start.id, n);
    const normalized = angle < 0 ? angle + 2 * Math.PI : angle;
    if (normalized < bestAngle) {
      bestAngle = normalized;
      startNext = n;
    }
  }

  const candidateA = traceFace(adjacency, start.id, startNext, -1);
  const candidateB = traceFace(adjacency, start.id, startNext, 1);
  const boundary = shoelaceArea(candidateA, byId) >= shoelaceArea(candidateB, byId) ? candidateA : candidateB;
  return new Set(boundary);
}

/**
 * Scrambles a badge graph while keeping its recognizable silhouette
 * intact: nodes in `movableIds` (the badge's interior — see
 * badges.ts's getBadgeSolvedGraph) are jittered from their solved
 * position, and every other node is pinned exactly where it belongs — the
 * puzzle looks like the badge from the very first frame, tangled only in
 * the lines running through its middle, rather than scrambled into an
 * unrecognizable scatter the way a normal level's rope is.
 */
export function scrambleBadgeGraph(
  graph: Graph,
  width: number,
  height: number,
  margin: number,
  minCrossings: number,
  maxCrossings: number,
  movableIds: Set<number>
): Graph {
  // A badge built by triangulating a hand-sketched outline (bird, shark —
  // see badges.ts) has no nodes but the outline itself: every one of them
  // is "on the boundary", so there's nothing left to jitter and the
  // puzzle would start pre-solved. Fall back to jittering every node a
  // bounded distance in that case — the outline blurs a little instead of
  // staying crisp, but it's still recognizable and there's an actual
  // puzzle to solve, unlike scrambling the whole canvas (see
  // scrambleGraphAtLeast) or not scrambling at all.
  if (movableIds.size === 0) {
    const allIds = new Set(graph.nodes.map((n) => n.id));
    const maxRadius = Math.max(width, height) * 0.2;
    return scrambleGraphByJitterRadius(graph, width, height, margin, minCrossings, maxCrossings, allIds, maxRadius);
  }

  return scrambleGraphByJitterRadius(graph, width, height, margin, minCrossings, maxCrossings, movableIds);
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

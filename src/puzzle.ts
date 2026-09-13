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

function shuffle<T>(items: T[]): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function nodeById(nodes: Node[], id: number): Node {
  const node = nodes.find((n) => n.id === id);
  if (!node) throw new Error(`No node with id ${id}`);
  return node;
}

function edgesShareEndpoint(a: Edge, b: Edge): boolean {
  return a.a === b.a || a.a === b.b || a.b === b.a || a.b === b.b;
}

function crossesAny(nodes: Node[], candidate: Edge, existing: Edge[]): boolean {
  const p1 = nodeById(nodes, candidate.a);
  const p2 = nodeById(nodes, candidate.b);
  return existing.some((edge) => {
    if (edgesShareEndpoint(candidate, edge)) return false;
    const p3 = nodeById(nodes, edge.a);
    const p4 = nodeById(nodes, edge.b);
    return segmentsIntersect(p1, p2, p3, p4);
  });
}

/**
 * Builds a graph with N nodes laid out on a circle (so the boundary cycle
 * never crosses itself) and M edges: the boundary cycle first, then random
 * chords accepted only if they don't cross an already-accepted edge. The
 * result is guaranteed crossing-free — this is the puzzle's solution.
 */
export function generateSolvedGraph(n: number, m: number, center: Point, radius: number): Graph {
  const nodes: Node[] = Array.from({ length: n }, (_, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    return {
      id: i,
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
    };
  });

  const edges: Edge[] = [];
  const edgeKey = (e: Edge) => `${Math.min(e.a, e.b)}-${Math.max(e.a, e.b)}`;
  const usedKeys = new Set<string>();

  for (let i = 0; i < n && edges.length < m; i++) {
    const candidate: Edge = { a: i, b: (i + 1) % n };
    edges.push(candidate);
    usedKeys.add(edgeKey(candidate));
  }

  const allPairs: Edge[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      allPairs.push({ a: i, b: j });
    }
  }

  for (const candidate of shuffle(allPairs)) {
    if (edges.length >= m) break;
    if (usedKeys.has(edgeKey(candidate))) continue;
    if (crossesAny(nodes, candidate, edges)) continue;
    edges.push(candidate);
    usedKeys.add(edgeKey(candidate));
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
 * Counts how many pairs of (non-adjacent) edges currently cross.
 */
export function countCrossings(graph: Graph): number {
  let count = 0;
  const { nodes, edges } = graph;
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      if (edgesShareEndpoint(edges[i], edges[j])) continue;
      const p1 = nodeById(nodes, edges[i].a);
      const p2 = nodeById(nodes, edges[i].b);
      const p3 = nodeById(nodes, edges[j].a);
      const p4 = nodeById(nodes, edges[j].b);
      if (segmentsIntersect(p1, p2, p3, p4)) count++;
    }
  }
  return count;
}

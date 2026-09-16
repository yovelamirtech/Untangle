import { Edge, Graph, Node } from './puzzle';

/**
 * Rewrites a branching graph into one or more simple, non-branching paths
 * that together touch every original edge at least once — a graph whose
 * junctions have degree > 2 can't be walked as a single line without
 * lifting the pen, so wherever that's unavoidable the walk backtracks over
 * an edge it already drew instead of skipping it (the classic route
 * inspection / "Chinese postman" problem, solved here with a greedy
 * nearest-pair matching rather than an optimal one — for a puzzle's sake,
 * "a short backtrack" is enough, it doesn't need to be the shortest
 * possible one). A badge whose reference art has genuinely disconnected
 * pieces (rtx5090's card outline and its three separate fan icons) still
 * yields one path per piece, since there's no line in the source art to
 * walk between them.
 *
 * Returns the new graph (nodes 0..N-1 forming those paths) alongside
 * `sourceIds[newId]`, the original node id each new node was cloned from —
 * a node visited twice by the walk becomes two new nodes at the same
 * solved position, both tracing back to the one original id, which lets
 * callers that need to know if a *position* was on the original shape's
 * outer boundary (not just this one visit to it) check sourceIds instead
 * of the new id directly.
 */
export function singleLineify(graph: Graph): { graph: Graph; sourceIds: number[] } {
  const components = findConnectedComponents(graph);
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const resultNodes: Node[] = [];
  const resultEdges: Edge[] = [];
  const sourceIds: number[] = [];

  for (const compIds of components) {
    const compIdSet = new Set(compIds);
    const compEdges = graph.edges.filter((e) => compIdSet.has(e.a) && compIdSet.has(e.b));
    const trail = compEdges.length > 0 ? eulerianTrailForComponent(compIds, compEdges, nodeById) : [compIds[0]];

    const startId = resultNodes.length;
    for (const originalId of trail) {
      const original = nodeById.get(originalId)!;
      resultNodes.push({ id: resultNodes.length, x: original.x, y: original.y });
      sourceIds.push(originalId);
    }
    for (let i = startId; i < resultNodes.length - 1; i++) {
      resultEdges.push({ a: i, b: i + 1 });
    }
  }

  return { graph: { nodes: resultNodes, edges: resultEdges }, sourceIds };
}

function findConnectedComponents(graph: Graph): number[][] {
  const adjacency = new Map<number, number[]>();
  for (const n of graph.nodes) adjacency.set(n.id, []);
  for (const e of graph.edges) {
    adjacency.get(e.a)!.push(e.b);
    adjacency.get(e.b)!.push(e.a);
  }

  const visited = new Set<number>();
  const components: number[][] = [];
  for (const n of graph.nodes) {
    if (visited.has(n.id)) continue;
    const component: number[] = [];
    const stack = [n.id];
    visited.add(n.id);
    while (stack.length > 0) {
      const current = stack.pop()!;
      component.push(current);
      for (const neighbor of adjacency.get(current)!) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          stack.push(neighbor);
        }
      }
    }
    components.push(component);
  }
  return components;
}

/**
 * Finds an Euler trail covering every edge of one connected component:
 * duplicates edges along shortest paths between odd-degree vertices until
 * at most two remain (an Euler trail can only start and end at an
 * odd-degree vertex; a graph needs 0 or 2 of them), then walks the result
 * with Hierholzer's algorithm.
 */
function eulerianTrailForComponent(compIds: number[], compEdges: Edge[], nodeById: Map<number, Node>): number[] {
  const degree = new Map<number, number>();
  for (const id of compIds) degree.set(id, 0);
  for (const e of compEdges) {
    degree.set(e.a, degree.get(e.a)! + 1);
    degree.set(e.b, degree.get(e.b)! + 1);
  }

  let odd = compIds.filter((id) => degree.get(id)! % 2 === 1);
  const workingEdges = compEdges.slice();

  while (odd.length > 2) {
    const u = odd[0];
    let bestIndex = 1;
    let bestDistance = Infinity;
    let bestPath: number[] = [];
    for (let i = 1; i < odd.length; i++) {
      const { distance, path } = shortestPath(compIds, compEdges, nodeById, u, odd[i]);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
        bestPath = path;
      }
    }
    for (let i = 0; i < bestPath.length - 1; i++) {
      workingEdges.push({ a: bestPath[i], b: bestPath[i + 1] });
    }
    const v = odd[bestIndex];
    odd = odd.filter((id) => id !== u && id !== v);
  }

  const start = odd.length === 2 ? odd[0] : compIds[0];
  return hierholzer(compIds, workingEdges, start);
}

/** Dijkstra's shortest path by Euclidean edge length, for picking which
 * existing line to backtrack over when a junction needs pairing off. */
function shortestPath(
  compIds: number[],
  edges: Edge[],
  nodeById: Map<number, Node>,
  start: number,
  end: number
): { distance: number; path: number[] } {
  const adjacency = new Map<number, { to: number; weight: number }[]>();
  for (const id of compIds) adjacency.set(id, []);
  for (const e of edges) {
    const a = nodeById.get(e.a)!;
    const b = nodeById.get(e.b)!;
    const weight = Math.hypot(a.x - b.x, a.y - b.y);
    adjacency.get(e.a)!.push({ to: e.b, weight });
    adjacency.get(e.b)!.push({ to: e.a, weight });
  }

  const dist = new Map<number, number>();
  const prev = new Map<number, number>();
  const visited = new Set<number>();
  for (const id of compIds) dist.set(id, Infinity);
  dist.set(start, 0);

  while (visited.size < compIds.length) {
    let current = -1;
    let currentDist = Infinity;
    for (const id of compIds) {
      if (!visited.has(id) && dist.get(id)! < currentDist) {
        currentDist = dist.get(id)!;
        current = id;
      }
    }
    if (current === -1 || current === end) break;
    visited.add(current);
    for (const { to, weight } of adjacency.get(current)!) {
      const alt = dist.get(current)! + weight;
      if (alt < dist.get(to)!) {
        dist.set(to, alt);
        prev.set(to, current);
      }
    }
  }

  const path: number[] = [end];
  let cur = end;
  while (cur !== start) {
    const p = prev.get(cur);
    if (p === undefined) break;
    path.push(p);
    cur = p;
  }
  path.reverse();
  return { distance: dist.get(end) ?? Infinity, path };
}

/** Iterative Hierholzer's algorithm: walks a graph whose vertices are all
 * even-degree (or exactly two odd, as `start`) consuming every edge
 * exactly once, returning the visit order. */
function hierholzer(compIds: number[], edges: Edge[], start: number): number[] {
  const adjacency = new Map<number, { to: number; edgeIndex: number }[]>();
  for (const id of compIds) adjacency.set(id, []);
  edges.forEach((e, edgeIndex) => {
    adjacency.get(e.a)!.push({ to: e.b, edgeIndex });
    adjacency.get(e.b)!.push({ to: e.a, edgeIndex });
  });

  const usedEdge = new Array(edges.length).fill(false);
  const nextIndex = new Map<number, number>();
  for (const id of compIds) nextIndex.set(id, 0);

  const stack = [start];
  const trail: number[] = [];
  while (stack.length > 0) {
    const v = stack[stack.length - 1];
    const list = adjacency.get(v)!;
    let i = nextIndex.get(v)!;
    while (i < list.length && usedEdge[list[i].edgeIndex]) i++;
    nextIndex.set(v, i);
    if (i < list.length) {
      usedEdge[list[i].edgeIndex] = true;
      stack.push(list[i].to);
    } else {
      trail.push(stack.pop()!);
    }
  }
  return trail.reverse();
}

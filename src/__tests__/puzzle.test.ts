import {
  countCrossings,
  createCrossingTracker,
  generateSolvedGraph,
  getEndpointIds,
  Graph,
  scrambleGraph,
  scrambleGraphAtLeast,
  traceOuterBoundaryIds,
  updateCrossingTracker,
} from '../puzzle';

describe('generateSolvedGraph', () => {
  it('produces a graph with no crossings', () => {
    const graph = generateSolvedGraph(9, { x: 200, y: 200 }, 150);
    expect(countCrossings(graph)).toBe(0);
  });

  it('creates n nodes and n-1 edges (an open path, not a closed loop)', () => {
    const graph = generateSolvedGraph(7, { x: 0, y: 0 }, 100);
    expect(graph.nodes).toHaveLength(7);
    expect(graph.edges).toHaveLength(6);
  });

  it('places nodes on the requested circle', () => {
    const center = { x: 50, y: 50 };
    const radius = 40;
    const graph = generateSolvedGraph(6, center, radius);
    for (const node of graph.nodes) {
      const distance = Math.hypot(node.x - center.x, node.y - center.y);
      expect(distance).toBeCloseTo(radius, 5);
    }
  });
});

describe('scrambleGraph', () => {
  it('keeps the same nodes and edges, only moving positions within bounds', () => {
    const solved = generateSolvedGraph(8, { x: 100, y: 100 }, 80);
    const scrambled = scrambleGraph(solved, 400, 400, 20);
    expect(scrambled.edges).toEqual(solved.edges);
    expect(scrambled.nodes).toHaveLength(solved.nodes.length);
    for (const node of scrambled.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(20);
      expect(node.x).toBeLessThanOrEqual(380);
      expect(node.y).toBeGreaterThanOrEqual(20);
      expect(node.y).toBeLessThanOrEqual(380);
    }
  });

  it('respects offsetX/offsetY to confine the scramble to a sub-region', () => {
    const solved = generateSolvedGraph(5, { x: 0, y: 0 }, 50);
    const scrambled = scrambleGraph(solved, 100, 100, 10, 300, 300);
    for (const node of scrambled.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(310);
      expect(node.x).toBeLessThanOrEqual(390);
      expect(node.y).toBeGreaterThanOrEqual(310);
      expect(node.y).toBeLessThanOrEqual(390);
    }
  });
});

describe('scrambleGraphAtLeast', () => {
  it('reaches at least the minimum crossing count for a graph large enough to support it', () => {
    const solved = generateSolvedGraph(20, { x: 200, y: 200 }, 150);
    const scrambled = scrambleGraphAtLeast(solved, 400, 400, 20, 5);
    expect(countCrossings(scrambled)).toBeGreaterThanOrEqual(5);
  });
});

describe('countCrossings', () => {
  it('is 0 for an empty edge set', () => {
    const graph: Graph = { nodes: [{ id: 0, x: 0, y: 0 }], edges: [] };
    expect(countCrossings(graph)).toBe(0);
  });

  it('does not count adjacent edges (sharing an endpoint) as crossing', () => {
    const graph: Graph = {
      nodes: [
        { id: 0, x: 0, y: 0 },
        { id: 1, x: 10, y: 0 },
        { id: 2, x: 10, y: 10 },
      ],
      edges: [
        { a: 0, b: 1 },
        { a: 1, b: 2 },
      ],
    };
    expect(countCrossings(graph)).toBe(0);
  });

  it('counts exactly one crossing for a simple X of two edges', () => {
    const graph: Graph = {
      nodes: [
        { id: 0, x: 0, y: 0 },
        { id: 1, x: 10, y: 10 },
        { id: 2, x: 0, y: 10 },
        { id: 3, x: 10, y: 0 },
      ],
      edges: [
        { a: 0, b: 1 },
        { a: 2, b: 3 },
      ],
    };
    expect(countCrossings(graph)).toBe(1);
  });
});

describe('createCrossingTracker / updateCrossingTracker', () => {
  it('matches countCrossings on creation', () => {
    const solved = generateSolvedGraph(10, { x: 200, y: 200 }, 150);
    const scrambled = scrambleGraph(solved, 400, 400, 20);
    const tracker = createCrossingTracker(scrambled);
    expect(tracker.count).toBe(countCrossings(scrambled));
  });

  it('stays in sync with countCrossings after moving a single node', () => {
    const solved = generateSolvedGraph(10, { x: 200, y: 200 }, 150);
    const scrambled = scrambleGraph(solved, 400, 400, 20);
    const tracker = createCrossingTracker(scrambled);

    const moved = scrambled.nodes[3];
    const newX = moved.x + 137;
    const newY = moved.y - 82;
    const trackerCount = updateCrossingTracker(tracker, moved.id, newX, newY);

    const nextGraph: Graph = {
      nodes: scrambled.nodes.map((n) => (n.id === moved.id ? { ...n, x: newX, y: newY } : n)),
      edges: scrambled.edges,
    };
    expect(trackerCount).toBe(countCrossings(nextGraph));
  });

  it('stays in sync across a sequence of moves to different nodes', () => {
    const solved = generateSolvedGraph(12, { x: 200, y: 200 }, 150);
    let graph = scrambleGraph(solved, 400, 400, 20);
    const tracker = createCrossingTracker(graph);

    const moves = [
      { id: graph.nodes[0].id, x: 50, y: 300 },
      { id: graph.nodes[5].id, x: 350, y: 40 },
      { id: graph.nodes[0].id, x: 200, y: 200 },
      { id: graph.nodes[9].id, x: 10, y: 10 },
    ];

    let trackerCount = tracker.count;
    for (const move of moves) {
      trackerCount = updateCrossingTracker(tracker, move.id, move.x, move.y);
      graph = { nodes: graph.nodes.map((n) => (n.id === move.id ? { ...n, x: move.x, y: move.y } : n)), edges: graph.edges };
      expect(trackerCount).toBe(countCrossings(graph));
    }
  });
});

describe('getEndpointIds', () => {
  it('returns both ends of a single open path', () => {
    const graph = generateSolvedGraph(6, { x: 0, y: 0 }, 50);
    expect(getEndpointIds(graph)).toEqual(new Set([0, 5]));
  });

  it('returns every node of a graph with no edges', () => {
    const graph: Graph = {
      nodes: [
        { id: 0, x: 0, y: 0 },
        { id: 1, x: 1, y: 1 },
      ],
      edges: [],
    };
    expect(getEndpointIds(graph)).toEqual(new Set([0, 1]));
  });

  it('excludes interior nodes of degree 2', () => {
    const graph: Graph = {
      nodes: [
        { id: 0, x: 0, y: 0 },
        { id: 1, x: 1, y: 0 },
        { id: 2, x: 2, y: 0 },
      ],
      edges: [
        { a: 0, b: 1 },
        { a: 1, b: 2 },
      ],
    };
    expect(getEndpointIds(graph)).toEqual(new Set([0, 2]));
  });
});

describe('traceOuterBoundaryIds', () => {
  it('includes every node of a convex polygon (all nodes are on the boundary)', () => {
    const graph = generateSolvedGraph(6, { x: 0, y: 0 }, 50);
    // Close the loop so it has an actual outer face to trace.
    const closed: Graph = { nodes: graph.nodes, edges: [...graph.edges, { a: 5, b: 0 }] };
    const boundary = traceOuterBoundaryIds(closed);
    for (const node of closed.nodes) {
      expect(boundary.has(node.id)).toBe(true);
    }
  });

  it('only traces the connected piece the starting node belongs to', () => {
    // A square plus a fully separate, unconnected square nested inside its
    // bounds (e.g. rtx5090's card outline vs. its own separate fan icons).
    const graph: Graph = {
      nodes: [
        { id: 0, x: 0, y: 0 },
        { id: 1, x: 10, y: 0 },
        { id: 2, x: 10, y: 10 },
        { id: 3, x: 0, y: 10 },
        { id: 4, x: 4, y: 4 },
        { id: 5, x: 6, y: 4 },
        { id: 6, x: 6, y: 6 },
        { id: 7, x: 4, y: 6 },
      ],
      edges: [
        { a: 0, b: 1 },
        { a: 1, b: 2 },
        { a: 2, b: 3 },
        { a: 3, b: 0 },
        { a: 4, b: 5 },
        { a: 5, b: 6 },
        { a: 6, b: 7 },
        { a: 7, b: 4 },
      ],
    };
    const boundary = traceOuterBoundaryIds(graph);
    expect(boundary.has(0)).toBe(true);
    expect(boundary.has(1)).toBe(true);
    expect(boundary.has(2)).toBe(true);
    expect(boundary.has(3)).toBe(true);
    expect(boundary.has(4)).toBe(false);
    expect(boundary.has(5)).toBe(false);
    expect(boundary.has(6)).toBe(false);
    expect(boundary.has(7)).toBe(false);
  });
});

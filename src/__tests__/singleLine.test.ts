import { Graph } from '../puzzle';
import { singleLineify } from '../singleLine';

function edgeKey(sourceA: number, sourceB: number): string {
  return sourceA < sourceB ? `${sourceA}-${sourceB}` : `${sourceB}-${sourceA}`;
}

describe('singleLineify', () => {
  it('leaves an already-simple open path untouched in shape (same edge count, one component)', () => {
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
    const { graph: result, sourceIds } = singleLineify(graph);
    expect(result.edges).toHaveLength(2);
    expect(sourceIds).toEqual([0, 1, 2]);
  });

  it('covers every original edge at least once for a branching (degree-3+) graph', () => {
    // A "Y" shape: center node 0 connects to three arms — an odd number of
    // odd-degree vertices, forcing singleLineify to backtrack over one arm.
    const graph: Graph = {
      nodes: [
        { id: 0, x: 0, y: 0 },
        { id: 1, x: 10, y: 0 },
        { id: 2, x: -10, y: 10 },
        { id: 3, x: -10, y: -10 },
      ],
      edges: [
        { a: 0, b: 1 },
        { a: 0, b: 2 },
        { a: 0, b: 3 },
      ],
    };
    const { graph: result, sourceIds } = singleLineify(graph);

    const coveredOriginalEdges = new Set<string>();
    for (const e of result.edges) {
      coveredOriginalEdges.add(edgeKey(sourceIds[e.a], sourceIds[e.b]));
    }
    for (const e of graph.edges) {
      expect(coveredOriginalEdges.has(edgeKey(e.a, e.b))).toBe(true);
    }
  });

  it('produces a single connected path (each new edge chains index i to i+1)', () => {
    const graph: Graph = {
      nodes: [
        { id: 0, x: 0, y: 0 },
        { id: 1, x: 10, y: 0 },
        { id: 2, x: -10, y: 10 },
        { id: 3, x: -10, y: -10 },
      ],
      edges: [
        { a: 0, b: 1 },
        { a: 0, b: 2 },
        { a: 0, b: 3 },
      ],
    };
    const { graph: result } = singleLineify(graph);
    const sorted = result.edges.map((e) => [e.a, e.b].sort((x, y) => x - y));
    for (const [a, b] of sorted) {
      expect(b).toBe(a + 1);
    }
  });

  it('handles a graph with several disconnected pieces by producing one path per piece', () => {
    const graph: Graph = {
      nodes: [
        { id: 0, x: 0, y: 0 },
        { id: 1, x: 1, y: 0 },
        { id: 2, x: 100, y: 100 },
        { id: 3, x: 101, y: 100 },
      ],
      edges: [
        { a: 0, b: 1 },
        { a: 2, b: 3 },
      ],
    };
    const { graph: result, sourceIds } = singleLineify(graph);
    expect(result.edges).toHaveLength(2);
    // Each piece's source ids should stay confined to its own original component.
    const pieceOfNode0 = sourceIds.filter((id) => id === 0 || id === 1);
    const pieceOfNode2 = sourceIds.filter((id) => id === 2 || id === 3);
    expect(pieceOfNode0).toHaveLength(2);
    expect(pieceOfNode2).toHaveLength(2);
  });

  it('preserves node positions from their original source node', () => {
    const graph: Graph = {
      nodes: [
        { id: 0, x: 5, y: 7 },
        { id: 1, x: 15, y: 27 },
      ],
      edges: [{ a: 0, b: 1 }],
    };
    const { graph: result, sourceIds } = singleLineify(graph);
    for (let i = 0; i < result.nodes.length; i++) {
      const original = graph.nodes.find((n) => n.id === sourceIds[i])!;
      expect(result.nodes[i].x).toBe(original.x);
      expect(result.nodes[i].y).toBe(original.y);
    }
  });
});
